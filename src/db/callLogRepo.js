import { db } from './index';
import { emit, DB_EVENTS } from './events';
import { CONNECTED, NOT_CONNECTED } from './schema';
import { normalizeToE164 } from '@utils/phone';

// Row -> plain JS object (no SQL rows leak into the UI).
export const mapCallLog = r =>
  r && {
    id: r.id,
    callSid: r.call_sid || null,
    number: r.number_e164,
    contactName: r.contact_name || null,
    direction: r.direction,
    status: r.status,
    startedAt: r.started_at || null,
    answeredAt: r.answered_at || null,
    endedAt: r.ended_at || null,
    talkSeconds: r.talk_seconds || 0,
    creditsUsed: r.credits_used || 0,
    callerIdUsed: r.caller_id_used || null,
    notes: r.notes || '',
    hasRecording: !!r.has_recording,
    endReason: r.end_reason || null,
    reconciled: !!r.reconciled,
  };

const changed = payload => emit(DB_EVENTS.CALL_LOGS, payload);

/** Inserts a new outgoing call (status 'dialing' before connecting). Returns the local id. */
export const insert = async ({
  number,
  contactName = null,
  status = 'dialing',
  startedAt = Date.now(),
  callSid = null,
}) => {
  const e164 = normalizeToE164(number) || number;
  const res = await db.execute(
    'INSERT INTO call_logs (call_sid, number_e164, contact_name, direction, status, started_at) VALUES (?, ?, ?, ?, ?, ?)',
    [callSid, e164, contactName, 'outgoing', status, startedAt],
  );
  const id = res.insertId ?? (await db.execute('SELECT last_insert_rowid() AS id'))[0]?.id;
  changed({ type: 'insert', id });
  return id;
};

export const updateStatus = async (id, status, extra = {}) => {
  const sets = ['status = ?'];
  const params = [status];
  if (extra.answeredAt) {
    sets.push('answered_at = ?');
    params.push(extra.answeredAt);
  }
  if (extra.callSid) {
    sets.push('call_sid = ?');
    params.push(extra.callSid);
  }
  params.push(id);
  await db.execute(`UPDATE call_logs SET ${sets.join(', ')} WHERE id = ?`, params);
  changed({ type: 'update', id });
};

export const setCallSid = async (id, callSid) => {
  await db.execute('UPDATE call_logs SET call_sid = ? WHERE id = ?', [callSid, id]);
};

/** Final write when a call ends: duration + cost (cost is later corrected from the server). */
export const finish = async (
  id,
  { status, endedAt = Date.now(), talkSeconds = 0, creditsUsed = 0, endReason = null, callerIdUsed = null },
) => {
  await db.execute(
    `UPDATE call_logs SET status = ?, ended_at = ?, talk_seconds = ?, credits_used = ?, end_reason = COALESCE(?, end_reason),
     caller_id_used = COALESCE(?, caller_id_used) WHERE id = ?`,
    [status, endedAt, talkSeconds, creditsUsed, endReason, callerIdUsed, id],
  );
  changed({ type: 'finish', id });
};

export const applyServerResult = async (id, { status, talkSeconds, credits, callerId, endReason }) => {
  await db.execute(
    `UPDATE call_logs SET status = COALESCE(?, status), talk_seconds = ?, credits_used = ?, caller_id_used = COALESCE(?, caller_id_used),
     end_reason = COALESCE(?, end_reason), reconciled = 1 WHERE id = ?`,
    [status, talkSeconds || 0, credits || 0, callerId || null, endReason || null, id],
  );
  changed({ type: 'reconcile', id });
};

export const updateNotes = async (id, notes) => {
  await db.execute('UPDATE call_logs SET notes = ? WHERE id = ?', [notes, id]);
  changed({ type: 'notes', id });
};

export const setHasRecording = async (id, has = true) => {
  await db.execute('UPDATE call_logs SET has_recording = ? WHERE id = ?', [has ? 1 : 0, id]);
  changed({ type: 'recording', id });
};

const FILTER_SQL = {
  all: '',
  connected: `WHERE status IN (${CONNECTED.map(() => '?').join(',')})`,
  notConnected: `WHERE status IN (${NOT_CONNECTED.map(() => '?').join(',')})`,
};
const FILTER_PARAMS = { all: [], connected: CONNECTED, notConnected: NOT_CONNECTED };

/** Newest first, paginated. filter: 'all' | 'connected' | 'notConnected' */
export const listRecent = async ({ limit = 30, offset = 0, filter = 'all' } = {}) => {
  const rows = await db.execute(
    `SELECT * FROM call_logs ${FILTER_SQL[filter] || ''} ORDER BY started_at DESC, id DESC LIMIT ? OFFSET ?`,
    [...(FILTER_PARAMS[filter] || []), limit, offset],
  );
  return rows.map(mapCallLog);
};

export const getById = async id => mapCallLog((await db.execute('SELECT * FROM call_logs WHERE id = ?', [id]))[0]);

export const getByCallSid = async callSid =>
  mapCallLog((await db.execute('SELECT * FROM call_logs WHERE call_sid = ? LIMIT 1', [callSid]))[0]);

export const byNumber = async (number, limit = 50) => {
  const e164 = normalizeToE164(number) || number;
  const rows = await db.execute('SELECT * FROM call_logs WHERE number_e164 = ? ORDER BY started_at DESC LIMIT ?', [
    e164,
    limit,
  ]);
  return rows.map(mapCallLog);
};

/** Calls that ended locally but whose final cost has not been confirmed by the server yet. */
export const listUnreconciled = async (limit = 20) => {
  const rows = await db.execute(
    `SELECT * FROM call_logs WHERE reconciled = 0 AND call_sid IS NOT NULL AND started_at < ?
     ORDER BY started_at DESC LIMIT ?`,
    [Date.now() - 15000, limit],
  );
  return rows.map(mapCallLog);
};

/** Rows stuck in a live status (app was killed mid-call). */
export const listStuck = async () => {
  const rows = await db.execute(
    "SELECT * FROM call_logs WHERE status IN ('dialing','ringing','connected') AND started_at < ?",
    [Date.now() - 5 * 60 * 1000],
  );
  return rows.map(mapCallLog);
};

export const remove = async id => {
  await db.execute('DELETE FROM call_logs WHERE id = ?', [id]);
  changed({ type: 'delete', id });
};

/** Re-inserts a deleted row (undo). */
export const restore = async log => {
  await db.execute(
    `INSERT INTO call_logs (id, call_sid, number_e164, contact_name, direction, status, started_at, answered_at, ended_at,
     talk_seconds, credits_used, caller_id_used, notes, has_recording, end_reason, reconciled)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      log.id,
      log.callSid,
      log.number,
      log.contactName,
      log.direction || 'outgoing',
      log.status,
      log.startedAt,
      log.answeredAt,
      log.endedAt,
      log.talkSeconds,
      log.creditsUsed,
      log.callerIdUsed,
      log.notes,
      log.hasRecording ? 1 : 0,
      log.endReason,
      log.reconciled ? 1 : 0,
    ],
  );
  changed({ type: 'insert', id: log.id });
};

export const clearAll = async () => {
  await db.execute('DELETE FROM call_logs');
  changed({ type: 'clear' });
};

export const count = async () => (await db.execute('SELECT COUNT(*) AS n FROM call_logs'))[0]?.n || 0;

/** Total talk seconds since the 1st of the current month. */
export const monthTalkSeconds = async (now = new Date()) => {
  const start = new Date(now.getFullYear(), now.getMonth(), 1).getTime();
  const rows = await db.execute('SELECT COALESCE(SUM(talk_seconds), 0) AS s FROM call_logs WHERE started_at >= ?', [
    start,
  ]);
  return rows[0]?.s || 0;
};

/** Rebuilds history from server records on a fresh install (skips calls we already have). */
export const importServerCalls = async (calls, nameFor = () => null) => {
  let added = 0;
  await db.transaction(async tx => {
    for (const c of calls) {
      const exists = await tx.execute('SELECT id FROM call_logs WHERE call_sid = ? LIMIT 1', [c.callSid]);
      if (exists.length) {
        continue;
      }
      await tx.execute(
        `INSERT INTO call_logs (call_sid, number_e164, contact_name, direction, status, started_at, answered_at, ended_at,
         talk_seconds, credits_used, caller_id_used, end_reason, reconciled) VALUES (?, ?, ?, 'outgoing', ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
        [
          c.callSid,
          c.to,
          nameFor(c.to),
          mapServerStatus(c.status),
          toMs(c.startedAt),
          toMs(c.answeredAt),
          toMs(c.endedAt),
          c.talkSeconds || 0,
          c.credits || 0,
          c.callerId || null,
          c.endReason || null,
        ],
      );
      added += 1;
    }
  });
  if (added) {
    changed({ type: 'import', added });
  }
  return added;
};

const toMs = v => (v ? new Date(v).getTime() : null);

/** Server (provider) status -> local status vocabulary. */
export const mapServerStatus = s =>
  ({
    completed: 'completed',
    'in-progress': 'connected',
    ringing: 'ringing',
    initiated: 'dialing',
    busy: 'busy',
    'no-answer': 'no-answer',
    failed: 'failed',
    canceled: 'cancelled',
    'insufficient-credit': 'insufficient-credit',
    blocked: 'failed',
  }[s] || s);
