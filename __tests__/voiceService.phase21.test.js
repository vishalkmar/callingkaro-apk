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
const voiceApi = require('@services/api/voiceApi');

beforeEach(async () => {
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
  useCallStore.getState().clear();
});


jest.mock('@services/ads/rewardedAd', () => ({ showRewarded: jest.fn() }));

const InCallManager = require('react-native-incall-manager');
const { Voice } = require('@twilio/voice-react-native-sdk');
const { useCallGateStore } = require('@store/callGateStore');
const permissions = require('@services/permissions/permissions');

voiceService.init(); // the service keeps ONE Voice instance; grab it before mocks are cleared
const voiceInstance = Voice.mock.results[0].value;

const wait = ms => new Promise(r => setTimeout(r, ms));
const lastRow = async () => (await callLogRepo.listRecent({ limit: 1 }))[0];

beforeEach(() => {
  jest.clearAllMocks();
  Object.keys(mockCallHandlers).forEach(k => delete mockCallHandlers[k]);
});

describe('voiceService (P21)', () => {
  test('T12-T13: screen kept awake + proximity sensor during the call, released after', async () => {
    await voiceService.startCall({ number: '+919876543210' });
    expect(InCallManager.setKeepScreenOn).toHaveBeenCalledWith(true);
    expect(InCallManager.startProximitySensor).toHaveBeenCalled();
    await voiceService.endCall();
    await wait(10);
    expect(InCallManager.setKeepScreenOn).toHaveBeenLastCalledWith(false);
    expect(InCallManager.stopProximitySensor).toHaveBeenCalled();
  });

  test('cancel while ringing -> "cancelled", 0 credits', async () => {
    voiceApi.getCall.mockResolvedValueOnce({ billed: true, status: 'canceled', talkSeconds: 0, credits: 0 });
    await voiceService.startCall({ number: '+919876543210' });
    await mockCallHandlers.Ringing();
    await voiceService.endCall();
    await wait(10);
    expect(await lastRow()).toMatchObject({ status: 'cancelled', talkSeconds: 0, creditsUsed: 0 });
    expect(useCallStore.getState().status).toBe('ended');
  });

  test('T10 busy number -> row "busy" and a friendly message', async () => {
    await voiceService.startCall({ number: '+919876543210' });
    await mockCallHandlers.Ringing();
    await mockCallHandlers.Disconnected({ code: 31486 });
    await wait(10);
    expect((await lastRow()).status).toBe('busy');
    expect(useCallStore.getState().error).toMatch(/busy/i);
  });

  test('ConnectFailure (no network) -> failed with a network message', async () => {
    await voiceService.startCall({ number: '+919876543210' });
    await mockCallHandlers.ConnectFailure({ code: 31005 });
    await wait(10);
    expect((await lastRow()).status).toBe('failed');
    expect(useCallStore.getState().error).toMatch(/internet/i);
  });

  test('not answered in 45s -> the app ends it as "no answer"', async () => {
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      await voiceService.startCall({ number: '+919876543210' });
      await mockCallHandlers.Ringing();
      await jest.advanceTimersByTimeAsync(45000);
      expect(mockCall.disconnect).toHaveBeenCalled();
      await jest.advanceTimersByTimeAsync(10);
    } finally {
      jest.useRealTimers();
    }
    expect((await lastRow()).status).toBe('no-answer');
  });

  test('mic not allowed -> no token, no call, the mic dialog opens', async () => {
    permissions.check.mockResolvedValueOnce('denied');
    expect(await voiceService.startCall({ number: '+919876543210' })).toBe(false);
    expect(voiceApi.getVoiceToken).not.toHaveBeenCalled();
    expect(useCallGateStore.getState().dialog).toBe('mic');
    useCallGateStore.getState().close();
  });

  test('server says not enough credits -> credits dialog, row "insufficient-credit"', async () => {
    voiceApi.getVoiceToken.mockRejectedValueOnce(
      Object.assign(new Error('low'), { code: 'INSUFFICIENT_CREDITS', status: 402 }),
    );
    expect(await voiceService.startCall({ number: '+919876543210' })).toBe(false);
    expect(useCallGateStore.getState().dialog).toBe('credits');
    expect((await lastRow()).status).toBe('insufficient-credit');
    useCallGateStore.getState().close();
  });

  test('mute / hold / keypad digits reach the call', async () => {
    await voiceService.startCall({ number: '+919876543210' });
    await mockCallHandlers.Connected();
    await voiceService.toggleMute();
    await voiceService.toggleHold();
    await voiceService.sendDigit('1');
    expect(mockCall.mute).toHaveBeenCalledWith(true);
    expect(mockCall.hold).toHaveBeenCalledWith(true);
    expect(mockCall.sendDigits).toHaveBeenCalledWith('1');
    expect(useCallStore.getState()).toMatchObject({ isMuted: true, isOnHold: true, dtmf: '1' });
    await voiceService.endCall();
    await wait(10);
  });

  test('balance ran out (talk = maxSeconds) -> endReason balance_finished', async () => {
    const realNow = Date.now;
    await voiceService.startCall({ number: '+919876543210' });
    await mockCallHandlers.Connected();
    const answered = useCallStore.getState().answeredAt;
    Date.now = () => answered + 135 * 1000; // the token said maxSeconds 135
    try {
      await mockCallHandlers.Disconnected();
    } finally {
      Date.now = realNow;
    }
    await wait(10);
    expect(useCallStore.getState().endReason).toBe('balance_finished');
  });

  test('BUG FIX: the late server charge of call 1 never lands on call 2', async () => {
    let releaseCharge;
    voiceApi.getCall.mockImplementationOnce(
      () =>
        new Promise(r => {
          releaseCharge = () => r({ billed: true, status: 'completed', talkSeconds: 61, credits: 1017 });
        }),
    );
    await voiceService.startCall({ number: '+919876543210' });
    await mockCallHandlers.Ringing();
    await mockCallHandlers.Connected();
    await voiceService.endCall();
    await wait(1600); // finish() is now waiting for the server charge of call 1
    useCallStore.getState().clear(); // InCall screen closed
    await voiceService.startCall({ number: '+918888888888' });
    const second = useCallStore.getState().activeCall.localId;
    releaseCharge();
    await wait(50);
    expect(useCallStore.getState().activeCall.localId).toBe(second);
    expect(useCallStore.getState().summary).toBeNull();
  }, 15000);

  test('expired token at connect -> one retry with a fresh token', async () => {
    const instance = voiceInstance;
    instance.connect.mockRejectedValueOnce(Object.assign(new Error('expired'), { code: 20104 }));
    await voiceService.startCall({ number: '+919876543210' });
    expect(instance.connect).toHaveBeenCalledTimes(2);
    expect(voiceApi.getVoiceToken).toHaveBeenCalledTimes(2);
    expect(useCallStore.getState().status).toBe('connecting');
    await voiceService.endCall();
    await wait(10);
  });
});
