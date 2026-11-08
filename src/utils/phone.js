import { parsePhoneNumberFromString, AsYouType } from 'libphonenumber-js/min';

const DEFAULT_COUNTRY = 'IN';

// Emergency / short / premium codes must go through the phone's own dialer.
const EMERGENCY_CODES = ['100', '101', '102', '108', '112', '1091', '1098', '181', '1930'];

export const stripNumber = raw => String(raw || '').replace(/[^\d+*#]/g, '');

// Cleans pasted text: keeps digits and a single leading '+'.
export const cleanPasted = raw => {
  const s = String(raw || '').trim();
  const allDigits = s.replace(/\D/g, '');
  // "+91..." or international prefix "0091..." / "(0091) ..." both mean a full international number.
  const plus = s.replace(/[\s()-]/g, '').startsWith('+') || allDigits.startsWith('00');
  const digits = allDigits.replace(/^00/, '');
  return (plus ? '+' : '') + digits;
};

export const isShortOrEmergencyCode = raw => {
  let digits = String(raw || '').replace(/\D/g, '');
  // "+91 112" / "0091112" are still short codes
  if (/^(\+|00)?91/.test(String(raw || '').replace(/[\s()-]/g, '')) && digits.length <= 7) {
    digits = digits.replace(/^(00)?91/, '');
  }
  if (!digits) {
    return false;
  }
  if (EMERGENCY_CODES.includes(digits)) {
    return true;
  }
  // 1xx / 1xxx / 1xxxx service codes (but not 10-digit numbers)
  return digits.startsWith('1') && digits.length <= 5;
};

export const isPremiumNumber = e164 => /^\+91(1860|1900)/.test(e164 || '');

// Toll-free / special service ranges (1800, 1860, 1900) - not reachable over VoIP termination.
export const isSpecialServiceNumber = raw => {
  const d = String(raw || '')
    .replace(/\D/g, '')
    .replace(/^(00)?91(?=1[89]\d{2})/, '')
    .replace(/^0(?=1[89]\d{2})/, '');
  return /^(1800|1860|1900)\d{3,8}$/.test(d);
};

export const normalizeToE164 = (raw, country = DEFAULT_COUNTRY) => {
  const cleaned = cleanPasted(raw);
  if (!cleaned) {
    return null;
  }
  let candidate = cleaned;
  // Indian numbers typed with leading 0 (trunk prefix) or 91 without '+'
  if (!candidate.startsWith('+')) {
    if (candidate.length === 12 && candidate.startsWith('91')) {
      candidate = `+${candidate}`;
    }
  }
  const parsed = parsePhoneNumberFromString(candidate, country);
  if (!parsed || !parsed.isValid()) {
    return null;
  }
  return parsed.number;
};

export const isIndianMobile = e164 => /^\+91[6-9]\d{9}$/.test(e164 || '');
export const isIndianNumber = e164 => /^\+91\d{10}$/.test(e164 || '');

/**
 * Validate dialpad input.
 * Returns { ok, e164, reason } where reason is one of:
 * 'empty' | 'emergency' | 'invalid' | 'not_india' | 'premium'
 */
export const validateDialInput = raw => {
  const cleaned = cleanPasted(raw);
  if (!cleaned) {
    return { ok: false, e164: null, reason: 'empty' };
  }
  if (isShortOrEmergencyCode(cleaned)) {
    return { ok: false, e164: null, reason: 'emergency' };
  }
  if (isSpecialServiceNumber(cleaned)) {
    return { ok: false, e164: null, reason: 'premium' };
  }
  const e164 = normalizeToE164(cleaned);
  if (!e164) {
    return { ok: false, e164: null, reason: 'invalid' };
  }
  if (!isIndianNumber(e164)) {
    return { ok: false, e164, reason: 'not_india' };
  }
  if (isPremiumNumber(e164)) {
    return { ok: false, e164, reason: 'premium' };
  }
  return { ok: true, e164, reason: null };
};

export const formatAsYouType = (raw, country = DEFAULT_COUNTRY) => {
  const s = String(raw || '');
  if (!s || /[*#]/.test(s)) {
    return s;
  }
  return new AsYouType(country).input(s);
};

export const formatE164ForDisplay = e164 => {
  if (!e164) {
    return '';
  }
  const parsed = parsePhoneNumberFromString(e164);
  if (!parsed) {
    return e164;
  }
  if (parsed.country === 'IN' && isIndianMobile(e164)) {
    const n = parsed.nationalNumber;
    return `+91 ${n.slice(0, 5)} ${n.slice(5)}`;
  }
  return parsed.formatInternational();
};

// Last-10-digit key used for loose matching (contacts saved as 098765..., +91 98765..., etc.)
export const matchKey = raw => {
  const digits = String(raw || '').replace(/\D/g, '');
  return digits.slice(-10);
};
