import Config from 'react-native-config';

// Public values only. Secrets never live in the app.
const read = (key, fallback) => {
  const value = Config?.[key];
  return value === undefined || value === null || value === '' ? fallback : value;
};

export const CONFIG = {
  APP_NAME: 'CallingKaro',
  APP_ENV: read('APP_ENV', __DEV__ ? 'development' : 'production'),
  API_BASE_URL: read('API_BASE_URL', 'http://10.0.2.2:5000'),
  API_TIMEOUT_MS: 15000,
  // A free Render server sleeps when idle and needs ~30-60s to wake: the wake-up ping and the login
  // calls (the first thing a user does) wait this long instead of failing at 15s.
  SERVER_WAKE_TIMEOUT_MS: 70000,
  ADMOB_APP_ID: read('ADMOB_APP_ID', 'ca-app-pub-3940256099942544~3347511713'),
  ADMOB_REWARDED_ID: read('ADMOB_REWARDED_ID', 'ca-app-pub-3940256099942544/5224354917'),
  ADMOB_INTERSTITIAL_ID: read('ADMOB_INTERSTITIAL_ID', 'ca-app-pub-3940256099942544/1033173712'),
  RAZORPAY_KEY_ID: read('RAZORPAY_KEY_ID', ''),
  SUPPORT_EMAIL: read('SUPPORT_EMAIL', 'support@yourapp.in'),
  PRIVACY_URL: read('PRIVACY_URL', 'https://yourapp.in/privacy'),
  TERMS_URL: read('TERMS_URL', 'https://yourapp.in/terms'),
  TERMS_VERSION: 'v1',
  DEFAULT_COUNTRY: 'IN',
  DEFAULT_DIAL_CODE: '+91',
  // Display-only mirror of server economy (server is the truth; values here are fallbacks for UI text).
  CREDITS_PER_MINUTE: 1000,
  MIN_CREDITS_TO_CALL: 1000,
  RING_TIMEOUT_SECONDS: 45,
  LOW_BALANCE_WARNING_SECONDS: 60,
};

export const STORAGE_KEYS = {
  TERMS_ACCEPTED: 'termsAccepted',
  TERMS_ACCEPTED_AT: 'termsAcceptedAt',
  TERMS_VERSION: 'termsVersion',
  PERMISSIONS_DONE: 'permissionsDone',
  SETTINGS: 'settings',
  HISTORY_SYNCED: 'historySynced',
  PROMO_DISMISSED_AT: 'promoDismissedAt',
  SUCCESSFUL_CALLS: 'successfulCalls',
  RATE_PROMPT_SHOWN: 'ratePromptShown',
  LANGUAGE: 'language',
};
