// T9 keypad mapping for dialpad contact suggestions ("RAVI" -> "7284").
const MAP = {
  a: 2,
  b: 2,
  c: 2,
  d: 3,
  e: 3,
  f: 3,
  g: 4,
  h: 4,
  i: 4,
  j: 5,
  k: 5,
  l: 5,
  m: 6,
  n: 6,
  o: 6,
  p: 7,
  q: 7,
  r: 7,
  s: 7,
  t: 8,
  u: 8,
  v: 8,
  w: 9,
  x: 9,
  y: 9,
  z: 9,
};

export const T9_LETTERS = {
  1: '',
  2: 'ABC',
  3: 'DEF',
  4: 'GHI',
  5: 'JKL',
  6: 'MNO',
  7: 'PQRS',
  8: 'TUV',
  9: 'WXYZ',
  0: '+',
  '*': '',
  '#': '',
};

/** Each word of the name -> digits, joined by spaces so a match can start at any word. */
export const nameToT9 = name =>
  String(name || '')
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .map(w =>
      w
        .split('')
        .map(c => MAP[c] ?? '')
        .join(''),
    )
    .join(' ');

/** True if the typed digits match the start of any word of the name. */
export const t9Matches = (t9Name, digits) => {
  if (!digits) {
    return false;
  }
  return String(t9Name || '')
    .split(' ')
    .some(w => w.startsWith(digits));
};
