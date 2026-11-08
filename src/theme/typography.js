export const fontSize = {
  micro: 10,
  caption: 12,
  body: 14,
  label: 16,
  title: 18,
  header: 22,
  callName: 28,
  keypad: 34,
  keypadLarge: 38,
  keypadCompact: 30,
};

// Cap for the phone's "font size" setting (Largest = 2x). Normal text may grow 40%; text inside
// fixed-size boxes (keypad keys, OTP boxes, badges, tab labels) only 15-20% so nothing clips.
export const FONT_SCALE = { max: 1.4, dense: 1.2, fixed: 1 };

export const fontWeight = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  light: '300',
};

export const typography = {
  caption: { fontSize: fontSize.caption, fontWeight: fontWeight.regular, lineHeight: 16 },
  body: { fontSize: fontSize.body, fontWeight: fontWeight.regular, lineHeight: 20 },
  label: { fontSize: fontSize.label, fontWeight: fontWeight.medium, lineHeight: 22 },
  title: { fontSize: fontSize.title, fontWeight: fontWeight.semibold, lineHeight: 24 },
  header: { fontSize: fontSize.header, fontWeight: fontWeight.bold, lineHeight: 28 },
  callName: { fontSize: fontSize.callName, fontWeight: fontWeight.semibold, lineHeight: 34 },
  keypad: { fontSize: fontSize.keypad, fontWeight: fontWeight.light, lineHeight: 40 },
};

export default typography;
