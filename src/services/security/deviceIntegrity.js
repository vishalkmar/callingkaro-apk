import DeviceInfo from 'react-native-device-info';
import { exists } from '@dr.pogodin/react-native-fs';
import logger from '@utils/logger';

// Simple, offline signals. They can be faked, so the server treats them as one input among many
// (device binding, caps, optional Play Integrity). Free rewards are disabled when they fire.
const SU_PATHS = [
  '/system/bin/su',
  '/system/xbin/su',
  '/sbin/su',
  '/system/app/Superuser.apk',
  '/data/local/xbin/su',
  '/data/local/bin/su',
];

let cached = null;

export const getIntegrity = async () => {
  if (cached) {
    return cached;
  }
  let emulator = false;
  let rooted = false;
  try {
    emulator = await DeviceInfo.isEmulator();
  } catch (e) {
    logger.warn('isEmulator failed', e?.message);
  }
  try {
    const checks = await Promise.all(SU_PATHS.map(p => exists(p).catch(() => false)));
    rooted = checks.some(Boolean);
  } catch (e) {
    // ignore
  }
  // Debug builds on an emulator are normal for developers - do not flag them.
  cached = { emulator: emulator && !__DEV__, rooted };
  return cached;
};

export const integrityHeader = ({ emulator, rooted }) => `emulator=${emulator ? 1 : 0};rooted=${rooted ? 1 : 0}`;
