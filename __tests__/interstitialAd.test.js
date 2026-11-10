// Full-screen ad after a call ends: preloaded during the call, shown at the break, rate-limited, never during a
// call and never without ad consent.
const mockAds = { allowed: true, inCall: false, instances: [] };

jest.mock('@services/ads/rewardedAd', () => ({
  initRewardedAds: jest.fn(async () => {}),
  adsAllowed: () => mockAds.allowed,
}));
jest.mock('@store/callStore', () => ({ isCallActive: () => mockAds.inCall }));
jest.mock('react-native-google-mobile-ads', () => ({
  AdEventType: { LOADED: 'loaded', ERROR: 'error', CLOSED: 'closed' },
  TestIds: { INTERSTITIAL: 'test-interstitial' },
  InterstitialAd: {
    createForAdRequest: jest.fn(() => {
      const handlers = {};
      const ad = {
        addAdEventListener: jest.fn((ev, fn) => {
          handlers[ev] = fn;
          return jest.fn();
        }),
        load: jest.fn(() => handlers.loaded?.()),
        show: jest.fn(async () => handlers.closed?.()),
        fire: ev => handlers[ev]?.(),
      };
      mockAds.instances.push(ad);
      return ad;
    }),
  },
}));

const { preloadInterstitial, showCallEndAd, resetInterstitialForTest, MIN_GAP_MS } = require('@services/ads/interstitialAd');

beforeEach(() => {
  resetInterstitialForTest();
  mockAds.allowed = true;
  mockAds.inCall = false;
  mockAds.instances.length = 0;
});

test('loaded during the call -> shown when the call ends, and the next one starts loading', async () => {
  await preloadInterstitial();
  expect(await showCallEndAd()).toBe('shown');
  expect(mockAds.instances[0].show).toHaveBeenCalled();
  expect(mockAds.instances.length).toBe(2); // next call's ad
});

test('at most one every minute (no back-to-back full-screen ads)', async () => {
  const realNow = Date.now;
  await preloadInterstitial();
  expect(await showCallEndAd()).toBe('shown');
  expect(await showCallEndAd()).toBe('too_soon');
  Date.now = () => realNow() + MIN_GAP_MS + 1000;
  try {
    expect(await showCallEndAd()).toBe('shown');
  } finally {
    Date.now = realNow;
  }
});

test('never while the next call is already running', async () => {
  await preloadInterstitial();
  mockAds.inCall = true;
  expect(await showCallEndAd()).toBe('in_call');
  expect(mockAds.instances[0].show).not.toHaveBeenCalled();
});

test('no ad consent -> nothing is requested or shown', async () => {
  mockAds.allowed = false;
  await preloadInterstitial();
  expect(mockAds.instances.length).toBe(0);
  expect(await showCallEndAd()).toBe('no_consent');
});

test('not loaded yet (slow network / no fill) -> the call ends normally and an ad loads for next time', async () => {
  expect(await showCallEndAd()).toBe('not_ready');
  expect(mockAds.instances.length).toBe(1);
});
