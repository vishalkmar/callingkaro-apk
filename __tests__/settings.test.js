import './helpers/nativeMocks';
import React from 'react';
import { Share } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSettingsStore, DEFAULT_SETTINGS } from '@store/settingsStore';
import { useAuthStore } from '@store/authStore';
import { useAppStore } from '@store/appStore';
import { setLanguage, t } from '@i18n';

jest.setTimeout(60000);

const mockNav = { navigate: jest.fn(), goBack: jest.fn() };
let mockParams = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: mockParams }),
  useFocusEffect: cb => require('react').useEffect(cb, [cb]),
}));
jest.mock('@services/permissions/permissions', () => ({
  PERMISSION_NAMES: ['contacts', 'microphone', 'notifications', 'bluetooth', 'storage'],
  STATUS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
  checkAll: jest.fn(async () => ({
    contacts: 'granted',
    microphone: 'blocked',
    notifications: 'denied',
    bluetooth: 'unavailable',
    storage: 'granted',
  })),
  request: jest.fn(async () => 'granted'),
  openSettings: jest.fn(),
}));
jest.mock('@services/recording/recordingService', () => ({
  totalRecordingsSize: jest.fn(async () => 3 * 1024 * 1024),
  deleteAllRecordings: jest.fn(async () => {}),
  clearHistoryAndRecordings: jest.fn(async () => {}),
  wipeLocalData: jest.fn(async () => {}),
}));
jest.mock('@services/api/authApi', () => ({
  deleteMe: jest.fn(async () => ({ deleted: true })),
  logoutSession: jest.fn(async () => {}),
  getMe: jest.fn(async () => ({
    user: { id: 'u1', email: 'ravi@example.com', name: 'Ravi', createdAt: '2026-10-01' },
    stats: { totalMinutesUsed: 42, totalCalls: 9 },
  })),
  updateMe: jest.fn(async ({ name }) => ({ user: { id: 'u1', email: 'ravi@example.com', name } })),
}));
jest.mock('@services/api/reportApi', () => ({ submitReport: jest.fn(async () => ({ id: 'r1' })) }));
jest.mock('@services/api/walletApi', () => ({ getWallet: jest.fn(async () => ({ credits: 0 })) }));

const perms = require('@services/permissions/permissions');
const recording = require('@services/recording/recordingService');
const authApi = require('@services/api/authApi');
const reportApi = require('@services/api/reportApi');
const SettingsScreen = require('@screens/settings/SettingsScreen').default;
const ProfileScreen = require('@screens/settings/ProfileScreen').default;
const HelpScreen = require('@screens/settings/HelpScreen').default;
const ReportScreen = require('@screens/settings/ReportScreen').default;

const flush = (ms = 100) =>
  act(async () => {
    await new Promise(r => setTimeout(r, ms));
  });

beforeEach(() => {
  jest.clearAllMocks();
  setLanguage('en');
  mockParams = {};
  useSettingsStore.setState({ ...DEFAULT_SETTINGS });
  useAuthStore.setState({
    user: { id: 'u1', email: 'ravi@example.com', referralCode: 'AB12CD34' },
    status: 'authenticated',
  });
  useAppStore.setState({ stage: 'main' });
});

describe('Settings (P25.T03-T07, T16, T18)', () => {
  test('toggles persist and apply at once', async () => {
    const u = render(<SettingsScreen />);
    await flush();
    fireEvent.press(u.getByLabelText(/Record all calls automatically/));
    fireEvent.press(u.getByLabelText('Speaker by default'));
    fireEvent.press(u.getByLabelText('Keypad tones'));
    expect(useSettingsStore.getState()).toMatchObject({
      recordAllCalls: true,
      speakerDefault: true,
      keypadTones: false,
    });
    await flush(50);
    expect(JSON.parse(await AsyncStorage.getItem('settings')).state.recordAllCalls).toBe(true);
  });

  test('permission list shows live status; blocked/granted open system settings, denied asks', async () => {
    const u = render(<SettingsScreen />);
    await flush();
    expect(u.getByLabelText('Microphone. Blocked - open Settings')).toBeTruthy();
    expect(u.getByLabelText('Bluetooth. Not needed on this phone')).toBeTruthy();
    fireEvent.press(u.getByLabelText('Microphone. Blocked - open Settings'));
    expect(perms.openSettings).toHaveBeenCalled();
    await act(async () => fireEvent.press(u.getByLabelText('Notifications. Not allowed')));
    expect(perms.request).toHaveBeenCalledWith('notifications');
  });

  test('recordings size shown; delete all asks first', async () => {
    const u = render(<SettingsScreen />);
    await flush();
    expect(u.getByText('3.0 MB used')).toBeTruthy();
    fireEvent.press(u.getByText('Delete all recordings'));
    expect(recording.deleteAllRecordings).not.toHaveBeenCalled();
    await act(async () => fireEvent.press(u.getByText(/^DELETE$/i)));
    expect(recording.deleteAllRecordings).toHaveBeenCalled();
  });

  test('BUG FIX: share text has no empty "Use my code" when there is no referral code', async () => {
    const share = jest.spyOn(Share, 'share').mockResolvedValue({});
    useAuthStore.setState({ user: { id: 'u1', email: 'ravi@example.com', referralCode: null } });
    const u = render(<SettingsScreen />);
    await flush();
    fireEvent.press(u.getByText('Share app'));
    expect(share.mock.calls[0][0].message).not.toMatch(/code/i);
    expect(share.mock.calls[0][0].message).toMatch(/play.google.com/);
    useAuthStore.setState({ user: { id: 'u1', email: 'ravi@example.com', referralCode: 'AB12CD34' } });
    const v = render(<SettingsScreen />);
    await flush();
    fireEvent.press(v.getAllByText('Share app').at(-1));
    expect(share.mock.calls[1][0].message).toMatch(/Use my code AB12CD34/);
  });

  test('BUG FIX: delete account signs out even if wiping local files fails', async () => {
    recording.wipeLocalData.mockRejectedValueOnce(new Error('disk'));
    const u = render(<SettingsScreen />);
    await flush();
    fireEvent.press(u.getByText('Delete account'));
    await act(async () => fireEvent.press(u.getByText(/^DELETE$/i)));
    await flush();
    expect(authApi.deleteMe).toHaveBeenCalled();
    expect(useAppStore.getState().stage).toBe('auth');
    expect(useAuthStore.getState().user).toBeNull();
  });

  test('language switch: Hindi texts everywhere in Settings', async () => {
    const u = render(<SettingsScreen />);
    await flush();
    fireEvent.press(u.getByText('Language'));
    expect(useSettingsStore.getState().language).toBe('hi');
    setLanguage('hi'); // App.js does this and remounts
    const v = render(<SettingsScreen />);
    await flush();
    for (const s of ['खाता', 'हर कॉल अपने आप रिकॉर्ड करें', 'अनुमतियाँ', 'लॉग आउट', 'खाता हटाएँ']) {
      expect(v.getAllByText(s).length).toBeGreaterThan(0);
    }
    expect(v.queryByText('Logout')).toBeNull();
  });
});

describe('Profile / Help / Report', () => {
  test('profile: email read-only, name saved, stats', async () => {
    const u = render(<ProfileScreen />);
    await flush();
    expect(u.getByText('ravi@example.com')).toBeTruthy();
    expect(u.getByText('42')).toBeTruthy();
    fireEvent.changeText(u.getByDisplayValue('Ravi'), '  Ravi Kumar ');
    await act(async () => fireEvent.press(u.getByText(/^SAVE$/i)));
    expect(authApi.updateMe).toHaveBeenCalledWith({ name: 'Ravi Kumar' });
    expect(useAuthStore.getState().user.name).toBe('Ravi Kumar');
  });

  test('help FAQ in both languages; every question has an answer', () => {
    for (const lang of ['en', 'hi']) {
      setLanguage(lang);
      for (let n = 1; n <= 8; n++) {
        expect(t(`help.q${n}`)).not.toBe(`help.q${n}`);
        expect(t(`help.a${n}`)).not.toBe(`help.a${n}`);
      }
    }
    setLanguage('hi');
    const u = render(<HelpScreen />);
    expect(u.getByText('क्रेडिट कैसे काम करते हैं?')).toBeTruthy();
    expect(u.getByText(/1000 क्रेडिट = 1 मिनट/)).toBeTruthy(); // first answer open
  });

  test('report sends the reason key (not the translated label)', async () => {
    setLanguage('hi');
    mockParams = { number: '+919876543210', callSid: 'CA1' };
    const u = render(<ReportScreen />);
    fireEvent.press(u.getByText('धोखाधड़ी / ठगी'));
    await act(async () => fireEvent.press(u.getByText('शिकायत भेजें')));
    expect(reportApi.submitReport).toHaveBeenCalledWith({
      targetNumber: '+919876543210',
      reason: 'fraud',
      details: '',
      callSid: 'CA1',
    });
    expect(mockNav.goBack).toHaveBeenCalled();
  });
});

describe('rate prompt (P25.T15)', () => {
  test('asks once, after the 5th successful call', async () => {
    const InAppReview = require('react-native-in-app-review');
    InAppReview.isAvailable = () => true;
    InAppReview.RequestInAppReview = jest.fn(async () => true);
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const { onSuccessfulCall } = require('@services/review/ratePrompt');
      for (let i = 0; i < 4; i++) {
        await onSuccessfulCall();
      }
      await jest.advanceTimersByTimeAsync(3000);
      expect(InAppReview.RequestInAppReview).not.toHaveBeenCalled();
      await onSuccessfulCall();
      await jest.advanceTimersByTimeAsync(3000);
      expect(InAppReview.RequestInAppReview).toHaveBeenCalledTimes(1);
      await onSuccessfulCall();
      await jest.advanceTimersByTimeAsync(3000);
      expect(InAppReview.RequestInAppReview).toHaveBeenCalledTimes(1);
    } finally {
      jest.useRealTimers();
    }
  });
});
