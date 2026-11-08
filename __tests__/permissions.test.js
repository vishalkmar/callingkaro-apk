import './helpers/nativeMocks';
import React from 'react';
import { AppState, Platform } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

jest.setTimeout(30000);

// Controllable react-native-permissions.
const mockState = { status: {}, requestResult: {}, notif: 'denied' };
jest.mock('react-native-permissions', () => {
  const RESULTS = {
    GRANTED: 'granted',
    DENIED: 'denied',
    BLOCKED: 'blocked',
    UNAVAILABLE: 'unavailable',
    LIMITED: 'limited',
  };
  const PERMISSIONS = {
    ANDROID: {
      READ_CONTACTS: 'READ_CONTACTS',
      RECORD_AUDIO: 'RECORD_AUDIO',
      BLUETOOTH_CONNECT: 'BLUETOOTH_CONNECT',
      READ_MEDIA_AUDIO: 'READ_MEDIA_AUDIO',
      READ_EXTERNAL_STORAGE: 'READ_EXTERNAL_STORAGE',
      WRITE_EXTERNAL_STORAGE: 'WRITE_EXTERNAL_STORAGE',
      READ_PHONE_STATE: 'READ_PHONE_STATE',
    },
  };
  return {
    RESULTS,
    PERMISSIONS,
    check: jest.fn(async p => mockState.status[p] || 'denied'),
    request: jest.fn(async p => {
      const r = mockState.requestResult[p] || 'granted';
      mockState.status[p] = r;
      return r;
    }),
    checkNotifications: jest.fn(async () => ({ status: mockState.notif })),
    requestNotifications: jest.fn(async () => ({ status: (mockState.notif = 'granted') })),
    openSettings: jest.fn(async () => {}),
  };
});

const mockNav = { replace: jest.fn(), navigate: jest.fn(), goBack: jest.fn() };
let mockParams = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: mockParams }),
  useFocusEffect: cb => require('react').useEffect(cb, [cb]),
}));

const flush = async () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 20));
  });

// Android 14 for the whole file unless a test isolates modules.
Platform.OS = 'android';
Object.defineProperty(Platform, 'Version', { get: () => 34, configurable: true });

const rnp = require('react-native-permissions');

afterEach(() => {
  jest.restoreAllMocks();
});

beforeEach(async () => {
  jest.clearAllMocks();
  mockState.status = {};
  mockState.requestResult = {};
  mockState.notif = 'denied';
  mockParams = { stepIndex: 0 };
  await AsyncStorage.clear();
});

describe('permissions service (P10.T02, T09)', () => {
  const load = version => {
    let mod;
    jest.isolateModules(() => {
      // the isolated registry has its own react-native Platform object
      const P = require('react-native').Platform;
      P.OS = 'android';
      Object.defineProperty(P, 'Version', { get: () => version, configurable: true });
      mod = require('@services/permissions/permissions');
    });
    return mod;
  };

  test('Android 13+: storage = READ_MEDIA_AUDIO, notifications need a runtime prompt', async () => {
    const p = load(34);
    await p.request('storage');
    expect(rnp.request).toHaveBeenCalledWith('READ_MEDIA_AUDIO');
    expect(rnp.request).not.toHaveBeenCalledWith('WRITE_EXTERNAL_STORAGE');
    expect(await p.check('notifications')).toBe('denied');
  });

  test('Android 9: READ + WRITE external storage, no Bluetooth/notification prompts', async () => {
    const p = load(28);
    await p.request('storage');
    expect(rnp.request).toHaveBeenCalledWith('READ_EXTERNAL_STORAGE');
    expect(rnp.request).toHaveBeenCalledWith('WRITE_EXTERNAL_STORAGE');
    expect(await p.check('bluetooth')).toBe('granted');
    expect(await p.check('notifications')).toBe('granted');
  });

  test('results are normalised; errors never throw', async () => {
    const p = load(34);
    mockState.status.RECORD_AUDIO = 'limited';
    expect(await p.check('microphone')).toBe('granted');
    mockState.status.READ_CONTACTS = 'blocked';
    expect(await p.check('contacts')).toBe('blocked');
    rnp.check.mockRejectedValueOnce(new Error('boom'));
    expect(await p.check('contacts')).toBe('denied');
    expect(Object.keys(await p.checkAll())).toEqual([
      'contacts',
      'microphone',
      'notifications',
      'bluetooth',
      'storage',
    ]);
  });
});

describe('PermissionScreen flow (P10.T03-T11)', () => {
  const { PERMISSION_STEPS } = require('@screens/permissions/permissionSteps');
  const PermissionScreen = require('@screens/permissions/PermissionScreen').default;

  test('Android 14 shows all 5 steps in order', () => {
    expect(PERMISSION_STEPS.map(s => s.key)).toEqual([
      'contacts',
      'microphone',
      'notifications',
      'bluetooth',
      'storage',
    ]);
  });

  test('Contacts: Image 3 text + CONTINUE + Not Now; Not Now moves on without asking', async () => {
    const u = render(<PermissionScreen />);
    await flush();
    expect(u.getByText(/address book to call your friends and relatives/)).toBeTruthy();
    expect(u.getByText('1 / 5')).toBeTruthy();
    fireEvent.press(u.getByTestId('perm-notnow'));
    expect(rnp.request).not.toHaveBeenCalled();
    expect(mockNav.replace).toHaveBeenCalledWith('MicPermission', { stepIndex: 1 });
  });

  test('optional permission denied -> still continues', async () => {
    mockState.requestResult.READ_CONTACTS = 'denied';
    const u = render(<PermissionScreen />);
    await flush();
    await act(async () => fireEvent.press(u.getByTestId('perm-continue')));
    expect(mockNav.replace).toHaveBeenCalledTimes(1);
  });

  test('microphone is required: no Not Now; denied stays with a message', async () => {
    mockParams = { stepIndex: 1 };
    mockState.requestResult.RECORD_AUDIO = 'denied';
    const u = render(<PermissionScreen />);
    await flush();
    expect(u.queryByTestId('perm-notnow')).toBeNull();
    await act(async () => fireEvent.press(u.getByTestId('perm-continue')));
    expect(mockNav.replace).not.toHaveBeenCalled();
    expect(u.getByText(/Calls cannot work without the microphone/)).toBeTruthy();
  });

  test('blocked -> button becomes Open Settings; returning with it allowed moves on', async () => {
    mockParams = { stepIndex: 1 };
    mockState.status.RECORD_AUDIO = 'blocked';
    const listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((ev, fn) => {
      listeners.push(fn);
      return { remove: jest.fn() };
    });
    const u = render(<PermissionScreen />);
    await flush();
    expect(u.getByText('OPEN SETTINGS')).toBeTruthy();
    fireEvent.press(u.getByTestId('perm-continue'));
    expect(rnp.openSettings).toHaveBeenCalled();
    mockState.status.RECORD_AUDIO = 'granted'; // user allowed it in system settings
    await act(async () => listeners.forEach(fn => fn('active')));
    await flush();
    expect(mockNav.replace).toHaveBeenCalledWith('NotificationPermission', { stepIndex: 2 });
  });

  test('BUG FIX: grant + AppState "active" at the same moment advances only ONE step', async () => {
    const listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((ev, fn) => {
      listeners.push(fn);
      return { remove: jest.fn() };
    });
    const u = render(<PermissionScreen />);
    await flush();
    await act(async () => {
      const p = fireEvent.press(u.getByTestId('perm-continue'));
      listeners.forEach(fn => fn('active')); // dialog closed -> activity resumed
      await p;
    });
    await flush();
    expect(mockNav.replace).toHaveBeenCalledTimes(1);
  });

  test('already granted (reinstall) -> skipped silently', async () => {
    mockState.status.READ_CONTACTS = 'granted';
    render(<PermissionScreen />);
    await flush();
    expect(mockNav.replace).toHaveBeenCalledWith('MicPermission', { stepIndex: 1 });
  });

  test('last step saves permissionsDone=true and opens Main', async () => {
    mockParams = { stepIndex: 4 };
    const { useAppStore } = require('@store/appStore');
    const u = render(<PermissionScreen />);
    await flush();
    await act(async () => fireEvent.press(u.getByTestId('perm-notnow')));
    expect(await AsyncStorage.getItem('permissionsDone')).toBe('true');
    expect(useAppStore.getState().stage).toBe('main');
  });
});

describe('Call gate mic dialog (P10.T13)', () => {
  const CallGateHost = require('@components/CallGateHost').default;
  const { useCallGateStore } = require('@store/callGateStore');

  test('blocked mic -> Open Settings; back with mic allowed -> dialog closes', async () => {
    mockState.status.RECORD_AUDIO = 'blocked';
    const listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((ev, fn) => {
      listeners.push(fn);
      return { remove: jest.fn() };
    });
    act(() => useCallGateStore.getState().open('mic', { number: '+919876543210' }));
    const u = render(<CallGateHost />);
    await act(async () => fireEvent.press(u.getByText(/^allow$/i)));
    expect(rnp.openSettings).toHaveBeenCalled();
    expect(u.getByText('OPEN SETTINGS')).toBeTruthy();
    mockState.status.RECORD_AUDIO = 'granted';
    await act(async () => {
      for (const fn of listeners) {
        await fn('active');
      }
    });
    expect(useCallGateStore.getState().dialog).toBeNull();
  });
});
