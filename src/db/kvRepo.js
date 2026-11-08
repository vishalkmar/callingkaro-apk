import { db } from './index';

export const get = async (key, fallback = null) => {
  const rows = await db.execute('SELECT value FROM kv WHERE key = ?', [key]);
  if (!rows.length) {
    return fallback;
  }
  try {
    return JSON.parse(rows[0].value);
  } catch (e) {
    return rows[0].value;
  }
};

export const set = async (key, value) => {
  await db.execute('INSERT OR REPLACE INTO kv (key, value) VALUES (?, ?)', [key, JSON.stringify(value)]);
};

export const remove = async key => {
  await db.execute('DELETE FROM kv WHERE key = ?', [key]);
};
