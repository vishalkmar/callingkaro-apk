// Client-side validation only improves UX - the server validates everything again.

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const normalizeEmail = email =>
  String(email || '')
    .trim()
    .toLowerCase();

/** Returns null when valid, otherwise a user-facing message. */
export const validateEmail = email => {
  const v = normalizeEmail(email);
  if (!v) {
    return 'Please enter your email address';
  }
  if (v.length > 254 || !EMAIL_RE.test(v)) {
    return 'Please enter a valid email address';
  }
  return null;
};

export const isValidOtp = otp => /^\d{6}$/.test(String(otp || ''));

// Server error code -> friendly message for the auth screens.
const AUTH_ERRORS = {
  OTP_INVALID: 'Wrong code. Please check the email and try again.',
  OTP_EXPIRED: 'This code has expired. Tap "Resend code" to get a new one.',
  OTP_LOCKED: 'Too many wrong attempts. Please try again in 15 minutes.',
  OTP_COOLDOWN: 'Please wait a moment before requesting another code.',
  OTP_HOURLY_LIMIT: 'Too many codes requested. Try again in an hour.',
  DISPOSABLE_EMAIL: 'Please use a permanent email address.',
  EMAIL_SEND_FAILED: 'Could not send code, try again.',
  DEVICE_LIMIT: 'Too many accounts on this phone. Login with your existing email.',
  USER_BLOCKED: 'This account has been blocked. Contact support.',
  VALIDATION_ERROR: 'Please check what you entered.',
  RATE_LIMITED: 'Too many requests. Please wait and try again.',
  NETWORK: 'Could not reach CallingKaro. Check your internet connection and try again.',
  TIMEOUT: 'The server took too long. Check your internet and try again.',
};

export const authErrorMessage = error => {
  const base = AUTH_ERRORS[error?.code] || error?.message || 'Something went wrong. Try again.';
  if (error?.code === 'OTP_INVALID' && typeof error?.data?.attemptsLeft === 'number') {
    return `${base} ${error.data.attemptsLeft} attempt(s) left.`;
  }
  return base;
};
