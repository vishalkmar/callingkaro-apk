import { createSqlJsAdapter } from './helpers/sqljsAdapter';
import { setDbAdapter, initDatabase, getDb } from '@db/index';
import { LATEST_VERSION, runMigrations } from '@db/migrations';
import * as callLogRepo from '@db/callLogRepo';
import * as contactsRepo from '@db/contactsRepo';
import * as favoritesRepo from '@db/favoritesRepo';
import * as recordingsRepo from '@db/recordingsRepo';
import { deleteAllLocalData } from '@db/localData';
import { on, DB_EVENTS } from '@db/events';

beforeEach(async () => {
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
});

describe('migrations', () => {
  test('run to the latest version and are idempotent', async () => {
    const v = await getDb().execute('SELECT MAX(version) AS v FROM schema_version');
    expect(v[0].v).toBe(LATEST_VERSION);
    const again = await runMigrations(getDb());
    expect(again.from).toBe(LATEST_VERSION);
  });
});

describe('callLogRepo', () => {
  test('insert normalises to E.164, finish stores duration + cost, emits events', async () => {
    const events = [];
    const off = on(DB_EVENTS.CALL_LOGS, e => events.push(e.type));
    const id = await callLogRepo.insert({ number: '98765 43210', contactName: 'Ravi' });
    await callLogRepo.updateStatus(id, 'ringing', { callSid: 'CA1' });
    await callLogRepo.finish(id, { status: 'completed', talkSeconds: 135, creditsUsed: 2250 });
    const row = await callLogRepo.getById(id);
    expect(row).toMatchObject({
      number: '+919876543210',
      status: 'completed',
      talkSeconds: 135,
      creditsUsed: 2250,
      callSid: 'CA1',
    });
    expect(Object.keys(row)).toContain('creditsUsed'); // plain camelCase objects, no SQL rows
    expect(events).toEqual(['insert', 'update', 'finish']);
    off();
  });

  test('listRecent paginates newest first and filters', async () => {
    for (let i = 0; i < 35; i++) {
      const id = await callLogRepo.insert({ number: '+919876543210', startedAt: 1000 + i });
      await callLogRepo.finish(id, { status: i % 2 ? 'completed' : 'busy' });
    }
    const p1 = await callLogRepo.listRecent({ limit: 30, offset: 0 });
    const p2 = await callLogRepo.listRecent({ limit: 30, offset: 30 });
    expect(p1).toHaveLength(30);
    expect(p2).toHaveLength(5);
    expect(p1[0].startedAt).toBe(1034);
    expect(
      (await callLogRepo.listRecent({ filter: 'connected', limit: 100 })).every(c => c.status === 'completed'),
    ).toBe(true);
    expect((await callLogRepo.listRecent({ filter: 'notConnected', limit: 100 })).length).toBe(18);
  });

  test('byNumber, delete + restore (undo), clearAll', async () => {
    const id = await callLogRepo.insert({ number: '+919876543210' });
    await callLogRepo.insert({ number: '+918888888888' });
    expect(await callLogRepo.byNumber('9876543210')).toHaveLength(1);
    const row = await callLogRepo.getById(id);
    await callLogRepo.remove(id);
    expect(await callLogRepo.getById(id)).toBeUndefined();
    await callLogRepo.restore(row);
    expect((await callLogRepo.getById(id)).number).toBe('+919876543210');
    await callLogRepo.clearAll();
    expect(await callLogRepo.count()).toBe(0);
  });

  test('importServerCalls rebuilds history without duplicates', async () => {
    const calls = [
      {
        callSid: 'CA9',
        to: '+919876543210',
        status: 'completed',
        startedAt: '2026-10-01T10:00:00Z',
        talkSeconds: 61,
        credits: 1017,
      },
      { callSid: 'CA8', to: '+919876543211', status: 'busy', startedAt: '2026-10-01T09:00:00Z' },
    ];
    expect(await callLogRepo.importServerCalls(calls)).toBe(2);
    expect(await callLogRepo.importServerCalls(calls)).toBe(0);
    const row = await callLogRepo.getByCallSid('CA9');
    expect(row).toMatchObject({ creditsUsed: 1017, status: 'completed', reconciled: true });
  });

  test('month talk time', async () => {
    const id = await callLogRepo.insert({ number: '+919876543210', startedAt: Date.now() });
    await callLogRepo.finish(id, { status: 'completed', talkSeconds: 90 });
    expect(await callLogRepo.monthTalkSeconds()).toBe(90);
  });
});

describe('contactsRepo', () => {
  const contacts = [
    { id: '1', name: 'Ravi Kumar', numbers: [{ e164: '+919876543210', label: 'mobile' }] },
    {
      id: '2',
      name: 'Sneha',
      numbers: [
        { e164: '+918123456789', label: 'mobile' },
        { e164: '+911123456789', label: 'home' },
      ],
    },
  ];

  test('bulkUpsert replaces the cache in a transaction; search by name and number', async () => {
    await contactsRepo.bulkUpsert(contacts);
    await contactsRepo.bulkUpsert(contacts); // no duplicates on re-sync
    expect(await contactsRepo.count()).toBe(2);
    expect((await contactsRepo.search('sne'))[0].name).toBe('Sneha');
    expect((await contactsRepo.search('98765'))[0].name).toBe('Ravi Kumar');
    expect((await contactsRepo.getAll())[1].numbers).toHaveLength(2);
  });

  test('getByNumber matches any formatting; T9 suggestions', async () => {
    await contactsRepo.bulkUpsert(contacts);
    expect((await contactsRepo.getByNumber('098765 43210')).name).toBe('Ravi Kumar');
    expect(await contactsRepo.getByNumber('+917777777777')).toBeNull();
    const s = await contactsRepo.suggest('7284'); // R-A-V-I
    expect(s[0].name).toBe('Ravi Kumar');
    expect((await contactsRepo.suggest('81234'))[0].name).toBe('Sneha');
  });
});

describe('favorites + recordings + wipe', () => {
  test('toggle favorites', async () => {
    expect(await favoritesRepo.toggle('9876543210', 'Ravi')).toBe(true);
    expect(await favoritesRepo.isFavorite('+919876543210')).toBe(true);
    expect(await favoritesRepo.toggle('+919876543210')).toBe(false);
    expect(await favoritesRepo.list()).toHaveLength(0);
  });

  test('recordings flag the call and are removed cleanly', async () => {
    const id = await callLogRepo.insert({ number: '+919876543210' });
    await recordingsRepo.add({ callLogId: id, filePath: '/docs/recordings/a.mp3', durationSec: 30, sizeBytes: 1000 });
    expect((await callLogRepo.getById(id)).hasRecording).toBe(true);
    const [rec] = await recordingsRepo.listAll();
    expect(rec.number).toBe('+919876543210');
    expect(await recordingsRepo.totalSize()).toBe(1000);
    await recordingsRepo.remove(rec.id);
    expect((await callLogRepo.getById(id)).hasRecording).toBe(false);
  });

  test('delete all local data', async () => {
    await callLogRepo.insert({ number: '+919876543210' });
    await favoritesRepo.toggle('+919876543210');
    await deleteAllLocalData();
    expect(await callLogRepo.count()).toBe(0);
    expect(await favoritesRepo.list()).toHaveLength(0);
  });
});
