/**
 * Telnyx WebRTC call behind the same small interface voiceService uses for a Twilio Call:
 *   on(event, fn) / disconnect() / mute(bool) / hold(bool) / sendDigits(digits) / getSid()
 * and the same event names (passed in as `events`, i.e. Twilio's Call.Event), so the call lifecycle,
 * billing, timers and UI code stay provider-agnostic.
 *
 * The server decides everything (balance, time limit, caller ID): the app only logs in with the short-lived
 * token, dials, and sends the signed X-CK-Ref header it got with the token.
 */
import { TelnyxRTC } from '@telnyx/react-native-voice-sdk';
import logger from '@utils/logger';

const log = logger.scope('telnyx');

const READY_TIMEOUT_MS = 15000;

/** SIP code -> the Twilio-style error code mapVoiceError() already understands (busy, unreachable, ...). */
export const errorFromReason = reason => {
  const sip = Number(reason?.sipCode);
  if (sip >= 400) {
    return { code: 31000 + sip, message: reason?.sipReason || reason?.cause || 'call failed' };
  }
  return null;
};

const waitReady = client =>
  new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(Object.assign(new Error('Telnyx login timed out'), { code: 31005 })), READY_TIMEOUT_MS);
    client.on('telnyx.client.ready', () => {
      clearTimeout(timer);
      resolve();
    });
    client.on('telnyx.client.error', e => {
      clearTimeout(timer);
      reject(Object.assign(new Error(e?.message || 'Telnyx login failed'), { code: 20101 })); // token-type error
    });
  });

/**
 * Logs in, places the call and returns the Twilio-like call object.
 * @param {{token: string, to: string, callSid: string, sipHeaders: {name: string, value: string}[], events: object}} p
 */
export const connectTelnyx = async ({ token, to, callSid, sipHeaders = [], events }) => {
  const client = new TelnyxRTC({ login_token: token, logLevel: 'warn' });
  const ready = waitReady(client);
  await client.connect();
  await ready;

  const listeners = {};
  const emit = (name, arg) => (listeners[name] || []).forEach(fn => fn(arg));
  let call = null;
  let answered = false;
  let dropped = false;
  let ended = false;
  let endReason = null;

  const close = () => {
    try {
      client.disconnect();
    } catch (e) {
      log.warn('disconnect', e?.message);
    }
  };

  client.on('telnyx.call.remoteEnded', (_id, reason) => {
    endReason = reason;
  });

  const onState = state => {
    if (ended) {
      return;
    }
    if (state === 'ringing' || state === 'connecting') {
      emit(events.Ringing);
    } else if (state === 'active') {
      if (dropped) {
        dropped = false;
        emit(events.Reconnected);
      } else if (!answered) {
        answered = true; // the server bridges us to the phone only when the callee picks up
        emit(events.Connected);
      }
    } else if (state === 'dropped') {
      dropped = true;
      emit(events.Reconnecting);
    } else if (state === 'ended') {
      ended = true;
      // Before answer a SIP error (busy / unreachable) is a failure; after answer every end is normal.
      const err = answered ? null : errorFromReason(endReason);
      if (err && !answered) {
        emit(events.ConnectFailure, err);
      } else {
        emit(events.Disconnected, null);
      }
      close();
    }
  };

  try {
    call = await client.newCall({ destinationNumber: to, audio: true, customHeaders: sipHeaders });
  } catch (e) {
    close();
    throw Object.assign(new Error(e?.message || 'Telnyx call failed'), { code: 31005 });
  }
  call.on('telnyx.call.state', (_c, state) => onState(state));

  return {
    provider: 'telnyx',
    on: (name, fn) => {
      (listeners[name] = listeners[name] || []).push(fn);
    },
    getSid: () => callSid, // issued by our server with the token
    disconnect: async () => {
      if (ended) {
        return;
      }
      try {
        await call.hangup();
      } catch (e) {
        log.warn('hangup', e?.message);
        onState('ended');
      }
    },
    mute: async on => (on ? call.mute() : call.unmute()),
    hold: async on => (on ? call.hold() : call.unhold()),
    sendDigits: async digits => call.dtmf(String(digits)),
  };
};

export default connectTelnyx;
