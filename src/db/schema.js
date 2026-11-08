// Version 1 schema (Section 9.1 of the build doc). Later changes go into migrations.js as new versions.
export const SCHEMA_V1 = [
  `CREATE TABLE IF NOT EXISTS call_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_sid TEXT,
    number_e164 TEXT NOT NULL,
    contact_name TEXT,
    direction TEXT DEFAULT 'outgoing',
    status TEXT,
    started_at INTEGER,
    answered_at INTEGER,
    ended_at INTEGER,
    talk_seconds INTEGER DEFAULT 0,
    credits_used INTEGER DEFAULT 0,
    caller_id_used TEXT,
    notes TEXT,
    has_recording INTEGER DEFAULT 0
  )`,
  'CREATE INDEX IF NOT EXISTS idx_call_started ON call_logs(started_at)',
  'CREATE INDEX IF NOT EXISTS idx_call_number ON call_logs(number_e164)',
  `CREATE TABLE IF NOT EXISTS contacts_cache (
    id TEXT PRIMARY KEY,
    name TEXT,
    numbers_json TEXT,
    thumb TEXT,
    updated_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS favorites (
    number_e164 TEXT PRIMARY KEY,
    name TEXT,
    created_at INTEGER
  )`,
  `CREATE TABLE IF NOT EXISTS recordings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    call_log_id INTEGER,
    file_path TEXT,
    duration_sec INTEGER,
    size_bytes INTEGER,
    created_at INTEGER
  )`,
  'CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT)',
];

export const CALL_STATUSES = [
  'dialing',
  'ringing',
  'connected',
  'completed',
  'no-answer',
  'busy',
  'failed',
  'cancelled',
  'insufficient-credit',
];

// "Not connected" (shown red in Recent) = the other side never picked up.
export const NOT_CONNECTED = ['no-answer', 'busy', 'failed', 'cancelled', 'insufficient-credit'];
export const CONNECTED = ['connected', 'completed'];
