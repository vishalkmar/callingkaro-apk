// In-memory SQLite (sql.js / WASM) implementing the same adapter interface as op-sqlite.
const initSqlJs = require('sql.js');

const createSqlJsAdapter = async () => {
  const SQL = await initSqlJs();
  const d = new SQL.Database();
  const execute = async (sql, params = []) => {
    const stmt = d.prepare(sql);
    try {
      stmt.bind(params.map(p => (p === undefined ? null : p)));
      const rows = [];
      while (stmt.step()) {
        rows.push(stmt.getAsObject());
      }
      if (/^\s*insert/i.test(sql)) {
        rows.insertId = d.exec('SELECT last_insert_rowid()')[0].values[0][0];
      }
      return rows;
    } finally {
      stmt.free();
    }
  };
  return {
    execute,
    transaction: async fn => {
      d.run('BEGIN');
      try {
        await fn({ execute });
        d.run('COMMIT');
      } catch (e) {
        d.run('ROLLBACK');
        throw e;
      }
    },
    close: () => d.close(),
  };
};

module.exports = { createSqlJsAdapter };
