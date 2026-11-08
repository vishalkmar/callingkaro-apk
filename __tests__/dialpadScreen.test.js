import './helpers/nativeMocks';
import React from 'react';
import { Vibration } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import Clipboard from '@react-native-clipboard/clipboard';
import { createSqlJsAdapter } from './helpers/sqljsAdapter';
import { setDbAdapter, initDatabase } from '@db/index';
import * as contactsRepo from '@db/contactsRepo';
import { useWalletStore } from '@store/walletStore';
import { useSettingsStore } from '@store/settingsStore';
import { useCallGateStore } from '@store/callGateStore';
import { validateDialInput, isShortOrEmergencyCode } from '@utils/phone';

jest.setTimeout(30000);

const mockNav = { navigate: jest.fn(), setParams: jest.fn() };
let mockParams = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: mockParams }),
  useFocusEffect: cb => require('react').useEffect(cb, [cb]),
}));
let mockPerm = 'granted';
jest.mock('@services/permissions/permissions', () => ({
  check: jest.fn(async () => mockPerm),
  request: jest.fn(async () => mockPerm),
  openSettings: jest.fn(),
  STATUS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));
let mockOnline = true;
jest.mock('@hooks/useNetwork', () => ({
  useNetwork: () => ({ isOnline: mockOnline }),
  isOnlineNow: async () => mockOnline,
}));
jest.mock('@services/voice/voiceService', () => ({
  __esModule: true,
  default: { startCall: jest.fn(async () => true) },
}));
jest.mock('@services/api/walletApi', () => ({ getWallet: jest.fn(async () => ({ credits: 0 })) }));

const voiceService = require('@services/voice/voiceService').default;
const toast = require('react-native-toast-message').default;
const DialpadScreen = require('@screens/dialpad/DialpadScreen').default;

const flush = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 500));
  });
const type = (u, digits) => digits.split('').forEach(d => fireEvent.press(u.getByTestId(`key-${d}`)));
const shown = u => u.getByTestId('dial-number').props.children;
const callBtn = u => u.getByTestId('call-button');

beforeAll(async () => {
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
  await contactsRepo.bulkUpsert([
    { id: 'c1', name: 'Ravi Kumar', numbers: [{ e164: '+919876543210', label: 'mobile' }] },
    { id: 'c2', name: 'Raju', numbers: [{ e164: '+919812345678', label: 'mobile' }] },
  ]);
});

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  mockPerm = 'granted';
  mockOnline = true;
  useWalletStore.setState({ credits: 12000, minutes: 12 });
  useCallGateStore.getState().close();
  useSettingsStore.setState({ keypadTones: true, haptics: true });
});

describe('Dialpad (P12)', () => {
  test('T08/T11/T12: auto-format, grey -> green CALL, balance chip', async () => {
    const u = render(<DialpadScreen />);
    await flush();
    expect(u.getByText('Balance: 12 min')).toBeTruthy();
    expect(callBtn(u).props.accessibilityState.disabled).toBe(true);
    type(u, '98765');
    expect(callBtn(u).props.accessibilityState.disabled).toBe(true);
    type(u, '43210');
    expect(shown(u)).toBe('98765 43210');
    expect(callBtn(u).props.accessibilityState.disabled).toBe(false);
    expect(u.getByText('IN +91')).toBeTruthy();
  });

  test('T10: T9 suggestions by name digits (7284 = RAVI) and by number; tap fills the number', async () => {
    const u = render(<DialpadScreen />);
    await flush(); // contacts permission resolved
    type(u, '7284');
    await flush();
    expect(u.getByText('Ravi Kumar')).toBeTruthy();
    fireEvent.press(u.getByLabelText(/Use Ravi Kumar/));
    await flush();
    expect(shown(u).replace(/\s/g, '')).toBe('+919876543210');
    expect(u.getAllByText('Ravi Kumar').length).toBeGreaterThan(0); // exact-match name under the number
  });

  test('T06: key tone + haptic, both switch off from Settings', () => {
    const u = render(<DialpadScreen />);
    type(u, '5');
    expect(Vibration.vibrate).toHaveBeenCalled();
    Vibration.vibrate.mockClear();
    useSettingsStore.setState({ haptics: false, keypadTones: false });
    type(u, '5');
    expect(Vibration.vibrate).not.toHaveBeenCalled();
  });

  test('T07: long-press number pastes a cleaned number', async () => {
    Clipboard.getString.mockResolvedValueOnce(' +91-98765 43210 ');
    const u = render(<DialpadScreen />);
    await act(async () => fireEvent(u.getByLabelText(/long press to paste/i), 'longPress'));
    expect(shown(u)).toBe('+91 98765 43210');
  });

  test('T18: prefill param fills the number once', async () => {
    mockParams = { prefill: encodeURIComponent('+91 98123 45678') };
    const u = render(<DialpadScreen />);
    await flush();
    expect(shown(u).replace(/\s/g, '')).toBe('+919812345678');
    expect(mockNav.setParams).toHaveBeenCalledWith({ prefill: undefined });
  });

  test('T17: valid number + credits + mic -> voiceService.startCall with E.164 and contact name', async () => {
    const u = render(<DialpadScreen />);
    await flush();
    type(u, '9876543210');
    await flush();
    await act(async () => fireEvent.press(callBtn(u)));
    expect(voiceService.startCall).toHaveBeenCalledWith({ number: '+919876543210', name: 'Ravi Kumar' });
  });

  test('T13: under 1 minute of credits -> Not enough credits dialog, no call', async () => {
    useWalletStore.setState({ credits: 999, minutes: 0 });
    const u = render(<DialpadScreen />);
    type(u, '9876543210');
    await act(async () => fireEvent.press(callBtn(u)));
    expect(useCallGateStore.getState().dialog).toBe('credits');
    expect(voiceService.startCall).not.toHaveBeenCalled();
  });

  test('T14: microphone not granted -> mic dialog with the number kept for later', async () => {
    mockPerm = 'denied';
    const u = render(<DialpadScreen />);
    type(u, '9876543210');
    await act(async () => fireEvent.press(callBtn(u)));
    expect(useCallGateStore.getState()).toMatchObject({ dialog: 'mic', pending: { number: '+919876543210' } });
  });

  test('T15: offline -> CALL disabled; if the network drops after tapping -> toast', async () => {
    mockOnline = false;
    const u = render(<DialpadScreen />);
    type(u, '9876543210');
    expect(callBtn(u).props.accessibilityState.disabled).toBe(true);
    const { placeCall } = require('@services/calls/placeCall');
    await placeCall({ number: '9876543210' });
    expect(toast.show).toHaveBeenCalledWith(expect.objectContaining({ type: 'error' }));
    expect(voiceService.startCall).not.toHaveBeenCalled();
  });

  test('T16: 112 -> "use your phone dialer" dialog instead of a call', async () => {
    const u = render(<DialpadScreen />);
    type(u, '112');
    expect(callBtn(u).props.accessibilityState.disabled).toBe(false);
    await act(async () => fireEvent.press(callBtn(u)));
    expect(useCallGateStore.getState().dialog).toBe('emergency');
    expect(voiceService.startCall).not.toHaveBeenCalled();
  });

  test('BUG FIX: toll-free number -> CALL grey with the reason shown', () => {
    const u = render(<DialpadScreen />);
    type(u, '1800123456');
    expect(callBtn(u).props.accessibilityState.disabled).toBe(true);
    expect(u.getByTestId('dial-hint').props.children).toMatch(/Toll-free/);
  });

  test('double tap on CALL starts one call', async () => {
    voiceService.startCall.mockImplementation(() => new Promise(r => setTimeout(() => r(true), 50)));
    const u = render(<DialpadScreen />);
    type(u, '9876543210');
    await act(async () => {
      fireEvent.press(callBtn(u));
      fireEvent.press(callBtn(u));
      await new Promise(r => setTimeout(r, 100));
    });
    expect(voiceService.startCall).toHaveBeenCalledTimes(1);
  });

  test('max length 18 characters', () => {
    const u = render(<DialpadScreen />);
    type(u, '12345678901234567890123');
    expect(shown(u).replace(/\s/g, '').length).toBeLessThanOrEqual(18);
  });
});

describe('number rules matrix (P12.T16)', () => {
  test.each([
    ['9876543210', true],
    ['6000000000', true],
    ['022 2345 6789', true],
    ['0522 234 5678', true],
    ['98765432', false],
    ['1800123456', false],
    ['+91 1800 123 456', false],
    ['18601234567', false],
    ['+1 202 555 0101', false],
  ])('%s ok=%s', (raw, ok) => {
    expect(validateDialInput(raw).ok).toBe(ok);
  });

  test.each(['100', '112', '+91 112', '0091112', '1098', '*121#'])('%s -> phone dialer', raw => {
    expect(validateDialInput(raw).reason).toBe('emergency');
    expect(isShortOrEmergencyCode(raw)).toBe(true);
  });
});
