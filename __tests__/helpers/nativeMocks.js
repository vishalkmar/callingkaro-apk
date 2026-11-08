/* eslint-env jest */
// Extra native-module mocks needed to render full screens in Jest.
// Import this file at the top of a test (jest.mock calls are hoisted inside it).

jest.mock('react-native-svg', () => {
  const React = require('react');
  const { View } = require('react-native');
  const C = ({ children }) => React.createElement(View, null, children);
  return new Proxy({ __esModule: true, default: C }, { get: (t, k) => (k in t ? t[k] : C) });
});
jest.mock('react-native-linear-gradient', () => {
  const React = require('react');
  const { View } = require('react-native');
  return ({ children, style }) => React.createElement(View, { style }, children);
});
jest.mock('react-native-reanimated', () => {
  const React = require('react');
  const { View } = require('react-native');
  return {
    __esModule: true,
    default: { View: ({ children, style }) => React.createElement(View, { style }, children) },
    Easing: { out: () => () => 0, cubic: () => 0 },
    useSharedValue: v => ({ value: v }),
    useAnimatedStyle: () => ({}),
    withTiming: (v, cfg, cb) => {
      if (cb) {
        cb(true); // animation 'finishes' at once in tests
      }
      return v;
    },
  };
});
jest.mock('react-native-worklets', () => ({ scheduleOnRN: fn => fn() }));
jest.mock('react-native-gesture-handler/ReanimatedSwipeable', () => {
  const React = require('react');
  const { View, Pressable } = require('react-native');
  // A hidden button stands in for the swipe gesture: pressing it "opens" the row like a full swipe.
  return React.forwardRef(({ children, onSwipeableOpen }, ref) => {
    React.useImperativeHandle(ref, () => ({ close: () => {} }));
    return React.createElement(
      View,
      null,
      children,
      React.createElement(Pressable, { testID: 'swipe-open', onPress: () => onSwipeableOpen?.('right') }),
    );
  });
});
jest.mock('react-native-gesture-handler', () => {
  const React = require('react');
  const { View } = require('react-native');
  return { GestureHandlerRootView: ({ children }) => React.createElement(View, null, children) };
});
jest.mock('react-native-bootsplash', () => ({ hide: jest.fn(async () => {}) }));
jest.mock('react-native-sound', () => {
  const S = jest.fn().mockImplementation(() => ({
    isLoaded: () => false,
    getDuration: () => 30,
    getCurrentTime: cb => cb(0),
    play: jest.fn(),
    pause: jest.fn(),
    stop: jest.fn(),
    release: jest.fn(),
    setCurrentTime: jest.fn(),
  }));
  S.setCategory = jest.fn();
  S.MAIN_BUNDLE = '';
  return S;
});
jest.mock('react-native-incall-manager', () => ({
  setKeepScreenOn: jest.fn(),
  startProximitySensor: jest.fn(),
  stopProximitySensor: jest.fn(),
  start: jest.fn(),
  stop: jest.fn(),
  setForceSpeakerphoneOn: jest.fn(),
}));
jest.mock('@twilio/voice-react-native-sdk', () => {
  const Voice = jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    connect: jest.fn(),
    getAudioDevices: jest.fn(async () => ({ audioDevices: [] })),
  }));
  Voice.Event = { AudioDevicesUpdated: 'a', Error: 'e' };
  return {
    Voice,
    Call: { Event: {} },
    AudioDevice: { Type: { Earpiece: 'earpiece', Speaker: 'speaker', Bluetooth: 'bluetooth' } },
  };
});
jest.mock('react-native-google-mobile-ads', () => ({
  __esModule: true,
  default: () => ({ initialize: jest.fn(async () => {}) }),
  AdEventType: {},
  RewardedAdEventType: {},
  TestIds: { REWARDED: 'test' },
  AdsConsent: { gatherConsent: jest.fn(async () => ({})), showPrivacyOptionsForm: jest.fn(async () => {}) },
  RewardedAd: { createForAdRequest: jest.fn() },
}));
jest.mock('react-native-iap', () => ({
  ErrorCode: { UserCancelled: 'user-cancelled' },
  initConnection: jest.fn(async () => true),
  endConnection: jest.fn(),
  fetchProducts: jest.fn(),
  finishTransaction: jest.fn(),
  getAvailablePurchases: jest.fn(async () => []),
  purchaseErrorListener: jest.fn(() => ({ remove: jest.fn() })),
  purchaseUpdatedListener: jest.fn(() => ({ remove: jest.fn() })),
  requestPurchase: jest.fn(),
}));
jest.mock('react-native-contacts', () => ({
  getAllWithoutPhotos: jest.fn(async () => []),
  getAll: jest.fn(async () => []),
  openContactForm: jest.fn(async () => null),
}));
jest.mock('@notifee/react-native', () => ({
  __esModule: true,
  default: {
    createChannel: jest.fn(),
    createTriggerNotification: jest.fn(),
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
jest.mock('react-native-share', () => ({ open: jest.fn(async () => ({})) }));
jest.mock('react-native-in-app-review', () => ({ isAvailable: () => false, RequestInAppReview: jest.fn() }));
jest.mock('react-native-safe-area-context', () => require('react-native-safe-area-context/jest/mock').default);
jest.mock('@react-native-vector-icons/material-design-icons/static', () => {
  const React = require('react');
  const { Text } = require('react-native');
  return { MaterialDesignIcons: ({ name }) => React.createElement(Text, null, `icon:${name}`) };
});
jest.mock('react-native-pager-view', () => {
  const React = require('react');
  const { View } = require('react-native');
  // Class component: react-native-tab-view wraps it with Animated.createAnimatedComponent.
  class PagerView extends React.Component {
    setPage() {}
    setPageWithoutAnimation() {}
    setScrollEnabled() {}
    render() {
      return React.createElement(View, { style: this.props.style }, this.props.children);
    }
  }
  return { __esModule: true, default: PagerView };
});
