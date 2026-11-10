import './helpers/nativeMocks';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { rotationForIndex } from '@screens/wallet/SpinWheel';
import { useWalletStore } from '@store/walletStore';
import { setLanguage } from '@i18n';

jest.setTimeout(60000);

jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => ({ goBack: jest.fn(), navigate: jest.fn() }),
  useRoute: () => ({ params: {} }),
}));
const SEGMENTS = ['5', '10', '20', '5', '10', '20', '5', '10'].map(l => ({ label: l, credits: Number(l) }));
const mockStatus = (over = {}) => ({
  freeAvailable: true,
  nextFreeAt: null,
  extraSpinsAvailable: 0,
  extraSpinsLeft: 5,
  maxWin: 10,
  odds: [
    { credits: 5, percent: 98 },
    { credits: 10, percent: 2 },
    { credits: 20, percent: 0 },
  ],
  segments: SEGMENTS,
  ...over,
});
jest.mock('@services/api/spinApi', () => ({ getSpinStatus: jest.fn(), playSpin: jest.fn() }));
jest.mock('@services/api/walletApi', () => ({
  getWallet: jest.fn(async () => ({ credits: 0 })),
  getWalletConfig: jest.fn(async () => null),
}));
jest.mock('@services/ads/rewardedAd', () => ({ showRewarded: jest.fn() }));
jest.mock('@services/notifications/notifications', () => ({ scheduleFreeSpinReminder: jest.fn() }));

const spinApi = require('@services/api/spinApi');
const ads = require('@services/ads/rewardedAd');
const { scheduleFreeSpinReminder } = require('@services/notifications/notifications');
const Toast = require('react-native-toast-message').default;
const SpinWheelScreen = require('@screens/wallet/SpinWheelScreen').default;

const flush = (ms = 300) =>
  act(async () => {
    await new Promise(r => setTimeout(r, ms));
  });

beforeEach(() => {
  jest.clearAllMocks();
  setLanguage('en');
  spinApi.getSpinStatus.mockImplementation(async () => mockStatus());
  useWalletStore.setState({ credits: 0, minutes: 0 });
});

describe('wheel geometry (P18.T09)', () => {
  test('for every segment the final rotation puts that segment under the top pointer', () => {
    const n = 8;
    const seg = 360 / n;
    for (let i = 0; i < n; i++) {
      for (const jitter of [-1, 0, 1]) {
        const rot = rotationForIndex(i, n, jitter);
        // the point at angle (360 - rot) is under the pointer
        const under = (360 - rot + 360) % 360;
        expect(Math.floor(under / seg)).toBe(i);
      }
    }
  });
});

describe('SpinWheelScreen (P18)', () => {
  test('shows the real chances and "win up to 10"', async () => {
    const u = render(<SpinWheelScreen />);
    await flush();
    expect(u.getByTestId('spin-odds').props.children.join('')).toMatch(
      /Chances: 5 credits 98%.*10 credits 2%.*20 credits 0%/,
    );
    expect(u.getByText(/Win up to 10 credits/)).toBeTruthy();
    expect(u.getByText('Your free spin is ready!')).toBeTruthy();
  });

  test('T09/T12 server result first, then wheel stops, +5 shown, balance updated', async () => {
    spinApi.playSpin.mockResolvedValueOnce({ segmentIndex: 3, credits: 5, balance: 1005 });
    const u = render(<SpinWheelScreen />);
    await flush();
    spinApi.getSpinStatus.mockImplementation(async () =>
      mockStatus({ freeAvailable: false, nextFreeAt: new Date(Date.now() + 86400e3).toISOString() }),
    );
    await act(async () => fireEvent.press(u.getByTestId('spin-button')));
    await flush();
    expect(spinApi.playSpin).toHaveBeenCalledTimes(1);
    expect(u.getByText('You won 5 credits!')).toBeTruthy();
    expect(useWalletStore.getState().credits).toBe(1005);
    expect(u.getByText(/Next free spin in 2[34]:/)).toBeTruthy();
    expect(scheduleFreeSpinReminder).toHaveBeenCalled();
  });

  test('T17 network fails -> no animation, no prize, error toast', async () => {
    spinApi.playSpin.mockRejectedValueOnce(Object.assign(new Error('off'), { code: 'NETWORK' }));
    const u = render(<SpinWheelScreen />);
    await flush();
    await act(async () => fireEvent.press(u.getByTestId('spin-button')));
    await flush();
    expect(u.queryByText(/You won/)).toBeNull();
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: 'Could not spin' }));
    expect(useWalletStore.getState().credits).toBe(0);
  });

  test('T16 double tap spins once', async () => {
    let finish;
    spinApi.playSpin.mockImplementationOnce(() => new Promise(r => (finish = r)));
    const u = render(<SpinWheelScreen />);
    await flush();
    await act(async () => {
      fireEvent.press(u.getByTestId('spin-button'));
      fireEvent.press(u.getByTestId('spin-button'));
    });
    expect(spinApi.playSpin).toHaveBeenCalledTimes(1);
    await act(async () => finish({ segmentIndex: 0, credits: 5, balance: 5 }));
  });

  test('T13 a 0-credit result gets a calm message (no "big wins" promise)', async () => {
    spinApi.playSpin.mockResolvedValueOnce({ segmentIndex: 0, credits: 0, balance: 0 });
    const u = render(<SpinWheelScreen />);
    await flush();
    await act(async () => fireEvent.press(u.getByTestId('spin-button')));
    await flush();
    expect(u.getByText('No credits this time')).toBeTruthy();
    expect(u.queryByText(/big win/i)).toBeNull();
  });

  test('T14-T15 used up: countdown + "watch ad for extra spin" which unlocks a spin', async () => {
    spinApi.getSpinStatus.mockImplementation(async () =>
      mockStatus({ freeAvailable: false, nextFreeAt: new Date(Date.now() + 3600e3).toISOString(), extraSpinsLeft: 4 }),
    );
    ads.showRewarded.mockResolvedValueOnce({ status: 'rewarded', gained: 1 });
    const u = render(<SpinWheelScreen />);
    await flush();
    expect(u.getByTestId('spin-button').props.accessibilityState.disabled).toBe(true);
    expect(u.getByText(/Next free spin in 0[01]:/)).toBeTruthy();
    spinApi.getSpinStatus.mockImplementation(async () =>
      mockStatus({ freeAvailable: false, extraSpinsAvailable: 1, extraSpinsLeft: 3 }),
    );
    await act(async () => fireEvent.press(u.getByText(/Watch ad for extra spin \(4 left today\)/)));
    await flush();
    expect(ads.showRewarded).toHaveBeenCalledWith('extra_spin', {});
    expect(u.getByText('1 extra spin(s) ready')).toBeTruthy();
    expect(u.getByTestId('spin-button').props.accessibilityState.disabled).toBe(false);
  });

  test('prize first, then "watch ad & collect": credits only after the ad', async () => {
    spinApi.playSpin.mockResolvedValueOnce({
      spinId: 'spin-1',
      segmentIndex: 0,
      credits: 5,
      balance: 1000,
      claimRequired: true,
      claimVia: 'app',
    });
    ads.showRewarded.mockResolvedValueOnce({ status: 'rewarded', gained: 5 });
    const u = render(<SpinWheelScreen />);
    await flush();
    await act(async () => fireEvent.press(u.getByTestId('spin-button')));
    await flush();
    expect(u.getByText('You won 5 credits!')).toBeTruthy(); // the prize, not yet added
    expect(u.getByText('Watch a short ad to collect them.')).toBeTruthy();
    expect(useWalletStore.getState().credits).toBe(1000);
    await act(async () => fireEvent.press(u.getByText('WATCH AD & COLLECT')));
    await flush();
    expect(ads.showRewarded).toHaveBeenCalledWith('spin_claim', { refId: 'spin-1', claimVia: 'app' });
    expect(u.getByText('Added to your balance')).toBeTruthy();
  });

  test('"Later" keeps the prize: a collect button stays until the ad is watched', async () => {
    spinApi.getSpinStatus.mockImplementation(async () =>
      mockStatus({ freeAvailable: false, pendingClaim: { spinId: 'spin-9', credits: 5, claimVia: 'ssv' } }),
    );
    ads.showRewarded.mockResolvedValueOnce({ status: 'pending', gained: 0 });
    const u = render(<SpinWheelScreen />);
    await flush();
    await act(async () => fireEvent.press(u.getByTestId('spin-collect')));
    await flush();
    expect(ads.showRewarded).toHaveBeenCalledWith('spin_claim', { refId: 'spin-9', claimVia: 'ssv' });
    expect(Toast.show).toHaveBeenCalledWith(expect.objectContaining({ text1: 'Reward is on its way' }));
  });

  test('Hindi labels', async () => {
    setLanguage('hi');
    const u = render(<SpinWheelScreen />);
    await flush();
    expect(u.getByText('आपका फ़्री स्पिन तैयार है!')).toBeTruthy();
    expect(u.getByTestId('spin-odds').props.children.join('')).toMatch(/संभावना/);
  });
});
