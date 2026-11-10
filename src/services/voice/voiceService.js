/**
 * voiceService.js - the ONLY file that talks to the voice SDK (@twilio/voice-react-native-sdk).
 * Screens/stores call these functions; nothing else imports the SDK.
 *
 * Call flow: placeCall() checks -> startCall(): local row 'dialing' -> GET /voice/token (server checks credits)
 * -> open InCall -> voice.connect({ To }) -> Ringing / Connected / Disconnected events -> finish():
 * local duration + estimate -> GET /wallet + GET /calls/:sid for the exact server charge.
 */
import { AppState, Vibration } from 'react-native';
import { AudioDevice, Call, Voice } from '@twilio/voice-react-native-sdk';
import InCallManager from 'react-native-incall-manager';
import { CONFIG } from '@constants/config';
import { ROUTES } from '@constants/routes';
import { navigate } from '@navigation/navigationRef';
import { useCallStore } from '@store/callStore';
import { useWalletStore } from '@store/walletStore';
import { useSettingsStore } from '@store/settingsStore';
import { useCallGateStore } from '@store/callGateStore';
import * as callLogRepo from '@db/callLogRepo';
import * as voiceApi from '@services/api/voiceApi';
import { check, STATUS } from '@services/permissions/permissions';
import { beep, doubleBeep } from '@services/audio/tones';
import { downloadForCall } from '@services/recording/recordingService';
import { onSuccessfulCall } from '@services/review/ratePrompt';
import { toast } from '@components/common';
import logger from '@utils/logger';
import { connectTelnyx } from './telnyxCall';
import { startCallService, stopCallService } from './callForeground';
import { preloadInterstitial, showCallEndAd } from '@services/ads/interstitialAd';

const log = logger.scope('voice');

let voice = null;
let activeCall = null; // SDK Call object
let timers = [];
let tokenInfo = null; // { maxSeconds, credits }
let userHungUp = false;
let finished = false;
let speakerChosen = false; // user picked the loudspeaker (or "speaker by default") for this call
let armedViaParam = false; // recording requested in the connect params
// Which provider carries the current call. The SERVER decides (USE_TELNYX) and says so with the token,
// so switching providers never needs a new app build.
let provider = 'twilio';
const isTelnyx = () => provider === 'telnyx';
const RECORDING_UNAVAILABLE = 'Recording is not available on this calling line yet.';

// ---------------- error mapping ----------------

const TOKEN_ERRORS = [20101, 20104, 31204, 31205];
const NETWORK_ERRORS = [31003, 31005, 31009, 53000, 53001, 53405];
const MIC_ERRORS = [31201, 31208, 31401];

export const mapVoiceError = err => {
  const code = Number(err?.code);
  if (TOKEN_ERRORS.includes(code)) {
    return { code: 'TOKEN', message: 'Session expired. Please try the call again.' };
  }
  if (NETWORK_ERRORS.includes(code)) {
    return { code: 'NETWORK', message: 'No internet connection. Check your network and try again.' };
  }
  if (MIC_ERRORS.includes(code)) {
    return { code: 'MIC', message: 'Microphone is not available. Allow it in Settings.' };
  }
  if (code === 31486) {
    return { code: 'BUSY', message: 'The number is busy.' };
  }
  if (code === 31480 || code === 31404 || code === 31484) {
    return { code: 'NUMBER', message: 'The number is not reachable or invalid.' };
  }
  if (err?.code === 'INSUFFICIENT_CREDITS') {
    return { code: 'CREDITS', message: 'Not enough credits for this call.' };
  }
  return { code: 'PROVIDER', message: 'The call could not be completed. Please try again.' };
};

// ---------------- helpers ----------------

const clearTimers = () => {
  timers.forEach(clearTimeout);
  timers = [];
};

const keepAwake = on => {
  try {
    InCallManager.setKeepScreenOn(on);
    if (on) {
      InCallManager.startProximitySensor(); // screen off near the ear
    } else {
      InCallManager.stopProximitySensor();
    }
  } catch (e) {
    log.warn('incall manager', e?.message);
  }
};

const store = () => useCallStore.getState();

// ---------------- audio routes ----------------

const refreshAudioRoutes = async () => {
  if (isTelnyx()) {
    // WebRTC audio is routed by InCallManager: earpiece or loudspeaker (Bluetooth / headset take over by themselves).
    store().set({ audioRoutes: ['earpiece', 'speaker'], audioRoute: store().isSpeaker ? 'speaker' : 'earpiece' });
    return;
  }
  if (!voice) {
    return;
  }
  try {
    const { audioDevices, selectedDevice } = await voice.getAudioDevices();
    store().set({
      audioRoutes: audioDevices.map(d => d.type),
      audioRoute: selectedDevice?.type || 'earpiece',
      isSpeaker: selectedDevice?.type === AudioDevice.Type.Speaker,
    });
  } catch (e) {
    log.warn('audio devices', e?.message);
  }
};

/** route: 'earpiece' | 'speaker' | 'bluetooth' */
export const setAudioRoute = async (route, { byUser = false } = {}) => {
  if (byUser) {
    speakerChosen = route === 'speaker';
  }
  if (isTelnyx()) {
    const speaker = route === 'speaker';
    try {
      InCallManager.setForceSpeakerphoneOn(speaker);
    } catch (e) {
      log.warn('speaker', e?.message);
    }
    store().set({ audioRoute: speaker ? 'speaker' : 'earpiece', isSpeaker: speaker });
    return;
  }
  if (!voice) {
    return;
  }
  const { audioDevices } = await voice.getAudioDevices();
  const target =
    audioDevices.find(d => d.type === route) || audioDevices.find(d => d.type === AudioDevice.Type.Earpiece);
  if (target) {
    await target.select();
    store().set({ audioRoute: target.type, isSpeaker: target.type === AudioDevice.Type.Speaker });
  }
};

export const toggleSpeaker = () => setAudioRoute(store().isSpeaker ? 'earpiece' : 'speaker', { byUser: true });

// ---------------- init ----------------

/** Creates the Voice instance and registers listeners once. */
export const init = () => {
  if (voice) {
    return voice;
  }
  voice = new Voice();
  voice.on(Voice.Event.AudioDevicesUpdated, (devices, selected) => {
    const prev = store().audioRoute;
    store().set({
      audioRoutes: devices.map(d => d.type),
      audioRoute: selected?.type || 'earpiece',
      isSpeaker: selected?.type === AudioDevice.Type.Speaker,
    });
    // Headphones / Bluetooth removed mid-call: Android may fall back to the loudspeaker.
    // The speaker is only allowed when the user picked it (or "speaker by default"), so a private
    // call never suddenly plays out loud. (The SDK has no wired-headset type - it reports it as
    // earpiece/unknown - so this rule is based on who chose the speaker, not on the old device.)
    if (selected?.type === AudioDevice.Type.Speaker && !speakerChosen && activeCall && prev !== 'speaker') {
      setAudioRoute('earpiece');
    }
  });
  voice.on(Voice.Event.Error, e => log.warn('voice error', e?.code));
  return voice;
};

// ---------------- call lifecycle ----------------

const fetchToken = async () => {
  try {
    return await voiceApi.getVoiceToken();
  } catch (e) {
    if (e.code === 'INSUFFICIENT_CREDITS') {
      useCallGateStore.getState().open('credits');
    }
    throw e;
  }
};

const startTimersOnConnect = () => {
  const maxSeconds = tokenInfo?.maxSeconds || 0;
  if (!maxSeconds) {
    return;
  }
  // Soft beeps at 30s and 10s before the server's hard time limit.
  [30, 10].forEach(left => {
    const at = (maxSeconds - left) * 1000;
    if (at > 0) {
      timers.push(setTimeout(beep, at));
    }
  });
};

const finish = async ({ error } = {}) => {
  if (finished) {
    return;
  }
  finished = true;
  clearTimers();
  keepAwake(false);
  if (isTelnyx()) {
    try {
      InCallManager.stop();
    } catch (e) {
      log.warn('incall stop', e?.message);
    }
    stopCallService();
  }
  const s = store();
  const call = s.activeCall;
  const now = Date.now();
  const answeredAt = s.answeredAt;
  const talkSeconds = answeredAt ? Math.max(0, Math.round((now - answeredAt) / 1000)) : 0;
  const maxSeconds = tokenInfo?.maxSeconds || 0;
  const balanceFinished = !!answeredAt && maxSeconds > 0 && talkSeconds >= maxSeconds - 2;
  const mapped = error ? mapVoiceError(error) : null;

  let status;
  if (answeredAt) {
    status = 'completed';
  } else if (userHungUp) {
    status = 'cancelled';
  } else if (mapped?.code === 'BUSY') {
    status = 'busy';
  } else if (s.endReason === 'no-answer' || !mapped) {
    status = 'no-answer';
  } else {
    status = 'failed';
  }
  const estimate = Math.ceil((talkSeconds * CONFIG.CREDITS_PER_MINUTE) / 60);
  const endReason = balanceFinished ? 'balance_finished' : s.endReason;

  if (call?.localId) {
    await callLogRepo
      .finish(call.localId, { status, endedAt: now, talkSeconds, creditsUsed: estimate, endReason })
      .catch(e => log.error('finish row', e?.message));
  }
  if (balanceFinished) {
    doubleBeep();
  }
  store().finish({
    endReason,
    error: mapped && !answeredAt && !userHungUp ? mapped.message : null,
    summary: { talkSeconds, credits: estimate, balance: null, status, exact: false },
  });
  activeCall = null;
  // Full-screen ad at the natural break after the call (rate-limited, never during a call).
  showCallEndAd().catch(() => {});

  // Exact charge comes from the server (billed by the provider webhook).
  const wallet = await useWalletStore.getState().refresh();
  const sid = call?.callSid;
  let exact = null;
  if (sid) {
    for (let i = 0; i < 3 && !exact; i++) {
      await new Promise(r => setTimeout(r, 1500));
      try {
        const c = await voiceApi.getCall(sid);
        if (c.billed) {
          exact = c;
        }
      } catch (e) {
        // reconciled later on next app start
      }
    }
  }
  if (exact && call?.localId) {
    await callLogRepo.applyServerResult(call.localId, {
      status: callLogRepo.mapServerStatus(exact.status),
      talkSeconds: exact.talkSeconds,
      credits: exact.credits,
      callerId: exact.callerId,
      endReason: exact.endReason,
    });
  }
  const latest = exact ? await useWalletStore.getState().refresh() : wallet;
  // The user may already be on a NEW call by now: only update the summary of this call.
  if (useCallStore.getState().activeCall?.localId === call?.localId) {
    useCallStore.setState(st => ({
      summary: {
        ...(st.summary || {}),
        talkSeconds: exact?.talkSeconds ?? talkSeconds,
        credits: exact?.credits ?? estimate,
        balance: latest?.credits ?? useWalletStore.getState().credits,
        exact: !!exact,
      },
    }));
  }

  if (status === 'completed' && talkSeconds >= 20) {
    onSuccessfulCall();
  }
  if (sid && call?.recording && answeredAt) {
    downloadForCall({ callLogId: call.localId, callSid: sid }).catch(e => {
      if (e?.code === 'STORAGE_FULL') {
        toast.error('Recording not saved', e.message);
      }
    });
  }
};

const attachListeners = call => {
  call.on(Call.Event.Ringing, async () => {
    store().setStatus('ringing');
    const sid = call.getSid();
    if (sid) {
      store().patchCall({ callSid: sid });
      const id = store().activeCall?.localId;
      if (id) {
        await callLogRepo.updateStatus(id, 'ringing', { callSid: sid });
      }
      // Record was tapped after connect() but before answer -> arm it on the server now.
      if (store().isRecording && !armedViaParam) {
        voiceApi.startRecording(sid).catch(e => log.warn('arm recording', e?.code));
      }
    }
  });
  call.on(Call.Event.Connected, async () => {
    clearTimers();
    store().setConnected();
    const sid = call.getSid();
    const id = store().activeCall?.localId;
    if (sid) {
      store().patchCall({ callSid: sid });
    }
    if (id) {
      await callLogRepo.updateStatus(id, 'connected', { answeredAt: Date.now(), callSid: sid });
    }
    const settings = useSettingsStore.getState();
    if (settings.vibrateOnConnect) {
      Vibration.vibrate(60);
    }
    if (settings.speakerDefault) {
      setAudioRoute('speaker', { byUser: true });
    }
    startTimersOnConnect();
    refreshAudioRoutes();
  });
  call.on(Call.Event.Reconnecting, () => store().setStatus('reconnecting'));
  call.on(Call.Event.Reconnected, () => store().setStatus('connected'));
  call.on(Call.Event.ConnectFailure, err => {
    log.warn('connect failure', err?.code);
    finish({ error: err });
  });
  call.on(Call.Event.Disconnected, err => {
    if (err) {
      log.warn('disconnected with error', err?.code);
    }
    finish({ error: err });
  });
};

/**
 * Starts an outgoing call. Assumes placeCall() already validated number / online / credits / mic,
 * but re-checks mic and the one-call-at-a-time rule because it is the last gate before the SDK.
 */
export const startCall = async ({ number, name = null }) => {
  init();
  const s = store();
  if (s.activeCall && s.status !== 'ended') {
    return false; // block a second call
  }
  if ((await check('microphone')) !== STATUS.GRANTED) {
    useCallGateStore.getState().open('mic', { number, name });
    return false;
  }

  finished = false;
  userHungUp = false;
  speakerChosen = false;
  clearTimers();
  const record = !!useSettingsStore.getState().recordAllCalls;
  armedViaParam = record;
  const localId = await callLogRepo.insert({ number, contactName: name, status: 'dialing' });
  store().begin({ localId, number, name, callSid: null, maxSeconds: 0, recording: record });
  store().set({ isRecording: record });

  // 1) token (server checks balance + abuse limits). Retry once if it expired before connecting.
  let token;
  try {
    tokenInfo = await fetchToken();
    token = tokenInfo.token;
  } catch (e) {
    await callLogRepo.finish(localId, {
      status: e.code === 'INSUFFICIENT_CREDITS' ? 'insufficient-credit' : 'failed',
      talkSeconds: 0,
    });
    store().clear();
    if (e.code !== 'INSUFFICIENT_CREDITS') {
      toast.error(e.code === 'NETWORK' || e.code === 'TIMEOUT' ? 'Service unavailable, try later' : e.message);
    }
    return false; // InCall screen is NOT opened when the server is down
  }
  provider = tokenInfo.provider === 'telnyx' ? 'telnyx' : 'twilio';
  store().patchCall({ maxSeconds: tokenInfo.maxSeconds });
  if (isTelnyx()) {
    // The call id is known before dialling; recording is a Twilio feature for now.
    armedViaParam = false;
    store().patchCall({ callSid: tokenInfo.callSid, recording: false });
    store().set({ isRecording: false });
  }

  // 2) InCall screen right away
  navigate(ROUTES.IN_CALL);
  keepAwake(true);
  preloadInterstitial().catch(() => {}); // ready by the time the call ends

  // 3) connect
  const connect = async t => {
    if (isTelnyx()) {
      store().patchCall({ callSid: tokenInfo.callSid }); // a retried token brings a new call id
      // Saved now, not on ringing: a call hung up before it rings still matches the server's row later.
      await callLogRepo.updateStatus(localId, 'dialing', { callSid: tokenInfo.callSid }).catch(() => {});
      try {
        InCallManager.start({ media: 'audio' }); // in-call audio mode, earpiece by default
      } catch (e) {
        log.warn('incall start', e?.message);
      }
      startCallService({ title: name || number });
      return connectTelnyx({
        token: t,
        to: number,
        callSid: tokenInfo.callSid,
        sipHeaders: tokenInfo.sipHeaders,
        events: Call.Event,
      });
    }
    return voice.connect(t, {
      params: { To: number, Record: record ? 'true' : 'false' },
      contactHandle: name || number,
      notificationDisplayName: name || number,
    });
  };
  try {
    try {
      activeCall = await connect(token);
    } catch (err) {
      if (TOKEN_ERRORS.includes(Number(err?.code))) {
        tokenInfo = await fetchToken();
        activeCall = await connect(tokenInfo.token);
      } else {
        throw err;
      }
    }
  } catch (err) {
    log.warn('connect threw', err?.code || err?.message);
    await finish({ error: err });
    return false;
  }
  attachListeners(activeCall);
  if (userHungUp) {
    activeCall.disconnect();
  }

  // 4) not answered in 45s -> end automatically
  timers.push(
    setTimeout(() => {
      if (store().status === 'connecting' || store().status === 'ringing') {
        store().set({ endReason: 'no-answer' });
        activeCall?.disconnect();
      }
    }, CONFIG.RING_TIMEOUT_SECONDS * 1000),
  );
  return true;
};

export const endCall = async () => {
  userHungUp = true;
  store().setStatus('ending');
  if (activeCall) {
    try {
      await activeCall.disconnect();
    } catch (e) {
      finish();
    }
  } else if (!finished && store().activeCall) {
    // still fetching the token / connecting
    timers.push(setTimeout(() => !activeCall && finish(), 1500));
  }
};

export const toggleMute = async () => {
  if (!activeCall) {
    return;
  }
  const next = !store().isMuted;
  await activeCall.mute(next);
  store().set({ isMuted: next });
};

export const toggleHold = async () => {
  if (!activeCall) {
    return;
  }
  const next = !store().isOnHold;
  await activeCall.hold(next);
  store().set({ isOnHold: next });
};

export const sendDigit = async digit => {
  store().appendDtmf(digit);
  if (activeCall) {
    await activeCall.sendDigits(String(digit));
  }
};

/**
 * Recording: armed before answer (the callee hears "This call is being recorded" when they pick up),
 * after answer only pause/resume of an armed recording. Server enforces the same rule.
 */
export const toggleRecording = async () => {
  if (isTelnyx() && store().activeCall) {
    return { ok: false, code: 'RECORDING_UNAVAILABLE', message: RECORDING_UNAVAILABLE };
  }
  const s = store();
  const sid = s.activeCall?.callSid || activeCall?.getSid();
  if (!sid) {
    // before the provider gave us a sid: arm locally, sent as a connect param
    store().set({ isRecording: !s.isRecording });
    store().patchCall({ recording: !s.isRecording });
    return { ok: true };
  }
  try {
    if (s.isRecording) {
      await voiceApi.stopRecording(sid);
      store().set({ isRecording: false });
    } else {
      const r = await voiceApi.startRecording(sid);
      store().set({ isRecording: true });
      store().patchCall({ recording: true });
      if (r.recordingStatus === 'in-progress') {
        doubleBeep();
      }
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, message: e.message, code: e.code };
  }
};

export const getActiveCall = () => activeCall;

// Call must keep running in the background (the SDK's foreground VoiceService keeps it alive).
AppState.addEventListener('change', next => {
  if (next === 'active' && activeCall) {
    refreshAudioRoutes();
  }
});

const voiceService = {
  init,
  startCall,
  endCall,
  toggleMute,
  toggleHold,
  toggleSpeaker,
  setAudioRoute,
  sendDigit,
  toggleRecording,
  getActiveCall,
  mapVoiceError,
};

export default voiceService;
