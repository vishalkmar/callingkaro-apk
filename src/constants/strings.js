// English source strings. Hindi + language switching live in src/i18n (Phase 25).
export const STRINGS = {
  appName: 'CallingKaro',
  permissions: {
    contacts: 'Allow access to your address book to call your friends and relatives.',
    microphone: 'Microphone is needed so the other person can hear you during calls.',
    notifications:
      'Allow notifications to see your ongoing call, hang up from the notification shade and get reward alerts.',
    bluetooth: 'Allow Bluetooth so you can talk using your Bluetooth headset or car kit during calls.',
    storage: 'Storage access is only used to save and play your call recordings. Nothing else is read.',
    continue: 'Continue',
    notNow: 'Not Now',
    openSettings: 'Open Settings',
    blockedHint: 'Permission is blocked. Open Settings > Permissions to allow it.',
    micRequired: 'Calls cannot work without the microphone. Please allow it to continue.',
  },
  dialpad: {
    noContactsAccess:
      'The CallingKaro app does not have access to your contacts. Allow {link} to pick a number from your address book',
    accessToContacts: 'Access to Contacts',
    notEnoughTitle: 'Not enough credits',
    notEnoughMsg: 'You need at least 1 minute (1000 credits) to make a call. Buy minutes or earn free credits.',
    emergency: 'Emergency and short service numbers (100, 112, 1xx) must be dialled from your phone dialer.',
    invalid: 'Enter a valid Indian mobile or landline number.',
    notIndia: 'Only Indian numbers (+91) can be called right now.',
    premium:
      'Toll-free and special service numbers (1800, 1860, 1900) cannot be called from CallingKaro. Use your phone dialer.',
    offline: 'You are offline. Connect to the internet to call.',
  },
  welcome: {
    body: 'CallingKaro lets you call any mobile or landline number in India over the internet. The person you call gets a normal phone call. Calls use credits (1000 credits = 1 minute) that you buy as minute packs or earn for free by watching ads and spinning the wheel. We use your email to sign you in, your call details (number, time, duration) for billing, and an advertising ID for rewarded ads. Your contacts and call history stay on your phone. Please read the CallingKaro {privacy} and {terms} before proceeding.',
    privacy: 'Privacy Policy',
    terms: 'Terms of Use',
    checkbox: 'I understand and accept the CallingKaro Privacy Policy and Terms of Use',
    ok: 'OK',
  },
  auth: {
    tagline: 'Call any number in India using credits. Login with your email to continue.',
    emailPlaceholder: 'Your email address',
    sendOtp: 'Send OTP',
    verifyTitle: 'Verify your email',
    codeSentTo: 'Enter the 6-digit code sent to',
    verify: 'Verify',
    changeEmail: 'Change email',
    resendIn: 'Resend in',
    resend: 'Resend code',
  },
};

export default STRINGS;
