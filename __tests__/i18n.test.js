// Every t('a.b') key used in src exists in English AND Hindi, and {placeholders} match.
const fs = require('fs');
const path = require('path');
const en = require('../src/i18n/en').default || require('../src/i18n/en');
const hi = require('../src/i18n/hi').default || require('../src/i18n/hi');

const walk = dir =>
  fs.readdirSync(dir, { withFileTypes: true }).flatMap(d => {
    const p = path.join(dir, d.name);
    return d.isDirectory() ? walk(p) : /\.(js|jsx)$/.test(d.name) ? [p] : [];
  });
const get = (obj, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), obj);
const vars = s => (String(s).match(/\{(\w+)\}/g) || []).sort();

const used = new Set();
for (const f of walk(path.join(__dirname, '..', 'src'))) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([a-zA-Z0-9_.]+)'/g)) {
    used.add(m[1]);
  }
}

test('found keys to check', () => {
  expect(used.size).toBeGreaterThan(30);
});

test.each([...used].sort())('%s exists in en + hi with the same {placeholders}', key => {
  expect(typeof get(en, key)).toBe('string');
  expect(typeof get(hi, key)).toBe('string');
  expect(vars(get(hi, key))).toEqual(vars(get(en, key)));
});
