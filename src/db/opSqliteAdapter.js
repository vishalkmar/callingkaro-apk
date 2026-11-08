import { open } from '@op-engineering/op-sqlite';

/**
 * Wraps op-sqlite in the tiny adapter interface the repos use:
 *   execute(sql, params) -> Promise<row objects[]>
 *   transaction(async tx => { await tx.execute(...) })
 * Repos never see raw driver results.
 */
export const createOpSqliteAdapter = (name = 'callingkaro.db') => {
  const db = open({ name });
  const toRows = res => {
    const rows = res?.rows ? Array.from(res.rows) : [];
    rows.insertId = res?.insertId; // for INSERTs
    return rows;
  };
  const execute = async (sql, params = []) => toRows(await db.execute(sql, params));
  return {
    execute,
    transaction: async fn =>
      db.transaction(async tx => {
        await fn({
          execute: async (sql, params = []) => toRows(await tx.execute(sql, params)),
        });
      }),
    close: () => db.close(),
    deleteFile: () => db.delete(),
  };
};
