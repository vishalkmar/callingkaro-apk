import { runMigrations } from './migrations';
import logger from '@utils/logger';

let adapter = null;
let ready = null;

/** Tests inject an in-memory adapter (sql.js); the app uses op-sqlite. */
export const setDbAdapter = a => {
  adapter = a;
  ready = null;
};

export const getDb = () => {
  if (!adapter) {
    // Lazy require so unit tests never load the native module.
    const { createOpSqliteAdapter } = require('./opSqliteAdapter');
    adapter = createOpSqliteAdapter('callingkaro.db');
  }
  return adapter;
};

/** Opens callingkaro.db and runs pending migrations. Called once at startup before any screen reads data. */
export const initDatabase = () => {
  if (!ready) {
    ready = runMigrations(getDb())
      .then(r => {
        logger.log('db ready', r);
        return r;
      })
      .catch(e => {
        ready = null; // let the next DB call retry instead of failing for the whole session
        logger.error('db migration failed', e?.message);
        throw e;
      });
  }
  return ready;
};

/** All repo calls go through here so they wait for migrations. */
export const db = {
  execute: async (sql, params) => {
    await initDatabase();
    return getDb().execute(sql, params);
  },
  transaction: async fn => {
    await initDatabase();
    return getDb().transaction(fn);
  },
};

export default db;
