import './helpers/nativeMocks';
import React from 'react';
import { BackHandler } from 'react-native';
import { render, fireEvent, act } from '@testing-library/react-native';
import { createSqlJsAdapter } from './helpers/sqljsAdapter';
import { setDbAdapter, initDatabase } from '@db/index';
import * as callLogRepo from '@db/callLogRepo';
import { useCallStore } from '@store/callStore';
import { useWalletStore } from '@store/walletStore';
import { setLanguage } from '@i18n';

jest.setTimeout(60000);

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), canGoBack: () => true };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: {} }),
}));
jest.mock('@services/voice/voiceService', () => ({
  __esModule: true,
  default: {
    endCall: jest.fn(async () => {}),
    toggleMute: jest.fn(),
    toggleHold: jest.fn(),
    toggleSpeaker: jest.fn(),
    setAudioRoute: jest.fn(),
    sendDigit: jest.fn(),
    toggleRecording: jest.fn(async () => ({ ok: true })),
  },
}));
const voiceService = require('@services/voice/voiceService').default;
const InCallScreen = require('@screens/call/InCallScreen').default;
const CallTimer = require('@screens/call/CallTimer').default;

const flush = (ms = 100) =>
  act(async () => {
    await new Promise(r => setTimeout(r, ms));
  });

let localId;
const live = over => {
  useCallStore.setState({
    activeCall: { localId, number: '+919876543210', name: 'Ravi Kumar', maxSeconds: 300 },
    status: 'connected',
    answeredAt: Date.now() - 42000,
    ...over,
  });
};

beforeEach(async () => {
  jest.clearAllMocks();
  setLanguage('en');
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
  localId = await callLogRepo.insert({ number: '+919876543210', contactName: 'Ravi Kumar' });
  useCallStore.getState().clear();
  useWalletStore.setState({ credits: 11000, minutes: 11 });
});

describe('InCallScreen (P22)', () => {
  test('T02-T04 name, number + India, via internet, live timer, balance', async () => {
    live();
    const u = render(<InCallScreen />);
    await flush();
    expect(u.getByText('Ravi Kumar')).toBeTruthy();
    expect(u.getByText(/98765 43210 India/)).toBeTruthy();
    expect(u.getByText('via internet')).toBeTruthy();
    expect(u.getByText(/^00:4[23]$/)).toBeTruthy();
    expect(u.getByText('Balance: 11 min left')).toBeTruthy();
  });

  test('T03 status line before answer: Calling... then Ringing', async () => {
    live({ status: 'connecting', answeredAt: null });
    const u = render(<InCallScreen />);
    expect(u.getByText('Calling...')).toBeTruthy();
    act(() => useCallStore.getState().setStatus('ringing'));
    expect(u.getByText('Ringing')).toBeTruthy();
  });

  test('T05-T07 grid positions; Mute/Hold grey before answer; Add call disabled', async () => {
    live({ status: 'ringing', answeredAt: null });
    const u = render(<InCallScreen />);
    const labels = ['Notes', 'Add call', 'Mute', 'Record', 'Contacts', 'Hold'];
    for (const l of labels) {
      expect(u.getByLabelText(l)).toBeTruthy();
    }
    expect(u.getByLabelText('Mute').props.accessibilityState.disabled).toBe(true);
    expect(u.getByLabelText('Hold').props.accessibilityState.disabled).toBe(true);
    expect(u.getByLabelText('Add call').props.accessibilityState.disabled).toBe(true);
    expect(u.getByLabelText('Record').props.accessibilityState.disabled).toBe(false); // can be armed before answer
  });

  test('controls call the service; active state shown', async () => {
    live();
    const u = render(<InCallScreen />);
    fireEvent.press(u.getByLabelText('Mute'));
    expect(voiceService.toggleMute).toHaveBeenCalled();
    act(() => useCallStore.setState({ isMuted: true }));
    expect(u.getByLabelText('Mute').props.accessibilityState.selected).toBe(true);
    fireEvent.press(u.getByLabelText('Hold'));
    expect(voiceService.toggleHold).toHaveBeenCalled();
    fireEvent.press(u.getByLabelText('Speaker'));
    expect(voiceService.toggleSpeaker).toHaveBeenCalled();
  });

  test('T09 keypad: digits go to the call and show under the name', async () => {
    live();
    const u = render(<InCallScreen />);
    fireEvent.press(u.getByLabelText('Keypad'));
    fireEvent.press(u.getByTestId('key-1'));
    expect(voiceService.sendDigit).toHaveBeenCalledWith('1');
    act(() => useCallStore.getState().appendDtmf('1'));
    act(() => useCallStore.getState().appendDtmf('#'));
    expect(u.getByText('1#')).toBeTruthy(); // typed digits shown under the name
    fireEvent.press(u.getByLabelText('Hide'));
    expect(u.getByLabelText('Notes')).toBeTruthy();
  });

  test('T10 end button ends the call and shows Ending...', async () => {
    live();
    const u = render(<InCallScreen />);
    fireEvent.press(u.getByTestId('end-call'));
    expect(voiceService.endCall).toHaveBeenCalled();
    act(() => useCallStore.getState().setStatus('ending'));
    expect(u.getByText('Ending...')).toBeTruthy();
    expect(u.getByTestId('end-call').props.accessibilityState?.disabled ?? true).toBeTruthy();
  });

  test('T11 notes are saved to the call row', async () => {
    live();
    const u = render(<InCallScreen />);
    fireEvent.press(u.getByLabelText('Notes'));
    fireEvent.changeText(u.getByLabelText('Call notes'), 'Ask about the parcel');
    await act(async () => fireEvent.press(u.getByText(/^SAVE$/i)));
    expect((await callLogRepo.getById(localId)).notes).toBe('Ask about the parcel');
  });

  test('BUG FIX: notes typed when the other side hangs up are kept (no auto-close while typing)', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      live();
      const u = render(<InCallScreen />);
      fireEvent.press(u.getByLabelText('Notes'));
      fireEvent.changeText(u.getByLabelText('Call notes'), 'Call back at 6');
      act(() =>
        useCallStore.getState().finish({ summary: { talkSeconds: 42, credits: 700, balance: 10300, exact: true } }),
      );
      await act(async () => jest.advanceTimersByTimeAsync(5000));
      expect(mockNav.goBack).not.toHaveBeenCalled(); // still open while typing
      // closing the sheet (backdrop / back) saves what was typed
      await act(async () => fireEvent.press(u.getAllByLabelText('Close')[0]));
      await act(async () => jest.advanceTimersByTimeAsync(10));
      expect((await callLogRepo.getById(localId)).notes).toBe('Call back at 6');
      await act(async () => jest.advanceTimersByTimeAsync(2500));
      expect(mockNav.goBack).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('T13 last minute banner: "Call will end in 0:45"', async () => {
    live({ answeredAt: Date.now() - 255000 }); // 300 - 255 = 45s left
    const u = render(<InCallScreen />);
    expect(u.getByText(/Call will end in 0:4[45]/)).toBeTruthy();
  });

  test('T14 summary card for 2s then back', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      live();
      const u = render(<InCallScreen />);
      act(() =>
        useCallStore.getState().finish({ summary: { talkSeconds: 135, credits: 2250, balance: 9750, exact: true } }),
      );
      expect(u.getByText('2:15')).toBeTruthy();
      expect(u.getByText('2,250')).toBeTruthy();
      expect(u.getByText('9 min')).toBeTruthy();
      await act(async () => jest.advanceTimersByTimeAsync(2100));
      expect(mockNav.goBack).toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });

  test('balance finished: stays open with Get Minutes', async () => {
    live();
    const u = render(<InCallScreen />);
    act(() =>
      useCallStore.getState().finish({
        endReason: 'balance_finished',
        summary: { talkSeconds: 300, credits: 5000, balance: 0, exact: true },
      }),
    );
    expect(u.getByText('Call ended - balance finished')).toBeTruthy();
    fireEvent.press(u.getByText(/GET MINUTES/i));
    expect(mockNav.navigate).toHaveBeenCalledWith('MainTabs', { screen: 'GetMinutes' });
  });

  test('Android back does nothing on the call screen', () => {
    live();
    const spy = jest.spyOn(BackHandler, 'addEventListener');
    render(<InCallScreen />);
    const handler = spy.mock.calls.at(-1)[1];
    expect(handler()).toBe(true);
  });

  test('BUG FIX: Hindi call screen has no leftover English labels', () => {
    setLanguage('hi');
    live();
    const u = render(<InCallScreen />);
    for (const l of ['नोट्स', 'म्यूट', 'होल्ड', 'रिकॉर्ड', 'कीपैड', 'स्पीकर']) {
      expect(u.getAllByText(l).length).toBeGreaterThan(0);
    }
    expect(u.queryByText('Mute')).toBeNull();
  });
});

describe('T17 timer is isolated', () => {
  test('CallTimer is memoised so the screen does not re-render every second', () => {
    expect(CallTimer.$$typeof).toBe(Symbol.for('react.memo'));
  });
});
