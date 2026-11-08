import Contacts from 'react-native-contacts';
import * as contactsRepo from '@db/contactsRepo';
import { check, STATUS } from '@services/permissions/permissions';
import { normalizeToE164, cleanPasted } from '@utils/phone';
import logger from '@utils/logger';

const log = logger.scope('contacts');

/**
 * Phone contacts -> [{ id, name, numbers: [{ e164, label, raw }], thumbnail }]
 * - numbers normalised to E.164 (+91...) and de-duplicated inside each contact
 * - unnamed contacts whose numbers already exist on a named contact are dropped (fixes Image 5 duplicates)
 * Contacts NEVER leave the phone - nothing here talks to the server.
 */
export const mapPhoneContacts = raw => {
  const mapped = [];
  for (const c of raw || []) {
    const name = (c.displayName || [c.givenName, c.middleName, c.familyName].filter(Boolean).join(' ')).trim();
    const seen = new Set();
    const numbers = [];
    for (const p of c.phoneNumbers || []) {
      const e164 = normalizeToE164(p.number) || null;
      const key = e164 || cleanPasted(p.number);
      if (!key || seen.has(key)) {
        continue;
      }
      seen.add(key);
      numbers.push({ e164: e164 || key, label: p.label || 'mobile', raw: p.number, valid: !!e164 });
    }
    if (!numbers.length) {
      continue;
    }
    mapped.push({ id: String(c.recordID), name, numbers, thumbnail: c.hasThumbnail ? c.thumbnailPath : null });
  }

  // Same person saved twice (same name, at least one shared number) -> one row with all numbers merged.
  const merged = [];
  const byName = new Map();
  for (const c of mapped) {
    const key = c.name.toLowerCase().replace(/\s+/g, ' ');
    const twin = key
      ? (byName.get(key) || []).find(o => o.numbers.some(n => c.numbers.some(m => m.e164 === n.e164)))
      : null;
    if (twin) {
      for (const n of c.numbers) {
        if (!twin.numbers.some(m => m.e164 === n.e164)) {
          twin.numbers.push(n);
        }
      }
      twin.thumbnail = twin.thumbnail || c.thumbnail;
      continue;
    }
    merged.push(c);
    if (key) {
      byName.set(key, [...(byName.get(key) || []), c]);
    }
  }

  const namedNumbers = new Set(merged.filter(c => c.name).flatMap(c => c.numbers.map(n => n.e164)));
  const unnamedSeen = new Set();
  return merged.filter(c => {
    if (c.name) {
      return true;
    }
    const nums = c.numbers.map(n => n.e164);
    if (nums.every(n => namedNumbers.has(n) || unnamedSeen.has(n))) {
      return false;
    }
    nums.forEach(n => unnamedSeen.add(n));
    return true;
  });
};

/** Search: name contains the text, or the number contains the typed digits (leading 0 / 91 ignored). */
export const filterContacts = (contacts, query) => {
  const q = String(query || '')
    .trim()
    .toLowerCase();
  if (!q) {
    return contacts;
  }
  const digits = q.replace(/\D/g, '').replace(/^0+/, '');
  return contacts.filter(
    c =>
      c.name.toLowerCase().includes(q) ||
      (digits.length >= 2 && c.numbers.some(n => n.e164.replace(/\D/g, '').includes(digits))),
  );
};

/** Title shown in lists: the name, or the number for unnamed contacts. */
export const titleOf = c => c.name || c.numbers[0]?.e164 || '';

/** Section key: A-Z, '+' for unnamed international numbers, '#' for everything else. */
export const sectionOf = c => {
  const first = titleOf(c).charAt(0).toUpperCase();
  if (/[A-Z]/.test(first)) {
    return first;
  }
  return first === '+' ? '+' : '#';
};

const SECTION_ORDER = s => (s === '#' ? '0' : s === '+' ? '1' : `2${s}`);

/** Flattens contacts into [{type:'header'} | {type:'row'}] with sections sorted A-Z, '#', '+' first. */
export const buildSections = contacts => {
  const groups = new Map();
  for (const c of contacts) {
    const s = sectionOf(c);
    if (!groups.has(s)) {
      groups.set(s, []);
    }
    groups.get(s).push(c);
  }
  const keys = [...groups.keys()].sort((a, b) => SECTION_ORDER(a).localeCompare(SECTION_ORDER(b)));
  const items = [];
  for (const k of keys) {
    items.push({ type: 'header', key: `h-${k}`, title: k });
    groups
      .get(k)
      .sort((a, b) => titleOf(a).localeCompare(titleOf(b)))
      .forEach(c => items.push({ type: 'row', key: `c-${c.id}`, contact: c }));
  }
  return { items, letters: keys };
};

/** Reads phone contacts in the background (after animations) and refreshes the local cache. */
export const syncFromPhone = async () => {
  if ((await check('contacts')) !== STATUS.GRANTED) {
    return null;
  }
  // RN 0.87 removed InteractionManager: wait for an idle frame so the tab animation stays smooth.
  await new Promise(resolve =>
    global.requestIdleCallback ? global.requestIdleCallback(() => resolve()) : setTimeout(resolve, 50),
  );
  try {
    // getAll() returns thumbnail *paths* (not image data), so photos show in the list cheaply.
    const raw = await Contacts.getAll();
    const mapped = mapPhoneContacts(raw);
    await contactsRepo.bulkUpsert(mapped);
    log.log('contacts synced', mapped.length);
    return mapped;
  } catch (e) {
    log.warn('contacts read failed', e?.message);
    return null;
  }
};

export const loadCached = () => contactsRepo.getAll();

export const openAddContact = number =>
  Contacts.openContactForm({ phoneNumbers: [{ label: 'mobile', number }] }).catch(() => null);
