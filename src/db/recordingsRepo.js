import { db } from './index';
import { emit, DB_EVENTS } from './events';

const map = r =>
  r && {
    id: r.id,
    callLogId: r.call_log_id,
    filePath: r.file_path,
    durationSec: r.duration_sec || 0,
    sizeBytes: r.size_bytes || 0,
    createdAt: r.created_at,
    number: r.number_e164 || null,
    contactName: r.contact_name || null,
    callSid: r.call_sid || null,
  };

/** Adds a recording row and flags the call log - one transaction. */
export const add = async ({ callLogId, filePath, durationSec = 0, sizeBytes = 0, createdAt = Date.now() }) => {
  await db.transaction(async tx => {
    await tx.execute(
      // Copy who was called, so the recording still has a name if the call row is deleted later.
      `INSERT INTO recordings (call_log_id, file_path, duration_sec, size_bytes, created_at, number_e164, contact_name)
       SELECT ?, ?, ?, ?, ?, (SELECT number_e164 FROM call_logs WHERE id = ?), (SELECT contact_name FROM call_logs WHERE id = ?)`,
      [callLogId, filePath, durationSec, sizeBytes, createdAt, callLogId, callLogId],
    );
    await tx.execute('UPDATE call_logs SET has_recording = 1 WHERE id = ?', [callLogId]);
  });
  emit(DB_EVENTS.RECORDINGS, { callLogId });
  emit(DB_EVENTS.CALL_LOGS, { type: 'recording', id: callLogId });
};

export const listByCall = async callLogId =>
  (await db.execute('SELECT * FROM recordings WHERE call_log_id = ? ORDER BY created_at DESC', [callLogId])).map(map);

export const listAll = async () =>
  (
    await db.execute(
      `SELECT r.*, COALESCE(c.number_e164, r.number_e164) AS number_e164,
         COALESCE(c.contact_name, r.contact_name) AS contact_name, c.call_sid FROM recordings r
       LEFT JOIN call_logs c ON c.id = r.call_log_id ORDER BY r.created_at DESC`,
    )
  ).map(map);

export const getById = async id => map((await db.execute('SELECT * FROM recordings WHERE id = ?', [id]))[0]);

export const remove = async id => {
  const rec = await getById(id);
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM recordings WHERE id = ?', [id]);
    if (rec) {
      const left = await tx.execute('SELECT COUNT(*) AS n FROM recordings WHERE call_log_id = ?', [rec.callLogId]);
      if (!left[0]?.n) {
        await tx.execute('UPDATE call_logs SET has_recording = 0 WHERE id = ?', [rec.callLogId]);
      }
    }
  });
  emit(DB_EVENTS.RECORDINGS, { id });
  return rec;
};

export const totalSize = async () =>
  (await db.execute('SELECT COALESCE(SUM(size_bytes), 0) AS s FROM recordings'))[0]?.s || 0;

export const clearAll = async () => {
  const all = await listAll();
  await db.transaction(async tx => {
    await tx.execute('DELETE FROM recordings');
    await tx.execute('UPDATE call_logs SET has_recording = 0');
  });
  emit(DB_EVENTS.RECORDINGS, { cleared: true });
  return all;
};
