/**
 * Keeps a Telnyx call alive when the user leaves the app: an ongoing "call" notification backed by a
 * microphone foreground service (Android blocks the mic for background apps without one). Twilio's SDK
 * runs its own service, so this is only used for Telnyx calls.
 */
import notifee, { AndroidImportance, AndroidForegroundServiceType } from '@notifee/react-native';
import { colors } from '@theme';
import logger from '@utils/logger';

const log = logger.scope('callfg');

const CHANNEL = 'ongoing-call';
const NOTIFICATION_ID = 'ongoing-call';

let release = null; // resolves the service task -> Android stops the service

/** Called once at start-up (index.js): the service lives until stopCallService() resolves its promise. */
export const registerCallService = () => {
  notifee.registerForegroundService(
    () =>
      new Promise(resolve => {
        release = resolve;
      }),
  );
};

export const startCallService = async ({ title }) => {
  try {
    await notifee.createChannel({ id: CHANNEL, name: 'Ongoing call', importance: AndroidImportance.LOW });
    await notifee.displayNotification({
      id: NOTIFICATION_ID,
      title,
      body: 'Call in progress',
      android: {
        channelId: CHANNEL,
        asForegroundService: true,
        foregroundServiceTypes: [AndroidForegroundServiceType.FOREGROUND_SERVICE_TYPE_MICROPHONE],
        ongoing: true,
        smallIcon: 'ic_launcher',
        color: colors.primary,
        pressAction: { id: 'default' },
      },
    });
  } catch (e) {
    log.warn('start', e?.message); // the call still works while the app is open
  }
};

export const stopCallService = async () => {
  try {
    release?.();
    release = null;
    await notifee.stopForegroundService();
    await notifee.cancelNotification(NOTIFICATION_ID);
  } catch (e) {
    log.warn('stop', e?.message);
  }
};
