// Telnyx as the calling provider in the app: the adapter (Telnyx SDK -> Twilio-like call) and
// voiceService following the provider the SERVER chose with the token.
import { createSqlJsAdapter } from './helpers/sqljsAdapter';
import { setDbAdapter, initDatabase } from '@db/index';
import * as callLogRepo from '@db/callLogRepo';
import { useCallStore } from '@store/callStore';

const EVENTS = {
  Ringing: 'Ringing',
  Connected: 'Connected',
  Disconnected: 'Disconnected',
  ConnectFailure: 'ConnectFailure',
  Reconnecting: 'Reconnecting',
  Reconnected: 'Reconnected',
};

// ---- fake Telnyx SDK: a client + call we drive by hand ----
const mockState = { loginFails: false, neverReady: false, client: null, call: null };
const emitter = () => {
  const handlers = {};
  return {
    on: jest.fn((ev, fn) => {
      (handlers[ev] = handlers[ev] || []).push(fn);
    }),
    fire: (ev, ...args) => (handlers[ev] || []).forEach(fn => fn(...args)),
  };
};
jest.mock('@telnyx/react-native-voice-sdk', () => ({
  TelnyxRTC: jest.fn().mockImplementation(opts => {
    const c = emitter();
    c.opts = opts;
    c.connect = jest.fn(async () => {
      if (mockState.loginFails) {
        c.fire('telnyx.client.error', new Error('bad token'));
      } else if (!mockState.neverReady) {
        c.fire('telnyx.client.ready');
      }
    });
    c.disconnect = jest.fn();
    c.newCall = jest.fn(async options => {
      const call = emitter();
      call.options = options;
      call.hangup = jest.fn(async () => call.fire('telnyx.call.state', call, 'ended'));
      call.mute = jest.fn();
      call.unmute = jest.fn();
      call.hold = jest.fn(async () => {});
      call.unhold = jest.fn(async () => {});
      call.dtmf = jest.fn(async () => {});
      mockState.call = call;
      return call;
    });
    mockState.client = c;
    return c;
  }),
}));
jest.mock('@twilio/voice-react-native-sdk', () => {
  const Voice = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    getAudioDevices: jest.fn(async () => ({ audioDevices: [], selectedDevice: null })),
  }));
  Voice.Event = { AudioDevicesUpdated: 'audioDevicesUpdated', Error: 'error' };
  return { Voice, Call: { Event: EVENTS }, AudioDevice: { Type: { Earpiece: 'earpiece', Speaker: 'speaker' } } };
});
jest.mock('react-native-incall-manager', () => ({
  setKeepScreenOn: jest.fn(),
  startProximitySensor: jest.fn(),
  stopProximitySensor: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  setForceSpeakerphoneOn: jest.fn(),
}));
jest.mock('react-native-sound', () => {
  const S = jest.fn().mockImplementation(() => ({ isLoaded: () => false }));
  S.setCategory = jest.fn();
  S.MAIN_BUNDLE = '';
  return S;
});
const TX = 'TX0123456789abcdef0123456789abcdef';
jest.mock('@services/api/voiceApi', () => ({
  getVoiceToken: jest.fn(async () => ({
    provider: 'telnyx',
    token: 'telnyx-jwt',
    maxSeconds: 135,
    credits: 2250,
    callSid: 'TX0123456789abcdef0123456789abcdef',
    sipHeaders: [{ name: 'X-CK-Ref', value: 'signed-ref' }],
  })),
  getCall: jest.fn(async () => ({ billed: true, status: 'completed', talkSeconds: 61, credits: 1017, callerId: '+918045000001' })),
  startRecording: jest.fn(),
  stopRecording: jest.fn(),
}));
jest.mock('@services/api/walletApi', () => ({ getWallet: jest.fn(async () => ({ credits: 1233 })), getWalletConfig: jest.fn() }));
jest.mock('@navigation/navigationRef', () => ({ navigate: jest.fn() }));
jest.mock('@services/permissions/permissions', () => ({ check: jest.fn(async () => 'granted'), STATUS: { GRANTED: 'granted' } }));
jest.mock('@services/recording/recordingService', () => ({ downloadForCall: jest.fn(async () => {}) }));
jest.mock('@services/review/ratePrompt', () => ({ onSuccessfulCall: jest.fn() }));

const { connectTelnyx, errorFromReason } = require('@services/voice/telnyxCall');
const voiceService = require('@services/voice/voiceService').default;
const voiceApi = require('@services/api/voiceApi');
const InCallManager = require('react-native-incall-manager');
const notifee = require('@notifee/react-native').default;

const flush = () => new Promise(r => setTimeout(r, 0));

beforeEach(() => {
  jest.clearAllMocks();
  Object.assign(mockState, { loginFails: false, neverReady: false, client: null, call: null });
});

describe('adapter', () => {
  const open = () => connectTelnyx({ token: 'jwt', to: '+919876543210', callSid: TX, sipHeaders: [{ name: 'X-CK-Ref', value: 'r' }], events: EVENTS });

  test('logs in with the token and dials with the signed header; the id is the server one', async () => {
    const call = await open();
    expect(mockState.client.opts.login_token).toBe('jwt');
    expect(mockState.call.options).toMatchObject({ destinationNumber: '+919876543210', customHeaders: [{ name: 'X-CK-Ref', value: 'r' }] });
    expect(call.getSid()).toBe(TX);
  });

  test('states map to the Twilio-style events voiceService already handles', async () => {
    const call = await open();
    const seen = [];
    Object.values(EVENTS).forEach(e => call.on(e, () => seen.push(e)));
    ['ringing', 'active', 'dropped', 'active', 'ended'].forEach(s => mockState.call.fire('telnyx.call.state', mockState.call, s));
    expect(seen).toEqual(['Ringing', 'Connected', 'Reconnecting', 'Reconnected', 'Disconnected']);
    expect(mockState.client.disconnect).toHaveBeenCalled();
  });

  test('busy before answer -> ConnectFailure with the code that maps to "number is busy"', async () => {
    const call = await open();
    const fail = jest.fn();
    call.on(EVENTS.ConnectFailure, fail);
    mockState.client.fire('telnyx.call.remoteEnded', 'id', { sipCode: 486, sipReason: 'Busy Here' });
    mockState.call.fire('telnyx.call.state', mockState.call, 'ended');
    expect(fail.mock.calls[0][0].code).toBe(31486);
    expect(voiceService.mapVoiceError(fail.mock.calls[0][0]).code).toBe('BUSY');
  });

  test('controls: mute / hold / keypad / hang up', async () => {
    const call = await open();
    await call.mute(true);
    await call.mute(false);
    await call.hold(true);
    await call.hold(false);
    await call.sendDigits(5);
    await call.disconnect();
    expect(mockState.call.mute).toHaveBeenCalled();
    expect(mockState.call.unmute).toHaveBeenCalled();
    expect(mockState.call.hold).toHaveBeenCalled();
    expect(mockState.call.unhold).toHaveBeenCalled();
    expect(mockState.call.dtmf).toHaveBeenCalledWith('5');
    expect(mockState.call.hangup).toHaveBeenCalled();
  });

  test('a rejected login is a token error (voiceService fetches a fresh token once)', async () => {
    mockState.loginFails = true;
    await expect(open()).rejects.toMatchObject({ code: 20101 });
    expect(voiceService.mapVoiceError({ code: 20101 }).code).toBe('TOKEN');
  });

  test('no answer from Telnyx login -> network error after 15s, not a hang', async () => {
    mockState.neverReady = true;
    jest.useFakeTimers();
    const p = open();
    const caught = p.catch(e => e);
    await jest.advanceTimersByTimeAsync(15001);
    jest.useRealTimers();
    expect((await caught).code).toBe(31005);
  });

  test('normal end has no error; SIP failures keep their code', () => {
    expect(errorFromReason({ cause: 'NORMAL_CLEARING' })).toBeNull();
    expect(errorFromReason({ sipCode: 404 }).code).toBe(31404);
  });
});

describe('voiceService follows the provider the server picked', () => {
  beforeEach(async () => {
    setDbAdapter(await createSqlJsAdapter());
    await initDatabase();
    useCallStore.getState().clear();
  });

  test('telnyx call: id known up front, in-call audio + microphone service on, both released at the end', async () => {
    expect(await voiceService.startCall({ number: '+919876543210', name: 'Ravi' })).toBe(true);
    await flush();
    expect(useCallStore.getState().activeCall.callSid).toBe(TX);
    expect(InCallManager.start).toHaveBeenCalledWith({ media: 'audio' });
    expect(notifee.displayNotification.mock.calls[0][0].android).toMatchObject({
      asForegroundService: true,
      foregroundServiceTypes: [128],
    });
    expect(mockState.call.options.customHeaders).toEqual([{ name: 'X-CK-Ref', value: 'signed-ref' }]);

    mockState.call.fire('telnyx.call.state', mockState.call, 'active');
    await flush();
    expect(useCallStore.getState().status).toBe('connected');

    await voiceService.toggleSpeaker();
    expect(InCallManager.setForceSpeakerphoneOn).toHaveBeenLastCalledWith(true);
    expect(useCallStore.getState().isSpeaker).toBe(true);

    const rec = await voiceService.toggleRecording();
    expect(rec).toMatchObject({ ok: false, code: 'RECORDING_UNAVAILABLE' });
    expect(voiceApi.startRecording).not.toHaveBeenCalled();

    await voiceService.endCall();
    await flush();
    expect(InCallManager.stop).toHaveBeenCalled();
    expect(notifee.stopForegroundService).toHaveBeenCalled();
    expect(useCallStore.getState().status).toBe('ended');
  });

  test('"record all calls" never sends a Twilio record param on a Telnyx call', async () => {
    const { useSettingsStore } = require('@store/settingsStore');
    useSettingsStore.setState({ recordAllCalls: true });
    try {
      await voiceService.startCall({ number: '+919876543210' });
      expect(useCallStore.getState().isRecording).toBe(false);
      const localId = useCallStore.getState().activeCall.localId;
      await voiceService.endCall();
      await flush();
      expect((await callLogRepo.getById(localId)).callSid).toBe(TX);
    } finally {
      useSettingsStore.setState({ recordAllCalls: false });
    }
  });
});
