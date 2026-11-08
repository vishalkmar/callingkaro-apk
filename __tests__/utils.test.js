import {
  creditsToMinutes,
  creditsToSeconds,
  formatDuration,
  formatTimer,
  formatNumber,
  formatCredits,
  dayGroup,
  formatCountdown,
} from '@utils/format';
import {
  validateDialInput,
  normalizeToE164,
  cleanPasted,
  isShortOrEmergencyCode,
  formatE164ForDisplay,
  matchKey,
} from '@utils/phone';
import { validateEmail, isValidOtp, authErrorMessage } from '@utils/validators';
import { nameToT9, t9Matches } from '@utils/t9';
import { applyOtpChange, applyOtpBackspace, emptyOtp, isOtpComplete } from '@components/common/otpLogic';

describe('creditsToMinutes', () => {
  test.each([
    [0, 0],
    [999, 0],
    [1000, 1],
    [1999, 1],
    [80000, 80],
    [-50, 0],
    [null, 0],
    ['abc', 0],
  ])('%p credits -> %p min', (c, m) => expect(creditsToMinutes(c)).toBe(m));

  test('seconds mirror of the server maxSeconds', () => {
    expect(creditsToSeconds(1000)).toBe(60);
    expect(creditsToSeconds(2250)).toBe(135);
  });
});

describe('format', () => {
  test('durations and timers', () => {
    expect(formatDuration(0)).toBe('0:00');
    expect(formatDuration(135)).toBe('2:15');
    expect(formatDuration(3725)).toBe('1:02:05');
    expect(formatTimer(42)).toBe('00:42');
  });
  test('numbers', () => {
    expect(formatNumber(2250)).toBe('2,250');
    expect(formatCredits(80000)).toBe('80,000 cr');
  });
  test('day groups', () => {
    const now = new Date(2026, 9, 6, 15).getTime();
    expect(dayGroup(new Date(2026, 9, 6, 1).getTime(), now)).toBe('Today');
    expect(dayGroup(new Date(2026, 9, 5, 23).getTime(), now)).toBe('Yesterday');
    expect(dayGroup(new Date(2026, 9, 2).getTime(), now)).toBe('This week');
    expect(dayGroup(new Date(2026, 8, 1).getTime(), now)).toBe('Older');
  });
  test('countdown', () => {
    expect(formatCountdown(Date.now() + 18750 * 1000, Date.now())).toBe('05:12:30');
  });
});

describe('phone rules', () => {
  test('valid Indian mobile & landline', () => {
    expect(validateDialInput('9876543210')).toMatchObject({ ok: true, e164: '+919876543210' });
    expect(validateDialInput('+91 98765 43210')).toMatchObject({ ok: true, e164: '+919876543210' });
    expect(validateDialInput('09876543210').ok).toBe(true);
    expect(validateDialInput('011 2345 6789')).toMatchObject({ ok: true, e164: '+911123456789' });
  });
  test('emergency / short codes are blocked', () => {
    for (const n of ['100', '112', '108', '1098', '139']) {
      expect(validateDialInput(n).reason).toBe('emergency');
      expect(isShortOrEmergencyCode(n)).toBe(true);
    }
  });
  test('invalid and foreign numbers', () => {
    expect(validateDialInput('12345').ok).toBe(false);
    expect(validateDialInput('').reason).toBe('empty');
    expect(validateDialInput('+14155552671').reason).toBe('not_india');
  });
  test('paste cleanup and display', () => {
    expect(cleanPasted(' +91-98765 43210 ')).toBe('+919876543210');
    expect(cleanPasted('(0091) 98765-43210')).toBe('+919876543210');
    expect(formatE164ForDisplay('+919876543210')).toBe('+91 98765 43210');
    expect(normalizeToE164('919876543210')).toBe('+919876543210');
    expect(matchKey('+91 98765 43210')).toBe('9876543210');
  });
});

describe('validators', () => {
  test('email', () => {
    expect(validateEmail('ravi@example.com')).toBeNull();
    expect(validateEmail('  RAVI@Example.com ')).toBeNull();
    expect(validateEmail('')).toMatch(/enter/i);
    expect(validateEmail('ravi@')).toMatch(/valid/i);
    expect(validateEmail('ravi example.com')).toMatch(/valid/i);
  });
  test('otp', () => {
    expect(isValidOtp('123456')).toBe(true);
    expect(isValidOtp('12345')).toBe(false);
    expect(isValidOtp('12a456')).toBe(false);
  });
  test('server error codes map to friendly messages', () => {
    expect(authErrorMessage({ code: 'OTP_INVALID', data: { attemptsLeft: 2 } })).toMatch(/2 attempt/);
    expect(authErrorMessage({ code: 'OTP_EXPIRED' })).toMatch(/expired/i);
    expect(authErrorMessage({ code: 'OTP_LOCKED' })).toMatch(/15 minutes/);
  });
});

describe('T9', () => {
  test('name to digits', () => {
    expect(nameToT9('Ravi Kumar')).toBe('7284 58627');
    expect(t9Matches(nameToT9('Ravi Kumar'), '586')).toBe(true);
    expect(t9Matches(nameToT9('Ravi Kumar'), '999')).toBe(false);
  });
});

describe('OtpInput logic', () => {
  test('typing moves focus forward', () => {
    const r = applyOtpChange(emptyOtp(), 0, '4');
    expect(r.digits[0]).toBe('4');
    expect(r.focusIndex).toBe(1);
  });
  test('paste fills all boxes', () => {
    const r = applyOtpChange(emptyOtp(), 2, '123456');
    expect(r.digits.join('')).toBe('123456');
    expect(isOtpComplete(r.digits)).toBe(true);
  });
  test('non-digits ignored', () => {
    expect(applyOtpChange(emptyOtp(), 0, 'a').digits[0]).toBe('');
  });
  test('backspace on empty box goes to previous', () => {
    const d = ['1', '2', '', '', '', ''];
    const r = applyOtpBackspace(d, 2);
    expect(r.focusIndex).toBe(1);
    expect(r.digits[1]).toBe('');
  });
});
