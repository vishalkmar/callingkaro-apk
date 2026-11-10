/**
 * Full-screen ad when a call ends (a natural break, no reward attached - a reward for an interstitial is
 * against AdMob policy). Loaded while the call runs so it is ready at hang-up; shown at most once per
 * MIN_GAP_MS, never while another call is active, and only when ad consent allows ads.
 */
import { AdEventType, InterstitialAd, TestIds } from 'react-native-google-mobile-ads';
import { CONFIG } from '@constants/config';
import { isCallActive } from '@store/callStore';
import logger from '@utils/logger';
import { adsAllowed, initRewardedAds } from './rewardedAd';

const log = logger.scope('interstitial');

// Google TEST unit in development (real ads in debug builds can get the AdMob account banned).
const UNIT_ID = __DEV__ ? TestIds.INTERSTITIAL : CONFIG.ADMOB_INTERSTITIAL_ID;
export const MIN_GAP_MS = 60 * 1000; // AdMob: avoid back-to-back interstitials
const SHOW_DELAY_MS = 700; // let the "call ended" screen appear first

let ad = null;
let ready = false;
let loading = false;
let lastShownAt = 0;

/** Starts loading the next ad (safe to call often). */
export const preloadInterstitial = async () => {
  if (ready || loading || !UNIT_ID) {
    return;
  }
  await initRewardedAds();
  if (!adsAllowed()) {
    return;
  }
  loading = true;
  ad = InterstitialAd.createForAdRequest(UNIT_ID);
  const offLoaded = ad.addAdEventListener(AdEventType.LOADED, () => {
    ready = true;
    loading = false;
  });
  const offError = ad.addAdEventListener(AdEventType.ERROR, e => {
    loading = false;
    ready = false;
    log.warn('load failed', e?.code);
  });
  ad.addAdEventListener(AdEventType.CLOSED, () => {
    offLoaded();
    offError();
    ready = false;
    preloadInterstitial(); // next call's ad
  });
  ad.load();
};

/**
 * Shows the call-end ad if one is loaded. Returns why it did / did not show:
 * 'shown' | 'too_soon' | 'not_ready' | 'in_call' | 'no_consent' | 'error'.
 */
export const showCallEndAd = async () => {
  await new Promise(r => setTimeout(r, SHOW_DELAY_MS));
  if (!adsAllowed()) {
    return 'no_consent';
  }
  if (isCallActive()) {
    return 'in_call'; // the user already started the next call
  }
  if (Date.now() - lastShownAt < MIN_GAP_MS) {
    return 'too_soon';
  }
  if (!ready || !ad) {
    preloadInterstitial();
    return 'not_ready';
  }
  try {
    ready = false;
    lastShownAt = Date.now();
    await ad.show();
    return 'shown';
  } catch (e) {
    log.warn('show failed', e?.message);
    preloadInterstitial();
    return 'error';
  }
};

/** Tests only. */
export const resetInterstitialForTest = () => {
  ad = null;
  ready = false;
  loading = false;
  lastShownAt = 0;
};
