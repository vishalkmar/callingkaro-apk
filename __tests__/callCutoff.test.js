import { createSqlJsAdapter } from './helpers/sqljsAdapter';
import { setDbAdapter, initDatabase } from '@db/index';
import * as callLogRepo from '@db/callLogRepo';
import { useCallStore } from '@store/callStore';

// ---- mocked Twilio SDK: a fake call we can drive by emitting events ----
const mockCallHandlers = {};
const mockCall = {
  on: jest.fn((ev, fn) => {
    mockCallHandlers[ev] = fn;
  }),
  getSid: jest.fn(() => 'CA0123456789abcdef0123456789abcdef'),
  disconnect: jest.fn(async () => mockCallHandlers.Disconnected?.()),
  mute: jest.fn(async () => true),
  hold: jest.fn(async () => true),
  sendDigits: jest.fn(async () => {}),
};
jest.mock('@twilio/voice-react-native-sdk', () => {
  const Voice = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn(async () => mockCall),
    getAudioDevices: jest.fn(async () => ({ audioDevices: [], selectedDevice: null })),
  }));
  Voice.Event = { AudioDevicesUpdated: 'audioDevicesUpdated', Error: 'error' };
  return {
    Voice,
    Call: {
      Event: {
        Ringing: 'Ringing',
        Connected: 'Connected',
        Disconnected: 'Disconnected',
        ConnectFailure: 'ConnectFailure',
        Reconnecting: 'Reconnecting',
        Reconnected: 'Reconnected',
      },
    },
    AudioDevice: { Type: { Earpiece: 'earpiece', Speaker: 'speaker', Bluetooth: 'bluetooth' } },
  };
});
jest.mock('react-native-incall-manager', () => ({
  setKeepScreenOn: jest.fn(),
  startProximitySensor: jest.fn(),
  stopProximitySensor: jest.fn(),
}));
jest.mock('react-native-sound', () => {
  const S = jest.fn().mockImplementation(() => ({ isLoaded: () => false }));
  S.setCategory = jest.fn();
  S.MAIN_BUNDLE = '';
  return S;
});
jest.mock('@services/api/voiceApi', () => ({
  getVoiceToken: jest.fn(async () => ({ token: 'jwt', maxSeconds: 135, credits: 2250 })),
  getCall: jest.fn(async () => ({
    billed: true,
    status: 'completed',
    talkSeconds: 61,
    credits: 1017,
    callerId: '+911140000001',
  })),
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
}));
jest.mock('@services/api/walletApi', () => ({
  getWallet: jest.fn(async () => ({ credits: 1233 })),
  getWalletConfig: jest.fn(),
}));
jest.mock('@navigation/navigationRef', () => ({ navigate: jest.fn() }));
jest.mock('@services/permissions/permissions', () => ({
  check: jest.fn(async () => 'granted'),
  STATUS: { GRANTED: 'granted' },
}));
jest.mock('@services/recording/recordingService', () => ({ downloadForCall: jest.fn(async () => {}) }));
jest.mock('@services/review/ratePrompt', () => ({ onSuccessfulCall: jest.fn() }));

const voiceService = require('@services/voice/voiceService').default;

beforeEach(async () => {
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
  useCallStore.getState().clear();
});

jest.mock('@services/audio/tones', () => ({
  beep: jest.fn(),
  doubleBeep: jest.fn(),
  haptic: jest.fn(),
  keyFeedback: jest.fn(),
}));

const { Voice, AudioDevice } = require('@twilio/voice-react-native-sdk');
const tones = require('@services/audio/tones');
const { useSettingsStore } = require('@store/settingsStore');

voiceService.init();
const voiceInstance = Voice.mock.results[0].value;
const devicesHandler = voiceInstance.on.mock.calls.find(([ev]) => ev === 'audioDevicesUpdated')[1];

const device = type => ({ type, select: jest.fn(async () => {}) });
const wait = ms => new Promise(r => setTimeout(r, ms));

beforeEach(() => {
  Object.keys(mockCallHandlers).forEach(k => delete mockCallHandlers[k]);
  useSettingsStore.setState({ speakerDefault: false, vibrateOnConnect: false });
  tones.beep.mockClear();
});

describe('audio routes (P24.T15)', () => {
  const setDevices = list =>
    voiceInstance.getAudioDevices.mockResolvedValue({ audioDevices: list, selectedDevice: list[0] });

  test('BUG FIX: headphones/Bluetooth removed -> Android falls back to speaker -> app moves it to earpiece', async () => {
    const ear = device('earpiece');
    const spk = device('speaker');
    setDevices([ear, spk]);
    await voiceService.startCall({ number: '+919876543210' });
    await mockCallHandlers.Connected();
    devicesHandler([ear, spk, device('bluetooth')], device('bluetooth'));
    devicesHandler([ear, spk], spk); // headset gone, OS picked the loudspeaker
    await wait(10);
    expect(ear.select).toHaveBeenCalled();
    expect(useCallStore.getState().audioRoute).toBe('earpiece');
    await voiceService.endCall();
    await wait(10);
  });

  test('speaker the user chose is kept when devices change', async () => {
    const ear = device('earpiece');
    const spk = device('speaker');
    setDevices([ear, spk]);
    await voiceService.startCall({ number: '+919876543210' });
    await mockCallHandlers.Connected();
    voiceInstance.getAudioDevices.mockResolvedValue({ audioDevices: [ear, spk], selectedDevice: ear });
    await voiceService.toggleSpeaker();
    expect(spk.select).toHaveBeenCalled();
    ear.select.mockClear();
    devicesHandler([ear, spk], spk);
    await wait(10);
    expect(ear.select).not.toHaveBeenCalled();
    await voiceService.endCall();
    await wait(10);
  });

  test('"speaker by default" counts as the user choice', async () => {
    useSettingsStore.setState({ speakerDefault: true });
    const ear = device('earpiece');
    const spk = device('speaker');
    setDevices([ear, spk]);
    await voiceService.startCall({ number: '+919876543210' });
    await mockCallHandlers.Connected();
    await wait(10);
    expect(spk.select).toHaveBeenCalled();
    ear.select.mockClear();
    devicesHandler([ear, spk], spk);
    await wait(10);
    expect(ear.select).not.toHaveBeenCalled();
    await voiceService.endCall();
    await wait(10);
  });
});

describe('balance cut-off (P24.T02-T03, T06)', () => {
  test('soft beeps 30s and 10s before the server time limit', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      await voiceService.startCall({ number: '+919876543210' }); // token: maxSeconds 135
      await mockCallHandlers.Connected();
      await jest.advanceTimersByTimeAsync(104000);
      expect(tones.beep).toHaveBeenCalledTimes(0);
      await jest.advanceTimersByTimeAsync(1100); // 105s = 30s left
      expect(tones.beep).toHaveBeenCalledTimes(1);
      await jest.advanceTimersByTimeAsync(20000); // 125s = 10s left
      expect(tones.beep).toHaveBeenCalledTimes(2);
      await voiceService.endCall();
      await jest.advanceTimersByTimeAsync(10);
    } finally {
      jest.useRealTimers();
    }
  });

  test('network drop -> Reconnecting..., back -> connected; drop for good -> talked seconds kept', async () => {
    await voiceService.startCall({ number: '+919876543210' });
    await mockCallHandlers.Connected();
    mockCallHandlers.Reconnecting({ code: 53405 });
    expect(useCallStore.getState().status).toBe('reconnecting');
    mockCallHandlers.Reconnected();
    expect(useCallStore.getState().status).toBe('connected');
    mockCallHandlers.Reconnecting({ code: 53405 });
    await mockCallHandlers.Disconnected({ code: 53405 });
    await wait(10);
    const [row] = await callLogRepo.listRecent({ limit: 1 });
    expect(row.status).toBe('completed'); // it was answered: billed for what was talked
    expect(useCallStore.getState().error).toBeNull();
  });

  test('beep timers are cancelled when the call ends early', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      await voiceService.startCall({ number: '+919876543210' });
      await mockCallHandlers.Connected();
      await voiceService.endCall();
      await jest.advanceTimersByTimeAsync(200000);
      expect(tones.beep).not.toHaveBeenCalled();
    } finally {
      jest.useRealTimers();
    }
  });
});

test('AudioDevice types used by the app exist in the SDK enum', () => {
  expect(AudioDevice.Type.Speaker).toBe('speaker');
});
