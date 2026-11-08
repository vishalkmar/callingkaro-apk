// Phase 11 extras: v1 -> v2 upgrade keeps data, indexes, rollback, init retry,
// useCallLogs hook, one-time history sync, reconciliation rules.
import React from 'react';
import { Text } from 'react-native';
import { render, act } from '@testing-library/react-native';
import { createSqlJsAdapter } from './helpers/sqljsAdapter';
import { setDbAdapter, initDatabase, db } from '@db/index';
import { MIGRATIONS, runMigrations, LATEST_VERSION } from '@db/migrations';
import * as callLogRepo from '@db/callLogRepo';
import * as kv from '@db/kvRepo';
import { useCallLogs } from '@hooks/useCallLogs';
import { useCallStore } from '@store/callStore';

jest.mock('@services/api/voiceApi', () => ({ listCalls: jest.fn(), getCall: jest.fn() }));
const voiceApi = require('@services/api/voiceApi');
const { syncHistoryOnce, reconcileUnfinishedCalls } = require('@services/calls/historySync');

const fresh = async () => {
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
};

const flush = () =>
  act(async () => {
    await new Promise(r => setTimeout(r, 20));
  });

beforeEach(async () => {
  jest.clearAllMocks();
  useCallStore.getState().clear();
  await fresh();
});

describe('migrations (P11.T03-T04, T09)', () => {
  test('an app updated from v1 keeps its history and gains the v2 columns', async () => {
    const raw = await createSqlJsAdapter();
    // simulate the shipped v1 database
    await raw.execute('CREATE TABLE schema_version (version INTEGER)');
    await raw.transaction(async tx => {
      for (const sql of MIGRATIONS[0].up) {
        await tx.execute(sql);
      }
      await tx.execute('INSERT INTO schema_version (version) VALUES (1)');
    });
    await raw.execute(
      "INSERT INTO call_logs (number_e164, direction, status, started_at, talk_seconds, credits_used) VALUES ('+919876543210','outgoing','completed',1,135,2250)",
    );
    const r = await runMigrations(raw);
    expect(r).toEqual({ from: 1, to: LATEST_VERSION });
    const [row] = await raw.execute('SELECT * FROM call_logs');
    expect(row.credits_used).toBe(2250);
    expect(row.reconciled).toBe(0); // new column with default
    expect(row.end_reason).toBeNull();
  });

  test('indexes exist on started_at, number_e164 and call_sid', async () => {
    const idx = (await db.execute("SELECT sql FROM sqlite_master WHERE type = 'index' AND tbl_name = 'call_logs'")).map(
      r => r.sql,
    );
    expect(idx.join(' ')).toMatch(/started_at/);
    expect(idx.join(' ')).toMatch(/number_e164/);
    expect(idx.join(' ')).toMatch(/call_sid/);
  });

  test('a failing transaction leaves nothing behind (P11.T12)', async () => {
    await expect(
      db.transaction(async tx => {
        await tx.execute(
          "INSERT INTO call_logs (number_e164, direction, status, started_at) VALUES ('+911','outgoing','dialing',1)",
        );
        throw new Error('crash in the middle');
      }),
    ).rejects.toThrow('crash');
    expect(await callLogRepo.count()).toBe(0);
  });

  test('BUG FIX: a failed first migration is retried on the next DB call', async () => {
    const good = await createSqlJsAdapter();
    let fail = true;
    setDbAdapter({
      execute: (...a) => (fail ? Promise.reject(new Error('disk busy')) : good.execute(...a)),
      transaction: fn => good.transaction(fn),
    });
    await expect(initDatabase()).rejects.toThrow('disk busy');
    fail = false;
    await expect(callLogRepo.count()).resolves.toBe(0);
  });

  test('kv store round-trips JSON values', async () => {
    await kv.set('x', { a: 1 });
    expect(await kv.get('x')).toEqual({ a: 1 });
    expect(await kv.get('missing', 'fb')).toBe('fb');
  });
});

describe('useCallLogs (P11.T13-T14)', () => {
  const Probe = ({ out }) => {
    const s = useCallLogs('all');
    out.current = s;
    return <Text>{s.items.length}</Text>;
  };

  test('pages of 30 and refreshes itself when a call is added', async () => {
    for (let i = 0; i < 35; i++) {
      const id = await callLogRepo.insert({ number: '+919876543210', startedAt: 1000 + i });
      await callLogRepo.finish(id, { status: 'completed', talkSeconds: 10, creditsUsed: 167 });
    }
    const out = { current: null };
    render(<Probe out={out} />);
    await flush();
    expect(out.current.items).toHaveLength(30);
    expect(out.current.hasMore).toBe(true);
    await act(async () => out.current.loadMore());
    expect(out.current.items).toHaveLength(35);
    expect(out.current.hasMore).toBe(false);
    await act(async () => {
      await callLogRepo.insert({ number: '+918888888888', startedAt: Date.now() });
    });
    await flush();
    expect(out.current.items).toHaveLength(36);
    expect(out.current.items[0].number).toBe('+918888888888'); // newest first
  });
});

describe('server history sync (P11.T16-T17)', () => {
  const serverCall = n => ({
    callSid: `CA${n}`,
    to: '+919876543210',
    status: 'completed',
    startedAt: new Date(2026, 9, 1, 10, n).toISOString(),
    talkSeconds: 61,
    credits: 1017,
    billed: true,
  });

  test('fresh install pulls server calls once; second start does nothing', async () => {
    voiceApi.listCalls.mockResolvedValue({ items: [serverCall(1), serverCall(2)] });
    expect(await syncHistoryOnce()).toBe(2);
    expect(await syncHistoryOnce()).toBe(0);
    expect(voiceApi.listCalls).toHaveBeenCalledTimes(1);
    const [row] = await callLogRepo.listRecent({ limit: 1 });
    expect(row).toMatchObject({ creditsUsed: 1017, talkSeconds: 61, reconciled: true });
  });

  test('offline at first start -> retried next time', async () => {
    voiceApi.listCalls.mockRejectedValueOnce(Object.assign(new Error('off'), { code: 'NETWORK' }));
    expect(await syncHistoryOnce()).toBe(0);
    voiceApi.listCalls.mockResolvedValue({ items: [serverCall(3)] });
    expect(await syncHistoryOnce()).toBe(1);
  });

  test('existing local history is never overwritten by the sync', async () => {
    await callLogRepo.insert({ number: '+917777777777' });
    expect(await syncHistoryOnce()).toBe(0);
    expect(voiceApi.listCalls).not.toHaveBeenCalled();
  });

  test('reconcile: server charge replaces the local estimate; stuck row without sid -> failed', async () => {
    const id = await callLogRepo.insert({ number: '+919876543210', startedAt: Date.now() - 60000 });
    await callLogRepo.setCallSid(id, 'CA9');
    await callLogRepo.finish(id, { status: 'completed', talkSeconds: 60, creditsUsed: 1000 });
    const stuck = await callLogRepo.insert({ number: '+919876543210', startedAt: Date.now() - 10 * 60000 });
    voiceApi.getCall.mockResolvedValue({ billed: true, status: 'completed', talkSeconds: 61, credits: 1017 });
    await reconcileUnfinishedCalls();
    expect(await callLogRepo.getById(id)).toMatchObject({ creditsUsed: 1017, talkSeconds: 61, reconciled: true });
    expect((await callLogRepo.getById(stuck)).status).toBe('failed');
  });

  test('BUG FIX: the live call is never reconciled', async () => {
    const id = await callLogRepo.insert({ number: '+919876543210', startedAt: Date.now() - 6 * 60000 });
    await callLogRepo.updateStatus(id, 'connected', { callSid: 'CA-live' });
    useCallStore.getState().begin({ localId: id, number: '+919876543210' });
    voiceApi.getCall.mockResolvedValue({ billed: true, status: 'failed', talkSeconds: 0, credits: 0 });
    await reconcileUnfinishedCalls();
    expect(voiceApi.getCall).not.toHaveBeenCalled();
    expect((await callLogRepo.getById(id)).status).toBe('connected');
  });
});
