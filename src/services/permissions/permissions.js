import { Platform } from 'react-native';
import {
  PERMISSIONS,
  RESULTS,
  check as rnpCheck,
  request as rnpRequest,
  checkNotifications,
  requestNotifications,
  openSettings as rnpOpenSettings,
} from 'react-native-permissions';
import logger from '@utils/logger';

const api = Platform.OS === 'android' ? Number(Platform.Version) : 0;

/**
 * App-level permission names -> Android permission.
 * Storage: Android 13+ READ_MEDIA_AUDIO, older READ_EXTERNAL_STORAGE. Recordings themselves are saved in the
 * app-specific folder which needs no permission - this is only for exporting / playing from the public folder.
 */
const ANDROID_MAP = {
  contacts: PERMISSIONS.ANDROID.READ_CONTACTS,
  microphone: PERMISSIONS.ANDROID.RECORD_AUDIO,
  bluetooth: api >= 31 ? PERMISSIONS.ANDROID.BLUETOOTH_CONNECT : null,
  storage: api >= 33 ? PERMISSIONS.ANDROID.READ_MEDIA_AUDIO : PERMISSIONS.ANDROID.READ_EXTERNAL_STORAGE,
  storageWrite: api <= 29 ? PERMISSIONS.ANDROID.WRITE_EXTERNAL_STORAGE : null, // Android 10 legacy storage writes too
};

export const PERMISSION_NAMES = ['contacts', 'microphone', 'notifications', 'bluetooth', 'storage'];

export const STATUS = {
  GRANTED: 'granted',
  DENIED: 'denied', // can ask again
  BLOCKED: 'blocked', // "don't ask again" / denied twice -> only Settings can change it
  UNAVAILABLE: 'unavailable', // not needed on this Android version
};

const normalize = r => {
  switch (r) {
    case RESULTS.GRANTED:
    case RESULTS.LIMITED:
      return STATUS.GRANTED;
    case RESULTS.BLOCKED:
      return STATUS.BLOCKED;
    case RESULTS.UNAVAILABLE:
      return STATUS.UNAVAILABLE;
    default:
      return STATUS.DENIED;
  }
};

/** check(name) -> 'granted' | 'denied' | 'blocked' | 'unavailable' (never prompts). */
export const check = async name => {
  try {
    if (name === 'notifications') {
      if (api < 33) {
        return STATUS.GRANTED; // runtime prompt only exists on Android 13+
      }
      const { status } = await checkNotifications();
      return normalize(status);
    }
    const perm = ANDROID_MAP[name];
    if (!perm) {
      return name === 'bluetooth' ? STATUS.GRANTED : STATUS.UNAVAILABLE;
    }
    return normalize(await rnpCheck(perm));
  } catch (e) {
    logger.warn('permission check failed', name, e?.message);
    return STATUS.DENIED;
  }
};

/**
 * request(name) shows the system dialog. Android "Only this time" grants are reported as granted
 * for the session and re-checked on every screen focus (usePermission), so one-time grants are respected.
 */
export const request = async name => {
  try {
    if (name === 'notifications') {
      if (api < 33) {
        return STATUS.GRANTED;
      }
      const { status } = await requestNotifications(['alert', 'sound']);
      return normalize(status);
    }
    const perm = ANDROID_MAP[name];
    if (!perm) {
      return name === 'bluetooth' ? STATUS.GRANTED : STATUS.UNAVAILABLE;
    }
    const result = normalize(await rnpRequest(perm));
    if (name === 'storage' && result === STATUS.GRANTED && ANDROID_MAP.storageWrite) {
      await rnpRequest(ANDROID_MAP.storageWrite);
    }
    return result;
  } catch (e) {
    logger.warn('permission request failed', name, e?.message);
    return STATUS.DENIED;
  }
};

export const openSettings = () => rnpOpenSettings().catch(() => {});

export const checkAll = async () => {
  const entries = await Promise.all(PERMISSION_NAMES.map(async n => [n, await check(n)]));
  return Object.fromEntries(entries);
};

export const isGranted = s => s === STATUS.GRANTED;
