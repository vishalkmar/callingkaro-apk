import './helpers/nativeMocks';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import { createSqlJsAdapter } from './helpers/sqljsAdapter';
import { setDbAdapter, initDatabase } from '@db/index';
import { MIGRATIONS, runMigrations } from '@db/migrations';
import * as callLogRepo from '@db/callLogRepo';
import * as recordingsRepo from '@db/recordingsRepo';
import { dayGroup } from '@utils/format';
import { statusInfo, isMissed } from '@screens/recent/callStatus';

jest.setTimeout(60000);

const mockNav = { navigate: jest.fn(), goBack: jest.fn(), push: jest.fn() };
let mockParams = {};
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: mockParams }),
  useFocusEffect: cb => require('react').useEffect(cb, [cb]),
}));
jest.mock('@services/calls/placeCall', () => ({ placeCall: jest.fn(async () => true) }));
const { placeCall } = require('@services/calls/placeCall');
const Toast = require('react-native-toast-message').default;
const Clipboard = require('@react-native-clipboard/clipboard');

const flush = (ms = 300) =>
  act(async () => {
    await new Promise(r => setTimeout(r, ms));
  });

const NOW = Date.now();
const DAY = 86400000;
const add = async ({
  number = '+919876543210',
  name = null,
  status = 'completed',
  talk = 0,
  credits = 0,
  ago = 0,
  sid = null,
}) => {
  const id = await callLogRepo.insert({ number, contactName: name, startedAt: NOW - ago });
  if (sid) {
    await callLogRepo.setCallSid(id, sid);
  }
  await callLogRepo.finish(id, { status, talkSeconds: talk, creditsUsed: credits, endedAt: NOW - ago + talk * 1000 });
  return id;
};

beforeEach(async () => {
  jest.clearAllMocks();
  mockParams = {};
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
});

describe('grouping + statuses (P14.T01, T05-T06)', () => {
  test('Today / Yesterday / This week / Older', () => {
    const noon = new Date(2026, 9, 7, 12).getTime();
    expect(dayGroup(noon - 3600e3, noon)).toBe('Today');
    expect(dayGroup(noon - DAY, noon)).toBe('Yesterday');
    expect(dayGroup(noon - 6 * DAY, noon)).toBe('This week');
    expect(dayGroup(noon - 8 * DAY, noon)).toBe('Older');
    expect(dayGroup(noon + 60000, noon)).toBe('Today'); // clock skew
  });

  test('missed (red) = no-answer / busy / failed / no credits; cancelled is grey', () => {
    expect(['no-answer', 'busy', 'failed', 'insufficient-credit'].every(isMissed)).toBe(true);
    expect(isMissed('cancelled')).toBe(false);
    expect(statusInfo('completed').label).toBe('Connected');
    expect(statusInfo('busy').label).toBe('Busy');
  });
});

describe('RecentScreen (P14)', () => {
  const RecentScreen = require('@screens/recent/RecentScreen').default;

  test('T17 empty state', async () => {
    const u = render(<RecentScreen />);
    await flush();
    expect(u.getByText(/No calls yet/)).toBeTruthy();
    fireEvent.press(u.getByText(/OPEN DIALPAD/i));
    expect(mockNav.navigate).toHaveBeenCalledWith('Dialpad');
  });

  test('T01-T04, T18: groups, "2:15 - 2,250 cr", call back, month talk time', async () => {
    await add({ name: 'Ravi Kumar', talk: 135, credits: 2250 });
    await add({ number: '+918888888888', status: 'busy', ago: DAY });
    await add({ number: '+917777777777', status: 'completed', talk: 61, credits: 1017, ago: 10 * DAY });
    const u = render(<RecentScreen />);
    await flush();
    for (const g of ['Today', 'Yesterday', 'Older']) {
      expect(u.getByText(g)).toBeTruthy();
    }
    expect(u.getByText(/2:15 - 2,250 cr/)).toBeTruthy();
    expect(u.getByText(/Busy/)).toBeTruthy();
    expect(u.getByText(/This month: .* talk time/)).toBeTruthy();
    fireEvent.press(u.getByLabelText('Call back Ravi Kumar'));
    expect(placeCall).toHaveBeenCalledWith({ number: '+919876543210', name: 'Ravi Kumar' });
    fireEvent.press(u.getByText('Ravi Kumar'));
    expect(mockNav.navigate).toHaveBeenCalledWith('CallDetails', { id: expect.any(Number) });
  });

  test('T07 filters: Connected / Not connected', async () => {
    await add({ name: 'Ravi', talk: 30, credits: 500 });
    await add({ name: 'Busy Guy', status: 'busy' });
    const u = render(<RecentScreen />);
    await flush();
    fireEvent.press(u.getByText('Not connected'));
    await flush();
    expect(u.queryByText('Ravi')).toBeNull();
    expect(u.getByText('Busy Guy')).toBeTruthy();
    fireEvent.press(u.getByText('Connected'));
    await flush();
    expect(u.getByText('Ravi')).toBeTruthy();
    expect(u.queryByText('Busy Guy')).toBeNull();
  });

  test('T15 a finished call appears without reopening the tab', async () => {
    const u = render(<RecentScreen />);
    await flush();
    await act(async () => {
      await add({ name: 'New Call', talk: 5, credits: 84 });
    });
    await flush();
    expect(u.getByText('New Call')).toBeTruthy();
  });

  test('T13 clear all asks first', async () => {
    await add({ name: 'Ravi' });
    const u = render(<RecentScreen />);
    await flush();
    fireEvent.press(u.getByLabelText('History options'));
    fireEvent.press(u.getAllByText(/Clear all/i).at(-1));
    expect(await callLogRepo.count()).toBe(1); // confirmation dialog first
    await act(async () => fireEvent.press(u.getByText(/^DELETE$/i)));
    await flush();
    expect(await callLogRepo.count()).toBe(0);
    expect(u.getByText(/No calls yet/)).toBeTruthy();
  });

  test('T12 swipe deletes the row, toast Undo puts it back unchanged', async () => {
    const id = await add({ name: 'Ravi', talk: 30, credits: 500 });
    const before = await callLogRepo.getById(id);
    const u = render(<RecentScreen />);
    await flush();
    await act(async () => fireEvent.press(u.getAllByTestId('swipe-open')[0]));
    await flush();
    expect(await callLogRepo.getById(id)).toBeFalsy();
    expect(u.queryByText('Ravi')).toBeNull();
    const shown = Toast.show.mock.calls.at(-1)[0];
    expect(shown.text2).toMatch(/undo/i);
    await act(async () => shown.onPress());
    await flush();
    expect(await callLogRepo.getById(id)).toEqual(before);
    expect(u.getByText('Ravi')).toBeTruthy();
  });
});

describe('CallDetailsScreen (P14.T08-T11)', () => {
  const CallDetailsScreen = require('@screens/recent/CallDetailsScreen').default;

  test('info card, previous calls with the number, actions', async () => {
    await add({ name: 'Ravi', status: 'busy', ago: 2 * DAY });
    const id = await add({ name: 'Ravi', talk: 135, credits: 2250, sid: 'CA1' });
    mockParams = { id };
    const u = render(<CallDetailsScreen />);
    await flush();
    expect(u.getByText('2:15')).toBeTruthy();
    expect(u.getByText(/2,250 cr \(pending\)/)).toBeTruthy(); // not yet confirmed by the server
    expect(u.getByText('Previous calls')).toBeTruthy();
    fireEvent.press(u.getByLabelText('Copy'));
    expect(Clipboard.setString).toHaveBeenCalledWith('+919876543210');
    fireEvent.press(u.getByLabelText('Report'));
    expect(mockNav.navigate).toHaveBeenCalledWith('Report', { number: '+919876543210', callSid: 'CA1' });
    fireEvent.press(u.getByLabelText('Call'));
    expect(placeCall).toHaveBeenCalled();
  });

  test('BUG FIX: an unanswered call shows "0 cr", not "(pending)"', async () => {
    mockParams = { id: await add({ status: 'busy' }) };
    const u = render(<CallDetailsScreen />);
    await flush();
    expect(u.getByText('0 cr')).toBeTruthy();
  });

  test('BUG FIX: a call that no longer exists shows a message, not a blank page', async () => {
    mockParams = { id: 999 };
    const u = render(<CallDetailsScreen />);
    await flush();
    expect(u.getByText(/no longer in your history/)).toBeTruthy();
  });

  test('BUG FIX: "Keep recording" keeps who was called on the recording', async () => {
    const id = await add({ name: 'Ravi Kumar', talk: 30, credits: 500, sid: 'CA2' });
    await recordingsRepo.add({ callLogId: id, filePath: '/rec/CA2.mp3', durationSec: 30, sizeBytes: 1000 });
    mockParams = { id };
    const u = render(<CallDetailsScreen />);
    await flush();
    fireEvent.press(u.getByLabelText('Delete'));
    await act(async () => fireEvent.press(u.getByText(/keep recording/i)));
    await flush();
    expect(await callLogRepo.getById(id)).toBeFalsy();
    const [rec] = await recordingsRepo.listAll();
    expect(rec).toMatchObject({ contactName: 'Ravi Kumar', number: '+919876543210', filePath: '/rec/CA2.mp3' });
    expect(Toast.show).toHaveBeenCalled();
  });
});

describe('migration v3 backfill', () => {
  test('existing recordings get the number/name from their call', async () => {
    const raw = await createSqlJsAdapter();
    await raw.execute('CREATE TABLE schema_version (version INTEGER)');
    for (const m of MIGRATIONS.filter(x => x.version <= 2)) {
      await raw.transaction(async tx => {
        for (const sql of m.up) {
          await tx.execute(sql);
        }
        await tx.execute('INSERT INTO schema_version (version) VALUES (?)', [m.version]);
      });
    }
    await raw.execute(
      "INSERT INTO call_logs (id, number_e164, contact_name, direction, status, started_at) VALUES (5, '+919876543210', 'Ravi', 'outgoing', 'completed', 1)",
    );
    await raw.execute("INSERT INTO recordings (call_log_id, file_path, created_at) VALUES (5, '/r.mp3', 1)");
    await runMigrations(raw);
    const [r] = await raw.execute('SELECT number_e164, contact_name FROM recordings');
    expect(r).toEqual({ number_e164: '+919876543210', contact_name: 'Ravi' });
  });
});
