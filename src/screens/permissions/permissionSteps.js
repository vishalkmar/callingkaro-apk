import { Platform } from 'react-native';
import { ROUTES } from '@constants/routes';
import { STRINGS } from '@constants/strings';

const api = Platform.OS === 'android' ? Number(Platform.Version) : 0;

const ALL_STEPS = [
  {
    route: ROUTES.CONTACTS_PERMISSION,
    key: 'contacts',
    icon: 'card-account-phone-outline',
    text: STRINGS.permissions.contacts,
    required: false,
    minApi: 0,
  },
  {
    route: ROUTES.MIC_PERMISSION,
    key: 'microphone',
    icon: 'microphone-outline',
    text: STRINGS.permissions.microphone,
    required: true,
    minApi: 0,
  },
  {
    route: ROUTES.NOTIFICATION_PERMISSION,
    key: 'notifications',
    icon: 'bell-ring-outline',
    text: STRINGS.permissions.notifications,
    required: false,
    minApi: 33,
  },
  {
    route: ROUTES.BLUETOOTH_PERMISSION,
    key: 'bluetooth',
    icon: 'headset',
    text: STRINGS.permissions.bluetooth,
    required: false,
    minApi: 31,
  },
  {
    route: ROUTES.STORAGE_PERMISSION,
    key: 'storage',
    icon: 'folder-music-outline',
    text: STRINGS.permissions.storage,
    required: false,
    minApi: 0,
  },
];

// Only the steps that make sense on this Android version.
export const PERMISSION_STEPS = ALL_STEPS.filter(s => api >= s.minApi);

export default PERMISSION_STEPS;
