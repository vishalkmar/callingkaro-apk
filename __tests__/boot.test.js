// Phase 27: app start-up, background/foreground behaviour, navigation before ready, crash screen.
import './helpers/nativeMocks';
import React from 'react';
import { AppState, Text } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { useAppStore } from '@store/appStore';
import { useAuthStore } from '@store/authStore';
import { setLanguage } from '@i18n';

jest.setTimeout(30000);

jest.mock('@services/auth/authService', () => ({
  bootstrap: jest.fn(async () => 'main'),
  wakeServer: jest.fn(),
  resetOnboarding: jest.fn(),
}));
jest.mock('@db/index', () => ({ initDatabase: jest.fn(async () => ({})) }));
jest.mock('@services/calls/historySync', () => ({ syncHistoryOnce: jest.fn(), reconcileUnfinishedCalls: jest.fn() }));
jest.mock('@services/voice/voiceService', () => ({ __esModule: true, default: { init: jest.fn() } }));
jest.mock('@services/ads/rewardedAd', () => ({ initRewardedAds: jest.fn() }));
jest.mock('@services/payments/payments', () => ({ initPayments: jest.fn() }));
jest.mock('@services/security/deviceIntegrity', () => ({
  getIntegrity: jest.fn(async () => ({ emulator: false, rooted: true })),
  integrityHeader: jest.requireActual('@services/security/deviceIntegrity').integrityHeader,
}));
jest.mock('@services/api/walletApi', () => ({ getWallet: jest.fn(async () => ({ credits: 1000 })) }));

const authService = require('@services/auth/authService');
const db = require('@db/index');
const history = require('@services/calls/historySync');
const voiceService = require('@services/voice/voiceService').default;
const BootSplash = require('react-native-bootsplash');
const { api } = require('@services/api/client');
const { useAppBootstrap } = require('@app/useAppBootstrap');
const walletApi = require('@services/api/walletApi');

const Probe = () => {
  useAppBootstrap();
  return null;
};
const flush = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 20));
  });

beforeEach(() => {
  jest.clearAllMocks();
  useAppStore.setState({ stage: 'loading' });
  delete api.defaults.headers.common['X-Device-Integrity'];
});

describe('app start (useAppBootstrap)', () => {
  test('order: integrity header -> DB migrations -> session check -> stage -> hide splash', async () => {
    const order = [];
    db.initDatabase.mockImplementationOnce(async () => {
      order.push(`db:${api.defaults.headers.common['X-Device-Integrity']}`);
    });
    authService.bootstrap.mockImplementationOnce(async () => {
      order.push('bootstrap');
      return 'auth';
    });
    render(<Probe />);
    await flush();
    expect(order).toEqual(['db:emulator=0;rooted=1', 'bootstrap']); // header set BEFORE anything else
    expect(useAppStore.getState().stage).toBe('auth');
    expect(BootSplash.hide).toHaveBeenCalled();
  });

  test('a failing DB or session check still opens the app (never stuck on the splash)', async () => {
    db.initDatabase.mockRejectedValueOnce(new Error('disk'));
    authService.bootstrap.mockRejectedValueOnce(new Error('keychain'));
    render(<Probe />);
    await flush();
    expect(useAppStore.getState().stage).toBe('onboarding');
    expect(BootSplash.hide).toHaveBeenCalled();
  });

  test('logged-in services start only on the main stage', async () => {
    authService.bootstrap.mockResolvedValueOnce('permissions');
    render(<Probe />);
    await flush();
    expect(voiceService.init).not.toHaveBeenCalled();
    act(() => useAppStore.getState().setStage('main'));
    await flush();
    expect(voiceService.init).toHaveBeenCalled();
    expect(history.syncHistoryOnce).toHaveBeenCalled();
    expect(history.reconcileUnfinishedCalls).toHaveBeenCalled();
  });

  test('back from background: wallet refreshed + calls reconciled (only when logged in)', async () => {
    const listeners = [];
    jest.spyOn(AppState, 'addEventListener').mockImplementation((ev, fn) => {
      listeners.push(fn);
      return { remove: jest.fn() };
    });
    Object.defineProperty(AppState, 'currentState', { value: 'active', configurable: true });
    render(<Probe />);
    await flush();
    useAuthStore.setState({ status: 'guest' });
    listeners.forEach(fn => fn('background'));
    listeners.forEach(fn => fn('active'));
    expect(walletApi.getWallet).not.toHaveBeenCalled();
    useAuthStore.setState({ status: 'authenticated' });
    listeners.forEach(fn => fn('background'));
    history.reconcileUnfinishedCalls.mockClear();
    listeners.forEach(fn => fn('active'));
    await flush();
    expect(walletApi.getWallet).toHaveBeenCalled();
    expect(history.reconcileUnfinishedCalls).toHaveBeenCalled();
    AppState.addEventListener.mockRestore();
  });
});

describe('navigation from services before the navigator is ready', () => {
  test('queued and run once ready', () => {
    jest.isolateModules(() => {
      const nav = require('@navigation/navigationRef');
      let ready = false;
      nav.navigationRef.isReady = () => ready;
      nav.navigationRef.navigate = jest.fn();
      nav.navigate('InCall');
      expect(nav.navigationRef.navigate).not.toHaveBeenCalled();
      ready = true;
      nav.flushPendingNavigation();
      expect(nav.navigationRef.navigate).toHaveBeenCalledWith('InCall', undefined);
      expect(nav.currentRouteName).toBeDefined();
    });
  });
});

describe('crash screen (ErrorBoundary)', () => {
  const { ErrorBoundary } = require('@components/common');
  let shouldThrow = true;
  const Boom = () => {
    if (shouldThrow) {
      throw new Error('kaboom');
    }
    return <Text>fine now</Text>;
  };

  test('shows a calm message instead of a white screen, and Try again recovers', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    setLanguage('en');
    shouldThrow = true;
    const u = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(u.getByText('Something went wrong')).toBeTruthy();
    expect(u.getByText(/credits and call history are safe/)).toBeTruthy();
    shouldThrow = false;
    fireEvent.press(u.getByText(/TRY AGAIN/i));
    expect(u.getByText('fine now')).toBeTruthy();
    err.mockRestore();
  });

  test('NEW: crash screen in Hindi', () => {
    const err = jest.spyOn(console, 'error').mockImplementation(() => {});
    setLanguage('hi');
    shouldThrow = true;
    const u = render(
      <ErrorBoundary>
        <Boom />
      </ErrorBoundary>,
    );
    expect(u.getByText('कुछ गड़बड़ हो गई')).toBeTruthy();
    setLanguage('en');
    err.mockRestore();
  });
});

describe('P29 free-hosting server wake-up', () => {
  test('the wake-up ping starts at boot, before the DB / session finish, and is not waited for', async () => {
    const appState = jest.spyOn(AppState, 'addEventListener').mockReturnValue({ remove: jest.fn() });
    let releaseDb;
    db.initDatabase.mockImplementationOnce(() => new Promise(r => (releaseDb = r)));
    render(<Probe />);
    await flush();
    expect(authService.wakeServer).toHaveBeenCalledTimes(1);
    expect(authService.bootstrap).not.toHaveBeenCalled(); // DB still loading, ping already sent
    releaseDb();
    await flush();
    expect(authService.bootstrap).toHaveBeenCalled();
    appState.mockRestore();
  });
});
