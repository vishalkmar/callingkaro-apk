// Pure OTP-box logic (kept separate so it is unit-testable without rendering).

export const emptyOtp = (length = 6) => Array.from({ length }, () => '');

/**
 * Apply a text change to box `index`.
 * - single digit: sets box, focus moves to next
 * - paste (multi-char): fills from `index` onward, focus moves after last filled box
 * - empty text: clears box, focus stays
 * Returns { digits, focusIndex }.
 */
export const applyOtpChange = (digits, index, text) => {
  const next = [...digits];
  const clean = String(text || '').replace(/\D/g, '');
  if (!clean) {
    next[index] = '';
    return { digits: next, focusIndex: index };
  }
  if (clean.length === 1) {
    next[index] = clean;
    return { digits: next, focusIndex: Math.min(index + 1, digits.length - 1) };
  }
  // Paste: if the pasted string is the full code, fill from the start.
  const start = clean.length >= digits.length ? 0 : index;
  let last = start;
  for (let i = 0; i < clean.length && start + i < digits.length; i++) {
    next[start + i] = clean[i];
    last = start + i;
  }
  return { digits: next, focusIndex: Math.min(last + 1, digits.length - 1) };
};

/** Backspace on an already-empty box clears the previous one and moves focus back. */
export const applyOtpBackspace = (digits, index) => {
  const next = [...digits];
  if (next[index]) {
    next[index] = '';
    return { digits: next, focusIndex: index };
  }
  const prev = Math.max(index - 1, 0);
  next[prev] = '';
  return { digits: next, focusIndex: prev };
};

export const isOtpComplete = digits => digits.every(d => /^\d$/.test(d));
