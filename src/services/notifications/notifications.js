import notifee, { AndroidImportance, TriggerType } from '@notifee/react-native';
import { colors } from '@theme';
import { check, STATUS } from '@services/permissions/permissions';

const CHANNEL = 'rewards';
const SPIN_ID = 'free-spin-ready';

const ensureChannel = () =>
  notifee.createChannel({ id: CHANNEL, name: 'Rewards', importance: AndroidImportance.DEFAULT });

/** Local reminder when the next free spin becomes available (no server push needed). */
export const scheduleFreeSpinReminder = async nextFreeAt => {
  try {
    if (!nextFreeAt || (await check('notifications')) !== STATUS.GRANTED) {
      return;
    }
    const ts = new Date(nextFreeAt).getTime();
    if (ts <= Date.now()) {
      return;
    }
    await ensureChannel();
    await notifee.createTriggerNotification(
      {
        id: SPIN_ID,
        title: 'Your free spin is ready',
        body: 'Spin the wheel for free credits.',
        data: { link: 'callingkaro://spin' },
        android: {
          channelId: CHANNEL,
          smallIcon: 'ic_launcher',
          color: colors.primary,
          pressAction: { id: 'default' },
        },
      },
      { type: TriggerType.TIMESTAMP, timestamp: ts },
    );
  } catch (e) {
    // reminders are best-effort
  }
};

export const cancelFreeSpinReminder = () => notifee.cancelTriggerNotification(SPIN_ID).catch(() => {});
