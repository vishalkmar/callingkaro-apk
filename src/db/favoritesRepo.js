import { db } from './index';
import { emit, DB_EVENTS } from './events';
import { normalizeToE164 } from '@utils/phone';

/** Adds or removes a favorite. Returns true when it is now a favorite. */
export const toggle = async (number, name = null) => {
  const e164 = normalizeToE164(number) || number;
  const existing = await db.execute('SELECT number_e164 FROM favorites WHERE number_e164 = ?', [e164]);
  if (existing.length) {
    await db.execute('DELETE FROM favorites WHERE number_e164 = ?', [e164]);
    emit(DB_EVENTS.FAVORITES, { number: e164, favorite: false });
    return false;
  }
  await db.execute('INSERT INTO favorites (number_e164, name, created_at) VALUES (?, ?, ?)', [e164, name, Date.now()]);
  emit(DB_EVENTS.FAVORITES, { number: e164, favorite: true });
  return true;
};

export const list = async () =>
  (await db.execute('SELECT * FROM favorites ORDER BY created_at DESC')).map(r => ({
    number: r.number_e164,
    name: r.name,
    createdAt: r.created_at,
  }));

export const isFavorite = async number => {
  const e164 = normalizeToE164(number) || number;
  return (await db.execute('SELECT 1 AS x FROM favorites WHERE number_e164 = ?', [e164])).length > 0;
};

export const clearAll = async () => {
  await db.execute('DELETE FROM favorites');
  emit(DB_EVENTS.FAVORITES, { cleared: true });
};
