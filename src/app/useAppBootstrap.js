import { useEffect, useRef } from 'react';
import { AppState, DevSettings } from 'react-native';
import BootSplash from 'react-native-bootsplash';
import { useAppStore } from '@store/appStore';
import { useAuthStore } from '@store/authStore';
import { useWalletStore } from '@store/walletStore';
import { bootstrap, wakeServer, resetOnboarding } from '@services/auth/authService';
import { initDatabase } from '@db/index';
import { syncHistoryOnce, reconcileUnfinishedCalls } from '@services/calls/historySync';
import voiceService from '@services/voice/voiceService';
import { initRewardedAds } from '@services/ads/rewardedAd';
import { initPayments } from '@services/payments/payments';
import { api } from '@services/api/client';
import { getIntegrity, integrityHeader } from '@services/security/deviceIntegrity';
import logger from '@utils/logger';

const log = logger.scope('boot');

/** Runs once: DB migrations -> session check -> pick the first stack -> hide the native splash. */
export const useAppBootstrap = () => {
  const setStage = useAppStore(s => s.setStage);
  const stage = useAppStore(s => s.stage);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    if (__DEV__) {
      DevSettings.addMenuItem('Reset onboarding', () => resetOnboarding());
    }
    (async () => {
      // Sent with every request; the server disables free rewards on emulators / rooted phones.
      // Awaited (local + fast) so no request - e.g. an early reward call - goes out without it.
      try {
        api.defaults.headers.common['X-Device-Integrity'] = integrityHeader(await getIntegrity());
      } catch (e) {
        log.warn('integrity check failed', e?.message);
      }
      wakeServer(); // not awaited: the server wakes while the DB / session load
      try {
        await initDatabase(); // migrations must finish before any screen reads data
      } catch (e) {
        log.error('database init failed', e?.message);
      }
      let first = 'onboarding';
      try {
        first = await bootstrap();
      } catch (e) {
        log.error('bootstrap failed', e?.message);
      }
      setStage(first);
      BootSplash.hide({ fade: true }).catch(() => {});
    })();
  }, [setStage]);

  // Services that need a logged-in user.
  useEffect(() => {
    if (stage !== 'main') {
      return;
    }
    voiceService.init();
    initRewardedAds();
    initPayments();
    syncHistoryOnce();
    reconcileUnfinishedCalls();
  }, [stage]);

  // Refresh wallet + reconcile calls every time the app returns to the foreground.
  useEffect(() => {
    let last = AppState.currentState;
    const sub = AppState.addEventListener('change', next => {
      if (last.match(/inactive|background/) && next === 'active') {
        if (useAuthStore.getState().status === 'authenticated') {
          useWalletStore.getState().refresh();
          reconcileUnfinishedCalls();
        }
      }
      last = next;
    });
    return () => sub.remove();
  }, []);
};

export default useAppBootstrap;
