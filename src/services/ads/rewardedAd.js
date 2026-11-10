import mobileAds, {
  AdEventType,
  AdsConsent,
  RewardedAd,
  RewardedAdEventType,
  TestIds,
} from 'react-native-google-mobile-ads';
import { CONFIG } from '@constants/config';
import { createAdSession } from '@services/api/adsApi';
import { getWallet } from '@services/api/walletApi';
import { claimSpin, getSpinStatus } from '@services/api/spinApi';
import { useWalletStore } from '@store/walletStore';
import { useAuthStore } from '@store/authStore';
import { isCallActive } from '@store/callStore';
import logger from '@utils/logger';

const log = logger.scope('ads');

// Google TEST unit in development is mandatory (real ads in dev can get the AdMob account banned).
const UNIT_ID = __DEV__ ? TestIds.REWARDED : CONFIG.ADMOB_REWARDED_ID;

// Local ring buffer of ad events for debugging (Settings > About shows nothing sensitive).
const events = [];
const track = (type, extra) => {
  events.push({ t: Date.now(), type, ...extra });
  if (events.length > 50) {
    events.shift();
  }
  log.log(type, extra || '');
};
export const getAdEventLog = () => [...events];
/** False where ad consent is required and was not given (Google forbids requesting ads then). */
export const adsAllowed = () => canRequestAds;

let initialized = null;
let preloaded = null; // { purpose, ad, session, loadedAt }
let canRequestAds = true;

// The server ad session (nonce) lives 30 min; never show a preloaded ad whose nonce may have expired,
// otherwise the user watches the whole video and SSV is refused.
const PRELOAD_MAX_AGE_MS = 25 * 60 * 1000;
const fresh = e => !!e && Date.now() - e.loadedAt < PRELOAD_MAX_AGE_MS;

/** UMP consent (where required by law) -> SDK init. Safe to call many times. */
export const initRewardedAds = () => {
  if (!initialized) {
    initialized = (async () => {
      try {
        const consent = await AdsConsent.gatherConsent();
        // Where consent is required and not given, Google policy forbids requesting ads.
        canRequestAds = consent?.canRequestAds !== false;
        track('consent', { status: consent?.status, canRequestAds });
      } catch (e) {
        track('consent_error', { msg: e?.message });
      }
      await mobileAds().initialize();
      track('sdk_ready');
      if (canRequestAds) {
        preload('credits');
      }
    })().catch(e => {
      initialized = null;
      track('init_error', { msg: e?.message });
    });
  }
  return initialized;
};

/** Privacy options form (shown from Settings when the user is in a consent region). */
export const showAdPrivacyOptions = async () => {
  try {
    await AdsConsent.showPrivacyOptionsForm();
    const info = await AdsConsent.getConsentInfo();
    canRequestAds = info?.canRequestAds !== false; // choices changed -> apply now, not after a restart
    preloaded = null;
    track('consent_changed', { canRequestAds });
  } catch (e) {
    // form not available outside consent regions
  }
};

/**
 * The SSV custom data ("userId:nonce") must be set when the ad is created, so each ad gets
 * a fresh server session. Returns a loaded ad or throws.
 */
const createLoaded = (purpose, timeoutMs = 10000, refId = undefined) =>
  new Promise((resolve, reject) => {
    (async () => {
      const session = await createAdSession(purpose, refId);
      const userId = useAuthStore.getState().user?.id;
      const ad = RewardedAd.createForAdRequest(UNIT_ID, {
        serverSideVerificationOptions: { userId, customData: session.customData },
      });
      const timer = setTimeout(() => {
        cleanup();
        reject(Object.assign(new Error('No ads right now'), { code: 'NO_FILL' }));
      }, timeoutMs);
      const offLoaded = ad.addAdEventListener(RewardedAdEventType.LOADED, () => {
        clearTimeout(timer);
        cleanup();
        track('loaded', { purpose });
        resolve({ purpose, ad, session, loadedAt: Date.now() });
      });
      const offError = ad.addAdEventListener(AdEventType.ERROR, e => {
        clearTimeout(timer);
        cleanup();
        track('load_error', { purpose, code: e?.code });
        reject(Object.assign(new Error('No ads right now'), { code: 'NO_FILL' }));
      });
      const cleanup = () => {
        offLoaded();
        offError();
      };
      ad.load();
    })().catch(reject);
  });

export const preload = async (purpose = 'credits') => {
  if (!canRequestAds) {
    return null;
  }
  if (preloaded?.purpose === purpose && fresh(preloaded)) {
    return preloaded;
  }
  try {
    preloaded = await createLoaded(purpose);
  } catch (e) {
    preloaded = null; // cap reached / no fill -> try again on demand
  }
  return preloaded;
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/** After EARNED_REWARD Google calls our server (SSV); poll until the reward shows up (max 10s). */
const waitForReward = async (purpose, before) => {
  for (let i = 0; i < 10; i++) {
    await sleep(1000);
    try {
      if (purpose === 'credits' || purpose === 'spin_claim') {
        const w = await getWallet();
        if (w.credits > before) {
          useWalletStore.getState().setFromServer(w);
          return w.credits - before;
        }
      } else {
        const s = await getSpinStatus();
        if (s.extraSpinsAvailable > before) {
          return 1;
        }
      }
    } catch (e) {
      // keep polling
    }
  }
  return 0;
};

/**
 * Shows a rewarded ad. purpose: 'credits' (+250) | 'extra_spin' | 'spin_claim' (collects a won spin: opts.refId
 * = spin id, opts.claimVia = 'ssv' (Google confirms) | 'app' (test ads: the app reports the watched ad)).
 * Result: { status: 'rewarded'|'pending'|'closed_early'|'no_fill'|'no_consent'|'in_call'|'limit'|'disabled', gained }
 */
export const showRewarded = async (purpose = 'credits', opts = {}) => {
  if (isCallActive()) {
    return { status: 'in_call', gained: 0 }; // never during / right before a call
  }
  await initRewardedAds();
  if (!canRequestAds) {
    return { status: 'no_consent', gained: 0 };
  }
  let entry = preloaded?.purpose === purpose && fresh(preloaded) ? preloaded : null;
  if (preloaded && !entry) {
    track('preload_discarded', { age: Date.now() - preloaded.loadedAt });
  }
  preloaded = null;
  try {
    entry = entry || (await createLoaded(purpose, undefined, opts.refId));
  } catch (e) {
    if (e?.code === 'AD_DAILY_CAP' || e?.code === 'SPIN_DAILY_CAP' || e?.status === 429) {
      return { status: 'limit', gained: 0, message: e.message };
    }
    if (e?.code === 'REWARDS_DISABLED') {
      return { status: 'disabled', gained: 0, message: e.message };
    }
    return { status: 'no_fill', gained: 0 };
  }

  // Baseline from the SERVER (the cached balance may be stale -> a fake "+X credits").
  const before =
    purpose === 'credits' || purpose === 'spin_claim'
      ? (await getWallet().catch(() => null))?.credits ?? useWalletStore.getState().credits
      : (await getSpinStatus().catch(() => ({ extraSpinsAvailable: 0 }))).extraSpinsAvailable;

  let showFailed = false;
  const earned = await new Promise(resolve => {
    let got = false;
    const offs = [
      entry.ad.addAdEventListener(RewardedAdEventType.EARNED_REWARD, () => {
        got = true;
        track('earned', { purpose });
      }),
      entry.ad.addAdEventListener(AdEventType.CLOSED, () => {
        track('closed', { purpose, got });
        offs.forEach(off => off());
        resolve(got);
      }),
      entry.ad.addAdEventListener(AdEventType.ERROR, e => {
        track('show_error', { code: e?.code });
        offs.forEach(off => off());
        resolve(false);
      }),
    ];
    entry.ad.show().catch(e => {
      showFailed = true;
      track('show_failed', { msg: e?.message });
      offs.forEach(off => off());
      resolve(false);
    });
  });

  preload('credits'); // next ad ready for the next tap

  if (showFailed) {
    return { status: 'no_fill', gained: 0 };
  }
  if (!earned) {
    return { status: 'closed_early', gained: 0 };
  }
  if (purpose === 'spin_claim' && opts.claimVia === 'app') {
    try {
      const r = await claimSpin(opts.refId);
      useWalletStore.getState().setBalance(r.balance);
      return { status: 'rewarded', gained: r.credits };
    } catch (e) {
      return { status: 'pending', gained: 0, message: e.message };
    }
  }
  const gained = await waitForReward(purpose, before);
  return { status: gained > 0 ? 'rewarded' : 'pending', gained };
};
