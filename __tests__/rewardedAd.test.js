// Phase 17 (app side): rewarded ad flow against a scriptable fake of react-native-google-mobile-ads.
jest.mock('react-native-google-mobile-ads', () => {
  const ads = [];
  const make = () => {
    const listeners = {};
    const ad = {
      opts: null,
      listeners,
      load: jest.fn(() => {
        const mode = global.__adMode || 'fill';
        setTimeout(() => (mode === 'fill' ? listeners.rewarded_loaded?.() : listeners.error?.({ code: 'no-fill' })), 5);
      }),
      show: jest.fn(async () => {
        if (global.__showFails) {
          throw new Error('ad expired');
        }
        const watch = global.__watch || 'full';
        setTimeout(() => {
          if (watch === 'full') {
            listeners.rewarded_earned_reward?.({ amount: 1 });
          }
          listeners.closed?.();
        }, 5);
      }),
      addAdEventListener: jest.fn((ev, fn) => {
        listeners[ev] = fn;
        return () => delete listeners[ev];
      }),
    };
    ads.push(ad);
    return ad;
  };
  return {
    __esModule: true,
    default: () => ({ initialize: jest.fn(async () => {}) }),
    __ads: ads,
    AdEventType: { CLOSED: 'closed', ERROR: 'error' },
    RewardedAdEventType: { LOADED: 'rewarded_loaded', EARNED_REWARD: 'rewarded_earned_reward' },
    TestIds: { REWARDED: 'ca-app-pub-3940256099942544/5224354917' },
    AdsConsent: {
      gatherConsent: jest.fn(async () => ({ status: 'OBTAINED', canRequestAds: global.__consent !== false })),
      showPrivacyOptionsForm: jest.fn(async () => {}),
      getConsentInfo: jest.fn(async () => ({ canRequestAds: global.__consent !== false })),
    },
    RewardedAd: {
      createForAdRequest: jest.fn((unit, opts) => {
        const ad = make();
        ad.unit = unit;
        ad.opts = opts;
        return ad;
      }),
    },
  };
});

let mockServerCredits = 1000;
jest.mock('@services/api/adsApi', () => ({
  createAdSession: jest.fn(async purpose => ({ nonce: 'n1', customData: `user-1:n1-${purpose}` })),
}));
jest.mock('@services/api/walletApi', () => ({ getWallet: jest.fn(async () => ({ credits: mockServerCredits })) }));
jest.mock('@services/api/spinApi', () => ({ getSpinStatus: jest.fn(async () => ({ extraSpinsAvailable: 0 })) }));

const gma = require('react-native-google-mobile-ads');
const adsApi = require('@services/api/adsApi');
const walletApi = require('@services/api/walletApi');
let svc;
let useAuthStore;
let useWalletStore;
let useCallStore;
// Fresh module state per test; the stores must come from the same isolated registry as the service.
const load = () => {
  const prev = useWalletStore?.getState().credits;
  jest.isolateModules(() => {
    svc = require('@services/ads/rewardedAd');
    ({ useAuthStore } = require('@store/authStore'));
    ({ useWalletStore } = require('@store/walletStore'));
    ({ useCallStore } = require('@store/callStore'));
  });
  useAuthStore.setState({ user: { id: 'user-1' } });
  useWalletStore.setState({ credits: prev ?? 1000 });
};

beforeEach(() => {
  jest.clearAllMocks();
  gma.__ads.length = 0;
  global.__adMode = 'fill';
  global.__watch = 'full';
  global.__showFails = false;
  global.__consent = true;
  mockServerCredits = 1000;
  // SSV reaches the server ~1s after EARNED_REWARD -> next wallet poll sees +250
  walletApi.getWallet.mockImplementation(async () => ({ credits: mockServerCredits }));
  useWalletStore = undefined;
  load();
});

jest.setTimeout(30000);

describe('rewarded ads (P17 app side)', () => {
  test('T03 test unit in development; T07 SSV custom data = userId:nonce from the server', async () => {
    await svc.initRewardedAds();
    await new Promise(r => setTimeout(r, 30));
    const ad = gma.__ads[0];
    expect(ad.unit).toBe(gma.TestIds.REWARDED);
    expect(ad.opts.serverSideVerificationOptions).toEqual({ userId: 'user-1', customData: 'user-1:n1-credits' });
  });

  test('T12-T13 full watch -> polls wallet until +250 shows, T05 next ad preloaded', async () => {
    const p = svc.showRewarded('credits');
    setTimeout(() => (mockServerCredits = 1250), 1200);
    const r = await p;
    expect(r).toEqual({ status: 'rewarded', gained: 250 });
    expect(useWalletStore.getState().credits).toBe(1250);
    await new Promise(r2 => setTimeout(r2, 30));
    expect(gma.__ads.length).toBeGreaterThanOrEqual(2); // a fresh ad for next time
  });

  test('T14 closed early -> closed_early, no polling', async () => {
    global.__watch = 'early';
    const r = await svc.showRewarded('credits');
    expect(r.status).toBe('closed_early');
    expect(walletApi.getWallet).toHaveBeenCalledTimes(1); // only the baseline
  });

  test('T15 no fill -> no_fill', async () => {
    global.__adMode = 'nofill';
    load();
    expect((await svc.showRewarded('credits')).status).toBe('no_fill');
  });

  test('server says daily cap -> limit (no ad loaded)', async () => {
    adsApi.createAdSession.mockRejectedValue(Object.assign(new Error('cap'), { code: 'AD_DAILY_CAP', status: 429 }));
    load();
    const r = await svc.showRewarded('credits');
    expect(r.status).toBe('limit');
    adsApi.createAdSession.mockReset();
    adsApi.createAdSession.mockImplementation(async purpose => ({ nonce: 'n1', customData: `user-1:n1-${purpose}` }));
  });

  test('T16 never during a call', async () => {
    useCallStore.getState().begin({ localId: 1, number: '+919876543210' });
    expect((await svc.showRewarded('credits')).status).toBe('in_call');
    expect(gma.RewardedAd.createForAdRequest).not.toHaveBeenCalled();
  });

  test('reward not confirmed within 10s -> pending (balance not invented)', async () => {
    const r = await svc.showRewarded('credits');
    expect(r).toEqual({ status: 'pending', gained: 0 });
    expect(useWalletStore.getState().credits).toBe(1000);
  }, 20000);

  test('BUG FIX: stale cached balance does not produce a fake "+X credits"', async () => {
    useWalletStore.setState({ credits: 500 }); // app cache is behind the server (bought on another phone)
    mockServerCredits = 3000;
    const p = svc.showRewarded('credits');
    setTimeout(() => (mockServerCredits = 3250), 1200);
    expect(await p).toEqual({ status: 'rewarded', gained: 250 }); // not 2750
  });

  test('BUG FIX: a preloaded ad older than 25 min is replaced (its server nonce would be expired)', async () => {
    const realNow = Date.now;
    await svc.initRewardedAds();
    await new Promise(r => setTimeout(r, 30));
    expect(gma.__ads).toHaveLength(1);
    Date.now = () => realNow() + 26 * 60 * 1000;
    try {
      const p = svc.showRewarded('credits');
      setTimeout(() => (mockServerCredits = 1250), 1200);
      await p;
    } finally {
      Date.now = realNow;
    }
    expect(gma.__ads[0].show).not.toHaveBeenCalled();
    expect(gma.__ads[1].show).toHaveBeenCalled();
    expect(adsApi.createAdSession).toHaveBeenCalledTimes(3); // preload, fresh one, next preload
  });

  test('BUG FIX: no consent -> no ad requests at all', async () => {
    global.__consent = false;
    load();
    expect((await svc.showRewarded('credits')).status).toBe('no_consent');
    expect(gma.RewardedAd.createForAdRequest).not.toHaveBeenCalled();
    // user turns ads back on in Settings > Ad privacy choices
    global.__consent = true;
    await svc.showAdPrivacyOptions();
    const p = svc.showRewarded('credits');
    setTimeout(() => (mockServerCredits = 1250), 1200);
    expect((await p).status).toBe('rewarded');
  });

  test('BUG FIX: ad fails to show -> "no ads", not "watch the full video"', async () => {
    global.__showFails = true;
    expect((await svc.showRewarded('credits')).status).toBe('no_fill');
  });

  test('T18 events are logged locally', async () => {
    global.__watch = 'early';
    await svc.showRewarded('credits');
    const types = svc.getAdEventLog().map(e => e.type);
    expect(types).toEqual(expect.arrayContaining(['consent', 'sdk_ready', 'loaded', 'closed']));
  });
});
