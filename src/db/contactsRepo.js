import { db } from './index';
import { emit, DB_EVENTS } from './events';
import { matchKey } from '@utils/phone';
import { nameToT9 } from '@utils/t9';

const mapContact = r =>
  r && {
    id: r.id,
    name: r.name || '',
    numbers: safeParse(r.numbers_json),
    thumbnail: r.thumb || null,
    updatedAt: r.updated_at,
  };

const safeParse = s => {
  try {
    return JSON.parse(s || '[]');
  } catch (e) {
    return [];
  }
};

/**
 * Replaces the cache with the latest phone contacts in ONE transaction.
 * contacts: [{ id, name, numbers: [{ e164, label, raw }], thumbnail }]
 */
export const bulkUpsert = async contacts => {
  const now = Date.now();
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM contacts_cache');
    await tx.execute('DELETE FROM contact_numbers');
    for (const c of contacts) {
      await tx.execute(
        'INSERT INTO contacts_cache (id, name, numbers_json, thumb, updated_at) VALUES (?, ?, ?, ?, ?)',
        [c.id, c.name, JSON.stringify(c.numbers), c.thumbnail || null, now],
      );
      const t9 = nameToT9(c.name);
      for (const n of c.numbers) {
        await tx.execute(
          'INSERT INTO contact_numbers (match_key, number_e164, contact_id, name, t9_name) VALUES (?, ?, ?, ?, ?)',
          [matchKey(n.e164 || n.raw), n.e164 || n.raw, c.id, c.name, t9],
        );
      }
    }
  });
  emit(DB_EVENTS.CONTACTS, { count: contacts.length });
};

export const getAll = async () => {
  const rows = await db.execute('SELECT * FROM contacts_cache ORDER BY name COLLATE NOCASE');
  return rows.map(mapContact);
};

export const count = async () => (await db.execute('SELECT COUNT(*) AS n FROM contacts_cache'))[0]?.n || 0;

/** Search by name (contains) or number digits (contains). */
export const search = async (query, limit = 50) => {
  const q = String(query || '').trim();
  if (!q) {
    return getAll();
  }
  const digits = q.replace(/\D/g, '');
  const rows = await db.execute(
    `SELECT DISTINCT c.* FROM contacts_cache c LEFT JOIN contact_numbers n ON n.contact_id = c.id
     WHERE c.name LIKE ? ${digits ? 'OR n.number_e164 LIKE ?' : ''}
     ORDER BY c.name COLLATE NOCASE LIMIT ?`,
    digits ? [`%${q}%`, `%${digits}%`, limit] : [`%${q}%`, limit],
  );
  return rows.map(mapContact);
};

/** Name for a number (matches on the last 10 digits, so 098..., +91 98... and 98... are the same). */
export const getByNumber = async number => {
  const rows = await db.execute(
    'SELECT contact_id, name, number_e164 FROM contact_numbers WHERE match_key = ? LIMIT 1',
    [matchKey(number)],
  );
  return rows[0] ? { id: rows[0].contact_id, name: rows[0].name, number: rows[0].number_e164 } : null;
};

/** Dialpad suggestions: number contains the digits OR the T9 name starts with them. */
export const suggest = async (digits, limit = 3) => {
  const d = String(digits || '').replace(/\D/g, '');
  if (d.length < 2) {
    return [];
  }
  const rows = await db.execute(
    `SELECT contact_id, name, number_e164 FROM contact_numbers
     WHERE match_key LIKE ? OR t9_name LIKE ? OR t9_name LIKE ?
     GROUP BY contact_id, number_e164 LIMIT ?`,
    [`%${d}%`, `${d}%`, `% ${d}%`, limit],
  );
  return rows.map(r => ({ id: r.contact_id, name: r.name, number: r.number_e164 }));
};

export const clearAll = async () => {
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM contacts_cache');
    await tx.execute('DELETE FROM contact_numbers');
  });
  emit(DB_EVENTS.CONTACTS, { count: 0 });
};
