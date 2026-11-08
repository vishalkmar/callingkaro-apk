// Phase 9: axios interceptors (Bearer, single refresh, retry, logout rules), bootstrap, logout, stores.
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import * as Keychain from 'react-native-keychain';
import { api, setAuthHandlers } from '@services/api/client';
import { saveTokens, loadTokens, getAccessToken, clearTokens } from '@services/storage/secureStore';
import { useAuthStore } from '@store/authStore';
import { useWalletStore } from '@store/walletStore';
import { useAppStore } from '@store/appStore';
import { useSettingsStore, DEFAULT_SETTINGS } from '@store/settingsStore';

jest.mock('react-native-device-info', () => ({ getUniqueId: jest.fn(async () => 'dev-1') }));

// A fake HTTP layer for `api`: handler(config) -> { status, data }.
let handler;
const calls = [];
const adapter = async config => {
  calls.push({ url: config.url, auth: config.headers?.Authorization });
  const { status, data } = await handler(config);
  if (status >= 400) {
    const err = new Error(`HTTP ${status}`);
    err.config = config;
    err.response = { status, data, config };
    throw err;
  }
  return { status, data, headers: {}, config, statusText: 'OK' };
};
const offline = config => {
  const err = new Error('Network Error');
  err.config = config;
  throw err;
};

const onSessionExpired = jest.fn();
const onBlocked = jest.fn();

beforeEach(async () => {
  api.defaults.adapter = adapter;
  calls.length = 0;
  onSessionExpired.mockReset();
  onBlocked.mockReset();
  setAuthHandlers({ onSessionExpired, onBlocked });
  await saveTokens({ accessToken: 'old-access', refreshToken: 'refresh-1' });
  jest.spyOn(axios, 'post').mockReset();
});

describe('P09.T01 tokens live in Keychain, not AsyncStorage', () => {
  test('save/load/clear', async () => {
    expect(Keychain.setGenericPassword).toHaveBeenCalled();
    expect(await AsyncStorage.getItem('accessToken')).toBeNull();
    const all = await AsyncStorage.getMany(['tokens', 'refreshToken']);
    expect(Object.values(all).every(v => v === null)).toBe(true);
    expect((await loadTokens()).refreshToken).toBe('refresh-1');
    await clearTokens();
    expect(getAccessToken()).toBeNull();
  });
});

describe('P09.T05-T07 interceptors', () => {
  test('Bearer header on API calls, not on auth endpoints', async () => {
    handler = async () => ({ status: 200, data: { success: true, data: {} } });
    await api.get('/wallet');
    await api.post('/auth/send-otp', {});
    expect(calls[0].auth).toBe('Bearer old-access');
    expect(calls[1].auth).toBeUndefined();
  });

  test('3 parallel 401s -> ONE refresh, all 3 retried with the new token', async () => {
    axios.post.mockImplementation(async () => {
      await new Promise(r => setTimeout(r, 20));
      return { data: { data: { accessToken: 'new-access', refreshToken: 'refresh-2' } } };
    });
    handler = async config =>
      config.headers.Authorization === 'Bearer new-access'
        ? { status: 200, data: { success: true, data: { ok: config.url } } }
        : { status: 401, data: { success: false, code: 'TOKEN_EXPIRED' } };
    const res = await Promise.all([api.get('/wallet'), api.get('/me'), api.get('/calls')]);
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(res.map(r => r.data.data.ok)).toEqual(['/wallet', '/me', '/calls']);
    expect(getAccessToken()).toBe('new-access');
    expect(JSON.parse(Keychain.setGenericPassword.mock.calls.at(-1)[1]).refreshToken).toBe('refresh-2'); // rotated + persisted
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  test('refresh rejected by server (401) -> session expired', async () => {
    axios.post.mockRejectedValue(
      Object.assign(new Error('401'), { response: { status: 401, data: { code: 'REFRESH_REUSED' } } }),
    );
    handler = async () => ({ status: 401, data: { code: 'TOKEN_EXPIRED' } });
    await expect(api.get('/wallet')).rejects.toMatchObject({ status: 401 });
    expect(onSessionExpired).toHaveBeenCalledTimes(1);
  });

  test('BUG FIX: no internet during refresh keeps the user logged in', async () => {
    axios.post.mockRejectedValue(new Error('Network Error'));
    handler = async () => ({ status: 401, data: { code: 'TOKEN_EXPIRED' } });
    await expect(api.get('/wallet')).rejects.toMatchObject({ code: 'NETWORK' });
    expect(onSessionExpired).not.toHaveBeenCalled();
    expect(getAccessToken()).toBe('old-access');
  });

  test('server 500 during refresh also keeps the session', async () => {
    axios.post.mockRejectedValue(Object.assign(new Error('500'), { response: { status: 500, data: {} } }));
    handler = async () => ({ status: 401, data: { code: 'TOKEN_EXPIRED' } });
    await expect(api.get('/wallet')).rejects.toBeTruthy();
    expect(onSessionExpired).not.toHaveBeenCalled();
  });

  test('retried request that fails 401 again does not loop', async () => {
    axios.post.mockResolvedValue({ data: { data: { accessToken: 'a2', refreshToken: 'r2' } } });
    handler = async () => ({ status: 401, data: { code: 'INVALID_TOKEN' } });
    await expect(api.get('/wallet')).rejects.toMatchObject({ status: 401 });
    expect(axios.post).toHaveBeenCalledTimes(1);
    expect(calls).toHaveLength(2);
  });

  test('P09.T15 USER_BLOCKED -> blocked handler, no refresh', async () => {
    handler = async () => ({ status: 403, data: { code: 'USER_BLOCKED', message: 'Blocked for abuse' } });
    await expect(api.get('/wallet')).rejects.toMatchObject({ code: 'USER_BLOCKED' });
    expect(onBlocked).toHaveBeenCalledWith('Blocked for abuse');
    expect(axios.post).not.toHaveBeenCalled();
  });

  test('offline request -> NETWORK error, envelope errors keep server code/message', async () => {
    handler = offline;
    await expect(api.get('/wallet')).rejects.toMatchObject({ code: 'NETWORK' });
    handler = async () => ({
      status: 402,
      data: { success: false, code: 'INSUFFICIENT_CREDITS', message: 'Need 1 min' },
    });
    await expect(api.get('/voice/token')).rejects.toMatchObject({
      code: 'INSUFFICIENT_CREDITS',
      message: 'Need 1 min',
      status: 402,
    });
  });
});

describe('P09.T08 / T11 bootstrap and logout (authService)', () => {
  const authService = require('@services/auth/authService');
  const accept = () =>
    AsyncStorage.setMany({ termsAccepted: 'true', termsVersion: 'v1', permissionsDone: 'true' });

  beforeEach(async () => {
    await AsyncStorage.clear();
    setAuthHandlers({}); // keep authService handlers
  });

  test('valid tokens -> GET /me then wallet -> main', async () => {
    await accept();
    handler = async config =>
      config.url === '/me'
        ? { status: 200, data: { success: true, data: { user: { id: 'u1', email: 'r@x.in' } } } }
        : { status: 200, data: { success: true, data: { credits: 4500 } } };
    expect(await authService.bootstrap()).toBe('main');
    await new Promise(r => setTimeout(r, 10));
    expect(useAuthStore.getState().user.email).toBe('r@x.in');
    expect(useWalletStore.getState().minutes).toBe(4);
  });

  test('server unreachable at start -> stays logged in (offline UI), not kicked to login', async () => {
    await accept();
    handler = offline;
    expect(await authService.bootstrap()).toBe('main');
    expect(useAuthStore.getState().status).toBe('authenticated');
  });

  test('no tokens -> auth', async () => {
    await accept();
    await clearTokens();
    expect(await authService.bootstrap()).toBe('auth');
  });

  test('logout: server revoke, Keychain + stores cleared, local call history kept', async () => {
    await accept();
    useWalletStore.getState().setBalance(9000);
    handler = async () => ({ status: 200, data: { success: true, data: {} } });
    await AsyncStorage.setItem('someLocalHistoryMarker', 'keep');
    await authService.logout();
    expect(calls.some(c => c.url === '/auth/logout')).toBe(true);
    expect(getAccessToken()).toBeNull();
    expect(useWalletStore.getState().credits).toBe(0);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAppStore.getState().stage).toBe('auth');
    expect(await AsyncStorage.getItem('someLocalHistoryMarker')).toBe('keep');
  });

  test('logout works offline too', async () => {
    handler = offline;
    await authService.logout();
    expect(getAccessToken()).toBeNull();
    expect(useAppStore.getState().stage).toBe('auth');
  });
});

describe('P09.T03 / T14 stores', () => {
  test('wallet minutes are derived (floor) and the app never invents credits', () => {
    useWalletStore.getState().setFromServer({ credits: 2999 });
    expect(useWalletStore.getState().minutes).toBe(2);
    useWalletStore.getState().setFromServer({ credits: 'x' });
    expect(useWalletStore.getState().credits).toBe(2999);
  });

  test('settings persist to AsyncStorage and never include functions', async () => {
    useSettingsStore.getState().setSetting('recordAllCalls', true);
    await new Promise(r => setTimeout(r, 10));
    const raw = JSON.parse(await AsyncStorage.getItem('settings'));
    expect(raw.state.recordAllCalls).toBe(true);
    expect(raw.state.setSetting).toBeUndefined();
    useSettingsStore.getState().resetSettings();
    expect(useSettingsStore.getState().recordAllCalls).toBe(DEFAULT_SETTINGS.recordAllCalls);
  });
});
