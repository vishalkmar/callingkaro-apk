import './helpers/nativeMocks';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { useWalletStore } from '@store/walletStore';
import { setLanguage } from '@i18n';

jest.setTimeout(60000);

const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: {} }),
  useFocusEffect: cb => require('react').useEffect(cb, [cb]),
}));

const mockConfig = () => ({
  packages: [
    { id: 'minutes_80', priceInr: 100, minutes: 80, credits: 80000, badge: null },
    { id: 'minutes_170', priceInr: 200, minutes: 170, credits: 170000, badge: null },
    { id: 'minutes_270', priceInr: 300, minutes: 270, credits: 270000, badge: 'Best value' },
    { id: 'minutes_475', priceInr: 500, minutes: 475, credits: 475000, badge: null },
  ],
  ads: { todayCount: 3, max: 20, rewardCredits: 250, remaining: 17 },
  spin: {
    freeAvailable: false,
    nextFreeAt: new Date(Date.now() + 3725e3).toISOString(),
    extraSpinsAvailable: 0,
    maxWin: 2000,
  },
  checkin: { credits: 100, claimedToday: false },
  taxNote: 'Prices include applicable GST.',
});
jest.mock('@services/api/walletApi', () => ({
  getWallet: jest.fn(async () => ({ credits: 12500, lastEntries: [] })),
  getWalletConfig: jest.fn(),
  getLedger: jest.fn(),
  claimCheckin: jest.fn(),
}));
jest.mock('@services/payments/payments', () => ({ buyPackage: jest.fn() }));
jest.mock('@services/ads/rewardedAd', () => ({ showRewarded: jest.fn() }));

const walletApi = require('@services/api/walletApi');
const payments = require('@services/payments/payments');
const ads = require('@services/ads/rewardedAd');
const Toast = require('react-native-toast-message').default;
const GetMinutesScreen = require('@screens/wallet/GetMinutesScreen').default;
const WalletHistoryScreen = require('@screens/wallet/WalletHistoryScreen').default;

const flush = (ms = 300) =>
  act(async () => {
    await new Promise(r => setTimeout(r, ms));
  });

beforeEach(() => {
  jest.clearAllMocks();
  walletApi.getWalletConfig.mockImplementation(async () => mockConfig());
  useWalletStore.setState({ credits: 0, minutes: 0, config: null });
  setLanguage('en'); // App.js calls setLanguage(settings.language) and remounts
});

describe('GetMinutesScreen (P16)', () => {
  test('T01-T10, T17: balance, info, 4 packages with Best value, earn rows, history', async () => {
    const u = render(<GetMinutesScreen />);
    await flush(1000); // count-up animation finishes
    expect(u.getByText('Current balance')).toBeTruthy();
    expect(u.getByText('12 minutes')).toBeTruthy();
    expect(u.getByText('12,500 credits')).toBeTruthy();
    expect(u.getByText(/1000 credits = 1 minute/)).toBeTruthy();
    for (const [price, min] of [
      [100, 80],
      [200, 170],
      [300, 270],
      [500, 475],
    ]) {
      expect(u.getByText(`${min} minutes`)).toBeTruthy();
      expect(u.getByLabelText(`Buy ${min} minutes for ${price} rupees`)).toBeTruthy();
    }
    expect(u.getAllByText('Best value')).toHaveLength(1);
    expect(u.getAllByText('no expiration')).toHaveLength(4);
    expect(u.getByText(/Paid minutes never expire/)).toBeTruthy();
    expect(u.getByText(/\+250 credits - 3\/20 today/)).toBeTruthy();
    expect(u.getByText(/next free spin in 01:0[12]:\d\d/)).toBeTruthy();
    expect(u.getByText(/\+100 credits once a day/)).toBeTruthy();
    fireEvent.press(u.getByText('Wallet history'));
    expect(mockNav.navigate).toHaveBeenCalledWith('WalletHistory');
    fireEvent.press(u.getByText('Spin'));
    expect(mockNav.navigate).toHaveBeenCalledWith('SpinWheel');
  });

  test('T12 balance counts up to the new value', async () => {
    const u = render(<GetMinutesScreen />);
    await flush(1000);
    await act(async () => useWalletStore.getState().setBalance(20000));
    await flush(50);
    const mid = u.queryByText('20 minutes');
    await flush(1000);
    expect(u.getByText('20 minutes')).toBeTruthy();
    expect(mid).toBeNull(); // not jumped instantly
  });

  test('check-in: +100, balance updates, button disabled afterwards', async () => {
    walletApi.claimCheckin.mockResolvedValueOnce({ credits: 100, balance: 12600 });
    walletApi.getWalletConfig.mockImplementation(async () => mockConfig());
    const u = render(<GetMinutesScreen />);
    await flush();
    walletApi.getWalletConfig.mockImplementation(async () => ({
      ...mockConfig(),
      checkin: { credits: 100, claimedToday: true },
    }));
    await act(async () => fireEvent.press(u.getByText('Claim')));
    await flush(1000);
    expect(useWalletStore.getState().credits).toBe(12600);
    expect(u.getByText('+100 credits')).toBeTruthy();
    expect(u.getByText(/Claimed today/)).toBeTruthy();
  });

  test('already claimed (other device) -> friendly toast', async () => {
    walletApi.claimCheckin.mockRejectedValueOnce(Object.assign(new Error('x'), { code: 'ALREADY_CLAIMED' }));
    const u = render(<GetMinutesScreen />);
    await flush();
    await act(async () => fireEvent.press(u.getByText('Claim')));
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: 'Already claimed today' }));
  });

  test('T14 buttons disabled while an ad is showing', async () => {
    let finish;
    ads.showRewarded.mockImplementationOnce(() => new Promise(r => (finish = r)));
    const u = render(<GetMinutesScreen />);
    await flush();
    await act(async () => {
      fireEvent.press(u.getByText('Watch')); // ad still showing - do not wait for it
    });
    expect(u.getByLabelText('Buy 80 minutes for 100 rupees').props.accessibilityState.disabled).toBe(true);
    await act(async () => finish({ status: 'rewarded', gained: 250 }));
    await flush();
    expect(u.getByText('+250 credits')).toBeTruthy();
    expect(u.getByLabelText('Buy 80 minutes for 100 rupees').props.accessibilityState.disabled).toBe(false);
  });

  test('Buy opens the confirm sheet with minutes, credits and price', async () => {
    const u = render(<GetMinutesScreen />);
    await flush();
    fireEvent.press(u.getByLabelText('Buy 270 minutes for 300 rupees'));
    expect(u.getByText('Buy 270 minutes?')).toBeTruthy();
    expect(u.getByText('270,000')).toBeTruthy();
    expect(payments.buyPackage).not.toHaveBeenCalled(); // nothing charged before confirming
  });

  test('T15 error with retry when nothing is cached', async () => {
    walletApi.getWalletConfig.mockRejectedValueOnce(Object.assign(new Error('off'), { code: 'NETWORK' }));
    const u = render(<GetMinutesScreen />);
    await flush();
    expect(u.getByText(/Could not load packages/)).toBeTruthy();
    await act(async () => fireEvent.press(u.getByText(/RETRY/i)));
    await flush();
    expect(u.getByText('80 minutes')).toBeTruthy();
  });

  test('T13 skeleton while the first config loads', async () => {
    let release;
    walletApi.getWalletConfig.mockImplementationOnce(() => new Promise(r => (release = () => r(mockConfig()))));
    const u = render(<GetMinutesScreen />);
    await flush(50);
    expect(u.queryByText('80 minutes')).toBeNull();
    await act(async () => release());
    await flush();
    expect(u.getByText('80 minutes')).toBeTruthy();
  });

  test('BUG FIX: Hindi shows Hindi labels (no leftover English)', async () => {
    setLanguage('hi');
    const u = render(<GetMinutesScreen />);
    await flush();
    expect(u.getByText(/खरीद, इनाम/)).toBeTruthy();
    expect(u.getByText(/कभी खत्म नहीं/)).toBeTruthy();
    expect(u.queryByText(/next free spin/)).toBeNull();
  });
});

describe('WalletHistoryScreen (P16.T16)', () => {
  test('icon per type, green +, red -, balance after, receipt no; paging', async () => {
    walletApi.getLedger
      .mockResolvedValueOnce({
        items: [
          {
            id: '1',
            type: 'purchase',
            amount: 80000,
            balanceAfter: 80000,
            meta: { minutes: 80, receiptNo: 'CK-20261007-AB12' },
            createdAt: '2026-10-07T10:00:00Z',
          },
          {
            id: '2',
            type: 'call_charge',
            amount: -1017,
            balanceAfter: 78983,
            meta: { to: '+919876543210' },
            createdAt: '2026-10-07T11:00:00Z',
          },
        ],
        hasMore: true,
      })
      .mockResolvedValueOnce({
        items: [
          { id: '3', type: 'ad_reward', amount: 250, balanceAfter: 79233, meta: {}, createdAt: '2026-10-07T12:00:00Z' },
        ],
        hasMore: false,
      });
    const u = render(<WalletHistoryScreen />);
    await flush();
    expect(u.getByText('Purchase - 80 min')).toBeTruthy();
    expect(u.getByText(/CK-20261007-AB12/)).toBeTruthy();
    expect(u.getByText('+80,000')).toBeTruthy();
    expect(u.getByText('-1,017')).toBeTruthy();
    expect(u.getByText('bal 78,983')).toBeTruthy();
    expect(u.getByLabelText(/Call to .*minus 1017 credits/)).toBeTruthy();
    await act(async () => u.UNSAFE_getByType(require('react-native').FlatList).props.onEndReached());
    await flush();
    expect(u.getByText('Ad reward')).toBeTruthy();
  });

  test('empty and error states', async () => {
    walletApi.getLedger.mockResolvedValueOnce({ items: [], hasMore: false });
    const u = render(<WalletHistoryScreen />);
    await flush();
    expect(u.getByText(/No wallet activity yet/)).toBeTruthy();
    walletApi.getLedger.mockRejectedValueOnce(new Error('off'));
    const v = render(<WalletHistoryScreen />);
    await flush();
    expect(v.getByText(/Could not load your wallet history/)).toBeTruthy();
  });
});
