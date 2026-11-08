import * as Keychain from 'react-native-keychain';
import logger from '@utils/logger';

// Tokens live ONLY in Android Keystore-backed storage (never AsyncStorage). Memory cache avoids
// a Keystore round-trip on every request.
const SERVICE = 'com.callingkaro.app.tokens';
let cache = null;

export const saveTokens = async ({ accessToken, refreshToken }) => {
  cache = { accessToken, refreshToken };
  await Keychain.setGenericPassword('callingkaro', JSON.stringify(cache), {
    service: SERVICE,
    accessible: Keychain.ACCESSIBLE?.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
  });
};

export const loadTokens = async () => {
  if (cache) {
    return cache;
  }
  try {
    const creds = await Keychain.getGenericPassword({ service: SERVICE });
    if (creds && creds.password) {
      cache = JSON.parse(creds.password);
      return cache;
    }
  } catch (e) {
    logger.warn('secureStore: could not read tokens', e?.message);
  }
  return null;
};

export const getAccessToken = () => cache?.accessToken || null;
export const getRefreshToken = () => cache?.refreshToken || null;

export const clearTokens = async () => {
  cache = null;
  try {
    await Keychain.resetGenericPassword({ service: SERVICE });
  } catch (e) {
    logger.warn('secureStore: could not clear tokens', e?.message);
  }
};
