import './helpers/nativeMocks';

jest.setTimeout(60000); // first render compiles a lot of modules (slower with --coverage)
import React from 'react';
import { render, act } from '@testing-library/react-native';
import { createSqlJsAdapter } from './helpers/sqljsAdapter';
import { setDbAdapter, initDatabase } from '@db/index';
import { useAuthStore } from '@store/authStore';
import { useWalletStore } from '@store/walletStore';
import { useCallStore } from '@store/callStore';

// Navigation hooks are replaced so every screen renders standalone.
const mockNav = {
  navigate: jest.fn(),
  goBack: jest.fn(),
  replace: jest.fn(),
  push: jest.fn(),
  setParams: jest.fn(),
  canGoBack: () => true,
};
let mockParams = {};
jest.mock('@react-navigation/native', () => {
  const actual = jest.requireActual('@react-navigation/native');
  const R = require('react');
  return {
    ...actual,
    useNavigation: () => mockNav,
    useRoute: () => ({ params: mockParams }),
    useFocusEffect: cb => R.useEffect(cb, [cb]),
  };
});

// API calls answer with realistic data so data-driven screens render fully.
const mockWalletConfig = {
  packages: [
    { id: 'minutes_80', priceInr: 100, minutes: 80, credits: 80000, badge: null },
    { id: 'minutes_270', priceInr: 300, minutes: 270, credits: 270000, badge: 'Best value' },
  ],
  ads: { todayCount: 3, max: 20, rewardCredits: 250, remaining: 17 },
  spin: {
    freeAvailable: false,
    nextFreeAt: new Date(Date.now() + 3600e3).toISOString(),
    extraSpinsAvailable: 0,
    extraSpinsLeft: 5,
    maxWin: 2000,
    segments: ['50', '100', '200', 'Try again', '300', '500', '1000', '2000'].map(label => ({ label, credits: 0 })),
  },
  checkin: { credits: 100, claimedToday: false },
  taxNote: 'Prices include GST.',
};
jest.mock('@services/api/walletApi', () => ({
  getWallet: jest.fn(async () => ({ credits: 12500, minutes: 12, lastEntries: [] })),
  getWalletConfig: jest.fn(async () => mockWalletConfig),
  getLedger: jest.fn(async () => ({
    items: [
      {
        id: '1',
        type: 'purchase',
        amount: 80000,
        balanceAfter: 80000,
        meta: { minutes: 80, receiptNo: 'CK-1' },
        createdAt: '2026-10-06T10:00:00Z',
      },
      {
        id: '2',
        type: 'call_charge',
        amount: -1017,
        balanceAfter: 78983,
        meta: { to: '+919876543210' },
        createdAt: '2026-10-06T11:00:00Z',
      },
    ],
    hasMore: false,
  })),
  claimCheckin: jest.fn(),
}));
jest.mock('@services/api/spinApi', () => ({
  getSpinStatus: jest.fn(async () => mockWalletConfig.spin),
  playSpin: jest.fn(),
}));
jest.mock('@services/api/authApi', () => ({
  getMe: jest.fn(async () => ({
    user: { id: 'u1', email: 'ravi@example.com', name: 'Ravi' },
    stats: { totalMinutesUsed: 42, totalCalls: 9 },
  })),
  updateMe: jest.fn(),
  sendOtp: jest.fn(),
  verifyOtp: jest.fn(),
  deleteMe: jest.fn(),
  healthCheck: jest.fn(),
  logoutSession: jest.fn(),
}));

const flush = async () => {
  await act(async () => {
    await new Promise(r => setTimeout(r, 30));
  });
};

beforeAll(async () => {
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
  const callLogRepo = require('@db/callLogRepo');
  const id = await callLogRepo.insert({
    number: '+919876543210',
    contactName: 'Ravi Kumar',
    startedAt: Date.now() - 60000,
  });
  await callLogRepo.finish(id, { status: 'completed', talkSeconds: 135, creditsUsed: 2250 });
  await callLogRepo.insert({ number: '+918888888888', status: 'busy' });
  useAuthStore.setState({
    user: { id: 'u1', email: 'ravi@example.com', name: 'Ravi', referralCode: 'AB12CD34' },
    status: 'authenticated',
  });
  useWalletStore.setState({ credits: 12500, minutes: 12, config: mockWalletConfig });
});

const SCREENS = [
  ['Splash', () => require('@screens/onboarding/SplashScreen').default, {}, 'CallingKaro'],
  ['Welcome', () => require('@screens/onboarding/WelcomeScreen').default, {}, 'OK'],
  ['Legal (terms)', () => require('@screens/onboarding/LegalScreen').default, { doc: 'terms' }, 'Terms of Use'],
  ['Legal (privacy)', () => require('@screens/onboarding/LegalScreen').default, { doc: 'privacy' }, 'Privacy Policy'],
  ['EmailEntry', () => require('@screens/auth/EmailEntryScreen').default, {}, 'SEND OTP'],
  [
    'OtpVerify',
    () => require('@screens/auth/OtpVerifyScreen').default,
    { email: 'ravi@example.com' },
    'Verify your email',
  ],
  ['Blocked', () => require('@screens/auth/BlockedScreen').default, {}, 'Account blocked'],
  ['Permission', () => require('@screens/permissions/PermissionScreen').default, { stepIndex: 0 }, 'address book'],
  ['Dialpad', () => require('@screens/dialpad/DialpadScreen').default, {}, 'CALL'],
  ['Contacts', () => require('@screens/contacts/ContactsScreen').default, {}, null],
  ['Recent', () => require('@screens/recent/RecentScreen').default, {}, 'Ravi Kumar'],
  ['CallDetails', () => require('@screens/recent/CallDetailsScreen').default, { id: 1 }, 'Call details'],
  ['GetMinutes', () => require('@screens/wallet/GetMinutesScreen').default, {}, 'Best value'],
  ['Packages', () => require('@screens/wallet/PackagesScreen').default, {}, 'Buy minutes'],
  ['WalletHistory', () => require('@screens/wallet/WalletHistoryScreen').default, {}, 'Wallet history'],
  ['SpinWheel', () => require('@screens/wallet/SpinWheelScreen').default, {}, 'SPIN'],
  ['Settings', () => require('@screens/settings/SettingsScreen').default, {}, 'Record all calls automatically'],
  ['Profile', () => require('@screens/settings/ProfileScreen').default, {}, 'ravi@example.com'],
  ['Recordings', () => require('@screens/settings/RecordingsScreen').default, {}, 'Recordings'],
  ['Help', () => require('@screens/settings/HelpScreen').default, {}, 'How do credits work?'],
  ['Report', () => require('@screens/settings/ReportScreen').default, {}, 'Send report'],
  ['About', () => require('@screens/settings/AboutScreen').default, {}, 'Open-source licenses'],
  ['ComponentGallery', () => require('@screens/dev/ComponentGallery').default, {}, 'Component Gallery'],
];

describe('every screen renders without crashing', () => {
  test.each(SCREENS)('%s', async (_name, load, params, expectText) => {
    mockParams = params;
    const Screen = load();
    const utils = render(<Screen />);
    await flush();
    if (expectText) {
      expect(utils.queryAllByText(new RegExp(expectText, 'i')).length).toBeGreaterThan(0);
    }
    utils.unmount();
  });

  test('InCall screen renders a live call', async () => {
    useCallStore.setState({
      activeCall: { localId: 1, number: '+919876543210', name: 'Ravi Kumar', maxSeconds: 750 },
      status: 'connected',
      answeredAt: Date.now() - 42000,
    });
    const InCall = require('@screens/call/InCallScreen').default;
    const utils = render(<InCall />);
    await flush();
    expect(utils.getAllByText('Ravi Kumar').length).toBeGreaterThan(0);
    expect(utils.getByText('Mute')).toBeTruthy();
    expect(utils.getByText(/via internet/i)).toBeTruthy();
    utils.unmount();
    useCallStore.getState().clear();
  });
});
