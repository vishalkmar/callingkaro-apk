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
const { navigate } = require('@navigation/navigationRef');
const voiceApi = require('@services/api/voiceApi');

beforeEach(async () => {
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
  useCallStore.getState().clear();
});

const flush = () => new Promise(r => setTimeout(r, 0));

describe('voiceService call state machine', () => {
  test('dialing -> ringing -> connected -> ended, row finished with the server charge', async () => {
    expect(await voiceService.startCall({ number: '+919876543210', name: 'Ravi' })).toBe(true);
    expect(navigate).toHaveBeenCalledWith('InCall');
    expect(useCallStore.getState().status).toBe('connecting');
    const localId = useCallStore.getState().activeCall.localId;
    expect((await callLogRepo.getById(localId)).status).toBe('dialing');

    await mockCallHandlers.Ringing();
    expect(useCallStore.getState().status).toBe('ringing');
    expect((await callLogRepo.getById(localId)).callSid).toMatch(/^CA/);

    await mockCallHandlers.Connected();
    expect(useCallStore.getState().status).toBe('connected');

    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    const done = voiceService.endCall();
    await done;
    await jest.advanceTimersByTimeAsync(6000);
    jest.useRealTimers();
    await flush();

    expect(useCallStore.getState().status).toBe('ended');
    const row = await callLogRepo.getById(localId);
    expect(row.status).toBe('completed');
    expect(row.creditsUsed).toBe(1017); // exact charge from the server replaces the local estimate
    expect(row.reconciled).toBe(true);
  });

  test('server refuses the token -> no InCall screen, row marked failed', async () => {
    voiceApi.getVoiceToken.mockRejectedValueOnce(Object.assign(new Error('down'), { code: 'NETWORK' }));
    navigate.mockClear();
    expect(await voiceService.startCall({ number: '+919876543210' })).toBe(false);
    expect(navigate).not.toHaveBeenCalled();
    const [row] = await callLogRepo.listRecent({ limit: 1 });
    expect(row.status).toBe('failed');
    expect(useCallStore.getState().activeCall).toBeNull();
  });

  test('a second call is blocked while one is active', async () => {
    await voiceService.startCall({ number: '+919876543210' });
    expect(await voiceService.startCall({ number: '+918888888888' })).toBe(false);
  });

  test('error codes map to user messages', () => {
    expect(voiceService.mapVoiceError({ code: 31486 }).code).toBe('BUSY');
    expect(voiceService.mapVoiceError({ code: 20104 }).code).toBe('TOKEN');
    expect(voiceService.mapVoiceError({ code: 53405 }).code).toBe('NETWORK');
    expect(voiceService.mapVoiceError({ code: 99999 }).code).toBe('PROVIDER');
  });
});
