import { db } from './index';
import { emit, DB_EVENTS } from './events';
import * as callLogRepo from './callLogRepo';
import * as recordingsRepo from './recordingsRepo';

/** Settings > Data > "Clear call history" (recording rows go too; files are removed by the caller). */
export const clearCallHistory = async () => {
  const recs = await recordingsRepo.clearAll();
  await callLogRepo.clearAll();
  return recs;
};

/** Settings > Data > "Delete all local data": history, contacts cache, favorites, recordings index, kv. */
export const deleteAllLocalData = async () => {
  const recs = await recordingsRepo.listAll();
  await db.transaction(async tx => {
    for (const t of ['call_logs', 'contacts_cache', 'contact_numbers', 'favorites', 'recordings', 'kv']) {
      await tx.execute(`DELETE FROM ${t}`);
    }
  });
  Object.values(DB_EVENTS).forEach(e => emit(e, { cleared: true }));
  return recs;
};
