import { toast } from '@components/common';
import { CONFIG } from '@constants/config';
import { STRINGS } from '@constants/strings';
import { useWalletStore } from '@store/walletStore';
import { useCallGateStore } from '@store/callGateStore';
import { isCallActive } from '@store/callStore';
import { isOnlineNow } from '@hooks/useNetwork';
import { check, STATUS } from '@services/permissions/permissions';
import voiceService from '@services/voice/voiceService';
import { validateDialInput } from '@utils/phone';
import { haptic } from '@services/audio/tones';

let inFlight = false;

const INVALID_MSG = {
  invalid: STRINGS.dialpad.invalid,
  not_india: STRINGS.dialpad.notIndia,
  premium: STRINGS.dialpad.premium,
};

/**
 * Single entry point for every CALL button (Dialpad, Contacts, Recent, Call Details).
 * Order: number rules -> one call at a time -> online -> >= 1 minute of credits -> microphone -> voiceService.
 * Returns true when the call was started.
 */
export const placeCall = async ({ number, name = null }) => {
  const gate = useCallGateStore.getState();
  const v = validateDialInput(number);
  if (!v.ok) {
    if (v.reason === 'emergency') {
      gate.open('emergency');
    } else if (v.reason !== 'empty') {
      toast.error(INVALID_MSG[v.reason] || STRINGS.dialpad.invalid);
    }
    return false;
  }
  // Double tap / second call guard.
  if (inFlight || isCallActive()) {
    return false;
  }
  inFlight = true;
  try {
    if (!(await isOnlineNow())) {
      toast.error(STRINGS.dialpad.offline);
      return false;
    }
    const credits = useWalletStore.getState().credits;
    if (credits < CONFIG.MIN_CREDITS_TO_CALL) {
      // refresh once in case the cached balance is stale
      const fresh = await useWalletStore.getState().refresh();
      if (!fresh || fresh.credits < CONFIG.MIN_CREDITS_TO_CALL) {
        gate.open('credits');
        return false;
      }
    }
    const mic = await check('microphone');
    if (mic !== STATUS.GRANTED) {
      gate.open('mic', { number: v.e164, name });
      return false;
    }
    haptic(25);
    return await voiceService.startCall({ number: v.e164, name });
  } finally {
    inFlight = false;
  }
};

export default placeCall;
