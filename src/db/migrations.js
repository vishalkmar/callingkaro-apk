import { SCHEMA_V1 } from './schema';

/**
 * Ordered migrations. NEVER edit a shipped version - add a new one.
 * Each `up` is a list of SQL statements run inside one transaction.
 */
export const MIGRATIONS = [
  { version: 1, name: 'initial schema', up: SCHEMA_V1 },
  {
    version: 2,
    name: 'call end reason + server sync flag + contact number index',
    up: [
      'ALTER TABLE call_logs ADD COLUMN end_reason TEXT',
      'ALTER TABLE call_logs ADD COLUMN reconciled INTEGER DEFAULT 0',
      'CREATE INDEX IF NOT EXISTS idx_call_sid ON call_logs(call_sid)',
      `CREATE TABLE IF NOT EXISTS contact_numbers (
        match_key TEXT NOT NULL,
        number_e164 TEXT,
        contact_id TEXT NOT NULL,
        name TEXT,
        t9_name TEXT
      )`,
      'CREATE INDEX IF NOT EXISTS idx_contact_match ON contact_numbers(match_key)',
      'CREATE INDEX IF NOT EXISTS idx_contact_t9 ON contact_numbers(t9_name)',
    ],
  },
  {
    version: 3,
    name: 'recordings keep who was called (survives deleting the call row)',
    up: [
      'ALTER TABLE recordings ADD COLUMN number_e164 TEXT',
      'ALTER TABLE recordings ADD COLUMN contact_name TEXT',
      `UPDATE recordings SET
         number_e164 = (SELECT number_e164 FROM call_logs WHERE call_logs.id = recordings.call_log_id),
         contact_name = (SELECT contact_name FROM call_logs WHERE call_logs.id = recordings.call_log_id)`,
    ],
  },
];

export const LATEST_VERSION = MIGRATIONS[MIGRATIONS.length - 1].version;

/** Creates schema_version if needed and applies every pending migration in order. */
export const runMigrations = async db => {
  await db.execute('CREATE TABLE IF NOT EXISTS schema_version (version INTEGER)');
  const rows = await db.execute('SELECT MAX(version) AS v FROM schema_version');
  const current = rows[0]?.v || 0;
  for (const m of MIGRATIONS) {
    if (m.version <= current) {
      continue;
    }
    await db.transaction(async tx => {
      for (const sql of m.up) {
        await tx.execute(sql);
      }
      await tx.execute('INSERT INTO schema_version (version) VALUES (?)', [m.version]);
    });
  }
  return { from: current, to: LATEST_VERSION };
};
