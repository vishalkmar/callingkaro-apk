import './helpers/nativeMocks';
import React from 'react';
import { render, act, fireEvent } from '@testing-library/react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createSqlJsAdapter } from './helpers/sqljsAdapter';
import { setDbAdapter, initDatabase } from '@db/index';
import { useAppStore } from '@store/appStore';
import { linking } from '@navigation/linking';
import { ROUTES, STACKS } from '@constants/routes';

jest.setTimeout(30000);

jest.mock('@services/api/walletApi', () => ({
  getWallet: jest.fn(async () => ({ credits: 5000 })),
  getWalletConfig: jest.fn(async () => null),
  getLedger: jest.fn(async () => ({ items: [], hasMore: false })),
}));

// Nothing granted yet -> the explainer screens must show (granted ones are skipped automatically).
jest.mock('@services/permissions/permissions', () => {
  const actual = jest.requireActual('@services/permissions/permissions');
  return {
    ...actual,
    check: jest.fn(async () => 'denied'),
    request: jest.fn(async () => 'denied'),
    checkAll: jest.fn(async () => ({})),
  };
});

const flush = async (ms = 50) => {
  await act(async () => {
    await new Promise(r => setTimeout(r, ms));
  });
};

const renderRoot = () => {
  const RootNavigator = require('@navigation/RootNavigator').default;
  return render(
    <NavigationContainer>
      <RootNavigator />
    </NavigationContainer>,
  );
};

beforeAll(async () => {
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
});

describe('RootNavigator stage gate', () => {
  test('each stage mounts the right first screen', async () => {
    useAppStore.setState({ stage: 'loading' });
    const utils = renderRoot();
    await flush();
    expect(utils.getByText('CallingKaro')).toBeTruthy(); // splash

    act(() => useAppStore.getState().setStage('onboarding'));
    await flush();
    expect(utils.getByText(/I understand and accept/)).toBeTruthy();

    act(() => useAppStore.getState().setStage('auth'));
    await flush();
    expect(utils.getByText('SEND OTP')).toBeTruthy();
    expect(utils.queryByText(/I understand and accept/)).toBeNull(); // previous stack unmounted (= reset)

    act(() => useAppStore.getState().setStage('permissions'));
    await flush();
    expect(utils.getByText(/address book/)).toBeTruthy();

    act(() => useAppStore.getState().setStage('main'));
    await flush(200);
    // Top tabs in Image 4 order + the CALL button of the first tab.
    for (const label of ['Dialpad', 'Contacts', 'Recent', 'Get minutes']) {
      expect(utils.getAllByText(label).length).toBeGreaterThan(0);
    }
    expect(utils.getByText('CALL')).toBeTruthy();

    act(() => useAppStore.getState().setBlocked('test'));
    await flush();
    expect(utils.getByText('Account blocked')).toBeTruthy();
    utils.unmount();
  });

  test('Welcome OK is disabled until consent, then moves to the Auth stack', async () => {
    useAppStore.setState({ stage: 'onboarding' });
    const utils = renderRoot();
    await flush();
    expect(utils.getByTestId('welcome-ok').props.accessibilityState.disabled).toBe(true);
    fireEvent.press(utils.getByTestId('terms-checkbox'));
    expect(utils.getByTestId('welcome-ok').props.accessibilityState.disabled).toBe(false);
    fireEvent.press(utils.getByTestId('welcome-ok'));
    await flush(100);
    expect(useAppStore.getState().stage).toBe('auth');
    const AsyncStorage = require('@react-native-async-storage/async-storage').default;
    expect(await AsyncStorage.getItem('termsAccepted')).toBe('true');
    expect(await AsyncStorage.getItem('termsVersion')).toBe('v1');
    expect(Number(await AsyncStorage.getItem('termsAcceptedAt'))).toBeGreaterThan(0);
    utils.unmount();
  });

  test('header overflow menu has Settings, Recordings, Profile, Help, Logout', async () => {
    useAppStore.setState({ stage: 'main' });
    const utils = renderRoot();
    await flush(200);
    fireEvent.press(utils.getByTestId('header-overflow'));
    await flush();
    for (const item of ['Settings', 'Recordings', 'Profile', 'Help', 'Logout']) {
      expect(utils.getAllByText(item).length).toBeGreaterThan(0);
    }
    utils.unmount();
  });
});

describe('deep links (callingkaro://)', () => {
  const { getStateFromPath } = require('@react-navigation/native');
  const route = path => {
    let s = getStateFromPath(path, linking.config);
    const names = [];
    while (s) {
      const r = s.routes[s.index ?? s.routes.length - 1];
      names.push(r.name);
      if (!r.state) {
        return { names, params: r.params };
      }
      s = r.state;
    }
    return { names };
  };
  test('wallet / spin / dial map to the right screens', () => {
    expect(route('wallet').names).toEqual([STACKS.MAIN, ROUTES.MAIN_TABS, ROUTES.GET_MINUTES]);
    expect(route('spin').names).toEqual([STACKS.MAIN, ROUTES.SPIN_WHEEL]);
    const dial = route('dial/9876543210');
    expect(dial.names.at(-1)).toBe(ROUTES.DIALPAD);
    expect(dial.params).toEqual({ prefill: '9876543210' });
  });
});
