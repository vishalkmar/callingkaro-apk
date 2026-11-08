// Phase 28 checks that can run without a phone: colour contrast (T13), font-size cap (T12),
// pressed feedback (T07), screen-reader labels (T14), typography tokens (T09), lazy screens (T02), dev screens (T18).
import fs from 'fs';
import path from 'path';
import React from 'react';
import { render } from '@testing-library/react-native';
import { AppText } from '@components/common';
import { lightColors, darkColors } from '@theme/colors';
import { FONT_SCALE } from '@theme';

const SRC = path.join(__dirname, '..', 'src');
const sources = (dir = SRC) =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    if (d.isDirectory()) {
      return sources(p);
    }
    return /\.jsx?$/.test(d.name) ? [{ file: path.relative(SRC, p).replace(/\\/g, '/'), code: fs.readFileSync(p, 'utf8') }] : [];
  });
const ALL = sources();

/** Every `<Tag ...>` opening tag in a file (braces tracked, so `=>` inside props does not end the tag). */
const openingTags = (code, tag) => {
  const out = [];
  const re = new RegExp(`<${tag}\\b`, 'g');
  let m;
  while ((m = re.exec(code))) {
    let depth = 0;
    let i = m.index + tag.length + 1;
    for (; i < code.length; i++) {
      const c = code[i];
      if (c === '{') {
        depth++;
      } else if (c === '}') {
        depth--;
      } else if (c === '>' && depth === 0) {
        break;
      }
    }
    out.push({ text: code.slice(m.index, i + 1), line: code.slice(0, m.index).split('\n').length });
  }
  return out;
};

const luminance = hex => {
  const [r, g, b] = [1, 3, 5]
    .map(i => parseInt(hex.substr(i, 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
};
const contrast = (a, b) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
};

describe('P28.T13 colour contrast (WCAG AA 4.5:1 for normal text)', () => {
  const TEXT = ['text', 'subtext', 'primaryText', 'successText', 'dangerText'];
  const failing = (palette, bgs) =>
    bgs.flatMap(bg =>
      TEXT.filter(t => contrast(palette[t], palette[bg]) < 4.5).map(
        t => `${t} on ${bg} = ${contrast(palette[t], palette[bg]).toFixed(2)}`,
      ),
    );
  test('light: every text colour is readable on every light background', () => {
    expect(failing(lightColors, ['background', 'surface', 'surfaceAlt', 'primarySoft', 'successSoft', 'dangerSoft'])).toEqual([]);
  });
  test('dark: every text colour is readable on every dark background', () => {
    expect(failing(darkColors, ['background', 'surface', 'surfaceAlt', 'primarySoft', 'successSoft', 'dangerSoft'])).toEqual([]);
  });
  test('the brand fill orange really is too light for text (why primaryText exists)', () => {
    expect(contrast(lightColors.primary, lightColors.background)).toBeLessThan(3);
  });
  test('AppText color="primary|success|danger" uses the readable text shades', () => {
    for (const [name, token] of [
      ['primary', 'primaryText'],
      ['success', 'successText'],
      ['danger', 'dangerText'],
    ]) {
      const { getByText } = render(<AppText color={name}>{name}</AppText>);
      const style = [getByText(name).props.style].flat(Infinity).reduce((a, s) => ({ ...a, ...s }), {});
      expect(style.color).toBe(lightColors[token]);
    }
  });
  test('no screen styles text with a fill colour (use primaryText / successText / dangerText)', () => {
    const bad = ALL.filter(f => !f.file.startsWith('theme/') && !f.file.startsWith('services/')).flatMap(f =>
      f.code
        .split('\n')
        .map((l, i) => ({ l, at: `${f.file}:${i + 1}` }))
        .filter(({ l }) => /(^|[{,\s])color: colors\.(primary|primaryDark|success|successDark|danger)\b/.test(l))
        .filter(({ l }) => !/android_ripple/.test(l))
        .map(({ at }) => at),
    );
    expect(bad).toEqual([]);
  });
});

describe('P28.T12 font scaling (system font size Large / Largest)', () => {
  const multiplier = el => el.props.maxFontSizeMultiplier;
  test('normal text may grow, big display text grows less', () => {
    const { getByText } = render(
      <>
        <AppText>body</AppText>
        <AppText variant="keypad">7</AppText>
        <AppText variant="header">Title</AppText>
      </>,
    );
    expect(multiplier(getByText('body'))).toBe(FONT_SCALE.max);
    expect(multiplier(getByText('7'))).toBe(FONT_SCALE.dense);
    expect(multiplier(getByText('Title'))).toBe(FONT_SCALE.dense);
  });
  test('a caller can still tighten the cap (fixed-size boxes)', () => {
    const { getByText } = render(<AppText maxFontSizeMultiplier={1}>A</AppText>);
    expect(multiplier(getByText('A'))).toBe(1);
  });
  test('every TextInput has a font-size cap', () => {
    const missing = ALL.flatMap(f =>
      openingTags(f.code, 'TextInput')
        .filter(t => !/maxFontSizeMultiplier=/.test(t.text))
        .map(t => `${f.file}:${t.line}`),
    );
    expect(missing).toEqual([]);
  });
  test('all text goes through AppText (so the cap applies everywhere)', () => {
    const raw = ALL.filter(f => f.file !== 'components/common/AppText.jsx')
      .filter(f => /import \{[^}]*\bText\b[^}]*\} from 'react-native'/.test(f.code))
      .map(f => f.file);
    expect(raw).toEqual([]);
  });
});

describe('P28.T07 / T14 touchables', () => {
  const pressables = ALL.flatMap(f => openingTags(f.code, 'Pressable').map(t => ({ ...t, at: `${f.file}:${t.line}` })));
  // A dialog backdrop and the "swallow taps" card inside it are not buttons.
  const isButton = t => !/styles\.backdrop|onPress=\{\(\) => \{\}\}/.test(t.text);

  test('found the app touchables (scanner sanity)', () => {
    expect(pressables.filter(isButton).length).toBeGreaterThan(30);
  });
  test('every button shows pressed feedback (ripple or pressed style)', () => {
    const bad = pressables.filter(isButton).filter(t => !/android_ripple|pressed/.test(t.text));
    expect(bad.map(t => t.at)).toEqual([]);
  });
  test('every icon-only button (hitSlop) has a screen-reader label', () => {
    const bad = pressables.filter(isButton).filter(t => /hitSlop/.test(t.text) && !/accessibilityLabel/.test(t.text));
    expect(bad.map(t => t.at)).toEqual([]);
  });
  test('every button has a role or label for TalkBack', () => {
    const bad = pressables.filter(isButton).filter(t => !/accessibilityRole|accessibilityLabel|\{\.\.\.rest\}|\{\.\.\.props\}/.test(t.text));
    expect(bad.map(t => t.at)).toEqual([]);
  });
});

describe('P28.T09 / T02 / T18 code rules', () => {
  test('no raw numeric font sizes in styles (theme fontSize tokens only)', () => {
    const bad = ALL.filter(f => !f.file.startsWith('theme/')).flatMap(f =>
      f.code
        .split('\n')
        .map((l, i) => ({ l, at: `${f.file}:${i + 1}` }))
        .filter(({ l }) => /fontSize: \d/.test(l))
        .map(({ at }) => at),
    );
    expect(bad).toEqual([]);
  });
  test('heavy screens (Spin wheel, Recordings) load lazily', () => {
    const stack = ALL.find(f => f.file === 'navigation/MainStack.jsx').code;
    expect(stack).toMatch(/getComponent=\{\(\) => require\('@screens\/wallet\/SpinWheelScreen'\)/);
    expect(stack).toMatch(/getComponent=\{\(\) => require\('@screens\/settings\/RecordingsScreen'\)/);
  });
  test('the dev component gallery is only registered in debug builds', () => {
    const stack = ALL.find(f => f.file === 'navigation/MainStack.jsx').code;
    expect(stack).toMatch(/__DEV__ \? <Stack\.Screen name=\{ROUTES\.COMPONENT_GALLERY\}/);
  });
});
