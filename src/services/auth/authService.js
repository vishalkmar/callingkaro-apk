import AsyncStorage from '@react-native-async-storage/async-storage';
import DeviceInfo from 'react-native-device-info';
import { CONFIG, STORAGE_KEYS } from '@constants/config';
import { useAppStore } from '@store/appStore';
import { useAuthStore } from '@store/authStore';
import { useWalletStore } from '@store/walletStore';
import { useCallStore } from '@store/callStore';
import { saveTokens, loadTokens, clearTokens, getRefreshToken } from '@services/storage/secureStore';
import { setAuthHandlers } from '@services/api/client';
import * as authApi from '@services/api/authApi';
import logger from '@utils/logger';

const log = logger.scope('auth');

// ---------- flags ----------
// AsyncStorage v3: getMany / setMany / removeMany (the v2 multiGet/multiSet/multiRemove no longer exist).
export const getFlags = async () => {
  const map = await AsyncStorage.getMany([
    STORAGE_KEYS.TERMS_ACCEPTED,
    STORAGE_KEYS.TERMS_VERSION,
    STORAGE_KEYS.PERMISSIONS_DONE,
  ]);
  return {
    termsAccepted:
      map[STORAGE_KEYS.TERMS_ACCEPTED] === 'true' && map[STORAGE_KEYS.TERMS_VERSION] === CONFIG.TERMS_VERSION,
    permissionsDone: map[STORAGE_KEYS.PERMISSIONS_DONE] === 'true',
  };
};

export const acceptTerms = async () => {
  await AsyncStorage.setMany({
    [STORAGE_KEYS.TERMS_ACCEPTED]: 'true',
    [STORAGE_KEYS.TERMS_ACCEPTED_AT]: String(Date.now()),
    [STORAGE_KEYS.TERMS_VERSION]: CONFIG.TERMS_VERSION,
  });
  useAppStore.getState().setStage('auth');
};

export const finishPermissions = async () => {
  await AsyncStorage.setItem(STORAGE_KEYS.PERMISSIONS_DONE, 'true');
  useAppStore.getState().setStage('main');
};

export const resetOnboarding = async () => {
  await AsyncStorage.removeMany([
    STORAGE_KEYS.TERMS_ACCEPTED,
    STORAGE_KEYS.TERMS_ACCEPTED_AT,
    STORAGE_KEYS.TERMS_VERSION,
    STORAGE_KEYS.PERMISSIONS_DONE,
  ]);
  await clearTokens();
  useAuthStore.getState().logout();
  useAppStore.getState().setStage('onboarding');
};

// ---------- device ----------
let deviceIdCache = null;
export const getDeviceId = async () => {
  if (!deviceIdCache) {
    deviceIdCache = await DeviceInfo.getUniqueId();
  }
  return deviceIdCache;
};

// ---------- session ----------
const stageAfterLogin = async () => {
  const { permissionsDone } = await getFlags();
  return permissionsDone ? 'main' : 'permissions';
};

export const completeLogin = async ({ user, tokens, wallet }) => {
  await saveTokens(tokens);
  useAuthStore.getState().login({ user });
  if (wallet) {
    useWalletStore.getState().setFromServer(wallet);
  }
  useAppStore.getState().setStage(await stageAfterLogin());
};

const clearSession = async () => {
  await clearTokens();
  useAuthStore.getState().logout();
  useWalletStore.getState().reset();
  useCallStore.getState().clear();
};

/** Logout keeps local call history; Settings > Data offers a full wipe. */
export const logout = async () => {
  const refreshToken = getRefreshToken();
  try {
    if (refreshToken) {
      await authApi.logoutSession(refreshToken);
    }
  } catch (e) {
    log.warn('server logout failed (ignored)', e?.code);
  }
  await clearSession();
  useAppStore.getState().setStage('auth');
};

const onSessionExpired = async () => {
  await clearSession();
  useAppStore.getState().setStage('auth');
};

const onBlocked = message => {
  useAuthStore.getState().setBlocked();
  useAppStore.getState().setBlocked(message);
};

setAuthHandlers({ onSessionExpired, onBlocked });

// ---------- app start ----------
/**
 * Decide the first stack: onboarding -> auth -> permissions -> main.
 * Tokens from Keychain are validated with GET /me, then the wallet is loaded.
 */
export const bootstrap = async () => {
  const { termsAccepted } = await getFlags();
  if (!termsAccepted) {
    return 'onboarding';
  }
  const tokens = await loadTokens();
  if (!tokens?.accessToken) {
    useAuthStore.getState().logout();
    return 'auth';
  }
  try {
    const me = await authApi.getMe();
    useAuthStore.getState().login({ user: me.user || me });
    useWalletStore.getState().refresh();
  } catch (e) {
    if (e.code === 'USER_BLOCKED') {
      return 'blocked';
    }
    if (e.status === 401) {
      await clearSession();
      return 'auth';
    }
    // Offline / server down: keep the session, show cached UI, retry later.
    log.warn('bootstrap: /me failed, continuing offline', e.code);
    useAuthStore.setState({ status: 'authenticated', hasTokens: true });
  }
  return stageAfterLogin();
};

/**
 * Fire-and-forget at app start, in every build: wakes a sleeping server (free hosting) while the user
 * is still on the splash / welcome screens, so the first real request does not time out.
 */
export const wakeServer = async () => {
  try {
    const h = await authApi.healthCheck();
    log.log('server /health ->', h);
    return true;
  } catch (e) {
    log.warn(`server /health failed (${CONFIG.API_BASE_URL})`, e.code);
    return false;
  }
};
