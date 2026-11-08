import AsyncStorage from '@react-native-async-storage/async-storage';
import InAppReview from 'react-native-in-app-review';
import { STORAGE_KEYS } from '@constants/config';

const AFTER_CALLS = 5;

/** Google in-app review prompt once, after the 5th successful call (Google decides if it is shown). */
export const onSuccessfulCall = async () => {
  try {
    if ((await AsyncStorage.getItem(STORAGE_KEYS.RATE_PROMPT_SHOWN)) === 'true') {
      return;
    }
    const n = Number((await AsyncStorage.getItem(STORAGE_KEYS.SUCCESSFUL_CALLS)) || 0) + 1;
    await AsyncStorage.setItem(STORAGE_KEYS.SUCCESSFUL_CALLS, String(n));
    if (n >= AFTER_CALLS && InAppReview.isAvailable()) {
      await AsyncStorage.setItem(STORAGE_KEYS.RATE_PROMPT_SHOWN, 'true');
      setTimeout(() => InAppReview.RequestInAppReview().catch(() => {}), 2500);
    }
  } catch (e) {
    // never block the call flow
  }
};
