/* eslint-env jest */
// Native modules are mocked so unit/component tests run in Node.

jest.mock('react-native-config', () => ({ API_BASE_URL: 'http://localhost:5000' }));

// The package's own v3 mock (no multiGet/multiSet): a call to a removed v2 API fails here, not on the phone.
jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest'));

jest.mock('react-native-keychain', () => {
  let store = null;
  return {
    ACCESSIBLE: { WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'x' },
    setGenericPassword: jest.fn(async (u, p) => {
      store = { username: u, password: p };
      return true;
    }),
    getGenericPassword: jest.fn(async () => store || false),
    resetGenericPassword: jest.fn(async () => {
      store = null;
      return true;
    }),
  };
});

jest.mock('react-native-device-info', () => ({
  getUniqueId: jest.fn(async () => 'test-device-id'),
  isEmulator: jest.fn(async () => false),
  getVersion: () => '1.0',
  getBuildNumber: () => '1',
}));

jest.mock('@react-native-community/netinfo', () => require('@react-native-community/netinfo/jest/netinfo-mock.js'));

jest.mock('react-native-permissions', () => require('react-native-permissions/mock'));

jest.mock('@react-native-vector-icons/material-design-icons/static', () => {
  const { Text } = require('react-native');
  const Icon = ({ name, ...p }) => <Text {...p}>{`icon:${name}`}</Text>;
  return { MaterialDesignIcons: Icon };
});

jest.mock('react-native-toast-message', () => ({ __esModule: true, default: { show: jest.fn(), hide: jest.fn() } }));

jest.mock('@dr.pogodin/react-native-fs', () => ({
  exists: jest.fn(async () => false),
  DocumentDirectoryPath: '/docs',
  mkdir: jest.fn(async () => {}),
  unlink: jest.fn(async () => {}),
  stat: jest.fn(async () => ({ size: 0 })),
}));

jest.mock('@react-native-clipboard/clipboard', () => ({ getString: jest.fn(async () => ''), setString: jest.fn() }));

// Telnyx WebRTC SDK (TypeScript source + react-native-webrtc native code): never loaded in tests.
// __tests__/telnyxCall.test.js drives this fake client to test the adapter.
jest.mock('react-native-webrtc', () => ({}));
jest.mock('@telnyx/react-native-voice-sdk', () => ({ TelnyxRTC: jest.fn() }));

// Notifee needs its native module even to import; voiceService imports it (Telnyx ongoing-call service).
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(async () => 'channel'),
    createTriggerNotification: jest.fn(async () => {}),
    cancelTriggerNotification: jest.fn(async () => {}),
    registerForegroundService: jest.fn(),
    displayNotification: jest.fn(async () => {}),
    stopForegroundService: jest.fn(async () => {}),
    cancelNotification: jest.fn(async () => {}),
  },
  AndroidImportance: { DEFAULT: 3, LOW: 2 },
  AndroidForegroundServiceType: { FOREGROUND_SERVICE_TYPE_MICROPHONE: 128 },
  TriggerType: { TIMESTAMP: 0 },
}));
