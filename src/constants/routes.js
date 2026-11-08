// Every screen / navigator name lives here - never use magic strings in navigation calls.
export const STACKS = {
  ONBOARDING: 'OnboardingStack',
  AUTH: 'AuthStack',
  PERMISSIONS: 'PermissionStack',
  MAIN: 'MainStack',
  BLOCKED: 'BlockedStack',
};

export const ROUTES = {
  // Onboarding
  SPLASH: 'Splash',
  WELCOME: 'Welcome',
  LEGAL: 'Legal',

  // Auth
  EMAIL_ENTRY: 'EmailEntry',
  OTP_VERIFY: 'OtpVerify',

  // Permissions
  CONTACTS_PERMISSION: 'ContactsPermission',
  MIC_PERMISSION: 'MicPermission',
  NOTIFICATION_PERMISSION: 'NotificationPermission',
  BLUETOOTH_PERMISSION: 'BluetoothPermission',
  STORAGE_PERMISSION: 'StoragePermission',

  // Main tabs
  MAIN_TABS: 'MainTabs',
  DIALPAD: 'Dialpad',
  CONTACTS: 'Contacts',
  RECENT: 'Recent',
  GET_MINUTES: 'GetMinutes',

  // Main stack
  CALL_DETAILS: 'CallDetails',
  IN_CALL: 'InCall',
  SETTINGS: 'Settings',
  PROFILE: 'Profile',
  RECORDINGS: 'Recordings',
  WALLET_HISTORY: 'WalletHistory',
  SPIN_WHEEL: 'SpinWheel',
  PACKAGES: 'Packages',
  HELP: 'Help',
  REPORT: 'Report',
  ABOUT: 'About',
  BLOCKED: 'Blocked',
  COMPONENT_GALLERY: 'ComponentGallery',
};
