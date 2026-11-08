import en from './en';
import hi from './hi';

const DICTS = { en, hi };
let current = 'en';

export const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'हिन्दी' },
];

export const setLanguage = code => {
  current = DICTS[code] ? code : 'en';
};

export const getLanguage = () => current;

const lookup = (dict, key) => key.split('.').reduce((o, k) => (o == null ? undefined : o[k]), dict);

/** t('dialpad.balance', { min: 12 }) -> "Balance: 12 min". Falls back to English, then to the key. */
export const t = (key, vars) => {
  let s = lookup(DICTS[current], key);
  if (s === undefined) {
    s = lookup(en, key);
  }
  if (typeof s !== 'string') {
    return key;
  }
  return vars ? s.replace(/\{(\w+)\}/g, (_, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`)) : s;
};

export default t;
