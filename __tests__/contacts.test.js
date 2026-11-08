import './helpers/nativeMocks';
import React from 'react';
import { render, fireEvent, act } from '@testing-library/react-native';
import Contacts from 'react-native-contacts';
import { createSqlJsAdapter } from './helpers/sqljsAdapter';
import { setDbAdapter, initDatabase } from '@db/index';
import * as contactsRepo from '@db/contactsRepo';
import * as favoritesRepo from '@db/favoritesRepo';
import { mapPhoneContacts, buildSections, filterContacts, sectionOf } from '@services/contacts/contactsService';

jest.setTimeout(60000);

const mockNav = { navigate: jest.fn() };
jest.mock('@react-navigation/native', () => ({
  ...jest.requireActual('@react-navigation/native'),
  useNavigation: () => mockNav,
  useRoute: () => ({ params: {} }),
  useFocusEffect: cb => require('react').useEffect(cb, [cb]),
}));
let mockPerm = 'granted';
jest.mock('@services/permissions/permissions', () => ({
  check: jest.fn(async () => mockPerm),
  request: jest.fn(async () => (mockPerm = 'granted')),
  openSettings: jest.fn(),
  STATUS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));
jest.mock('@services/calls/placeCall', () => ({ placeCall: jest.fn(async () => true) }));
const { placeCall } = require('@services/calls/placeCall');
const perms = require('@services/permissions/permissions');

const phone = (recordID, displayName, numbers, extra = {}) => ({
  recordID,
  displayName,
  phoneNumbers: numbers.map(n => ({ number: n, label: 'mobile' })),
  ...extra,
});

const flush = (ms = 300) =>
  act(async () => {
    await new Promise(r => setTimeout(r, ms));
  });

beforeEach(async () => {
  jest.clearAllMocks();
  mockPerm = 'granted';
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
});

describe('mapping + de-duplication (P13.T02-T03)', () => {
  test('numbers normalised to E.164 and de-duplicated inside a contact', () => {
    const [c] = mapPhoneContacts([phone('1', 'Ravi', ['098765 43210', '+91 98765-43210', '9876543210'])]);
    expect(c.numbers.map(n => n.e164)).toEqual(['+919876543210']);
  });

  test('BUG FIX: the same person saved twice becomes ONE row with all numbers', () => {
    const out = mapPhoneContacts([
      phone('1', 'Ravi Kumar', ['9876543210']),
      phone('2', 'ravi  kumar', ['+919876543210', '9812345678']),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].numbers.map(n => n.e164)).toEqual(['+919876543210', '+919812345678']);
  });

  test('two different people with the same name stay separate', () => {
    const out = mapPhoneContacts([phone('1', 'Amit', ['9876543210']), phone('2', 'Amit', ['9812345678'])]);
    expect(out).toHaveLength(2);
  });

  test('unnamed duplicates of a named number are dropped; contacts without numbers skipped', () => {
    const out = mapPhoneContacts([
      phone('1', 'Ravi', ['9876543210']),
      phone('2', '', ['+91 98765 43210']),
      phone('3', '', ['9000000001']),
      phone('4', '', ['9000000001']),
      phone('5', 'No Number', []),
    ]);
    expect(out.map(c => c.id)).toEqual(['1', '3']);
  });

  test('thumbnail path kept for avatars', () => {
    const [c] = mapPhoneContacts([
      phone('1', 'Ravi', ['9876543210'], { hasThumbnail: true, thumbnailPath: 'content://t/1' }),
    ]);
    expect(c.thumbnail).toBe('content://t/1');
  });
});

describe('sections + search (P13.T05-T06)', () => {
  const list = mapPhoneContacts([
    phone('1', 'zara', ['9876500001']),
    phone('2', 'Aman', ['9876500002']),
    phone('3', '', ['9876500003']),
    phone('4', '123 Plumber', ['9876500004']),
    phone('5', 'अमित', ['9876500005']),
  ]);

  test("A-Z with '#' and '+' groups; lower-case and non-Latin names handled", () => {
    const { letters } = buildSections(list);
    expect(letters).toEqual(['#', '+', 'A', 'Z']);
    expect(sectionOf(list.find(c => c.id === '5'))).toBe('#');
  });

  test.each([
    ['aman', ['2']],
    ['ZAR', ['1']],
    ['500003', ['3']],
    ['09876500004', ['4']], // BUG FIX: leading 0 typed
    ['+91 98765 00002', ['2']],
    ['9', []], // one digit is too short to search numbers
  ])('search "%s"', (q, ids) => {
    expect(filterContacts(list, q).map(c => c.id)).toEqual(ids);
  });
});

describe('ContactsScreen (P13)', () => {
  const ContactsScreen = require('@screens/contacts/ContactsScreen').default;

  test('T16: no permission -> message + Access to Contacts link that asks', async () => {
    mockPerm = 'denied';
    const u = render(<ContactsScreen />);
    await flush();
    expect(Contacts.getAll).not.toHaveBeenCalled(); // never read without permission
    await act(async () => fireEvent.press(u.getByText(/Access to Contacts/i)));
    expect(perms.request).toHaveBeenCalledWith('contacts');
  });

  test('cached list shows instantly, then phone contacts replace it; tap -> sheet -> call', async () => {
    await contactsRepo.bulkUpsert(mapPhoneContacts([phone('1', 'Old Cached', ['9876500009'])]));
    Contacts.getAll.mockResolvedValueOnce([phone('1', 'Ravi Kumar', ['9876543210', '9812345678'])]);
    const u = render(<ContactsScreen />);
    fireEvent.press(await u.findByText('Ravi Kumar', {}, { timeout: 15000 }));
    expect(u.queryByText('Old Cached')).toBeNull();
    expect(u.getByLabelText('Call +919812345678')).toBeTruthy(); // every number listed
    fireEvent.press(u.getByLabelText('Call +919812345678'));
    expect(placeCall).toHaveBeenCalledWith({ number: '+919812345678', name: 'Ravi Kumar' });
  });

  test('T10/T11: long-press adds a favorite; favorites row appears; T17 no results text', async () => {
    Contacts.getAll.mockResolvedValueOnce([phone('1', 'Ravi Kumar', ['9876543210'])]);
    const u = render(<ContactsScreen />);
    const row = await u.findByText('Ravi Kumar', {}, { timeout: 15000 });
    await act(async () => fireEvent(row, 'longPress'));
    await flush();
    expect(await favoritesRepo.list()).toHaveLength(1);
    expect(u.getByLabelText('Call favorite Ravi Kumar')).toBeTruthy();
    fireEvent.changeText(u.getByLabelText('Search contacts'), 'zzzz');
    await flush();
    expect(u.getByText(/No contacts found/i)).toBeTruthy();
  });

  test('T15: 2000 contacts map + cache + section in reasonable time', async () => {
    const big = Array.from({ length: 2000 }, (_, i) =>
      phone(String(i), `Person ${String.fromCharCode(65 + (i % 26))}${i}`, [`98${String(i).padStart(8, '0')}`]),
    );
    const t0 = Date.now();
    const mapped = mapPhoneContacts(big);
    await contactsRepo.bulkUpsert(mapped);
    const { items } = buildSections(await contactsRepo.getAll());
    expect(mapped).toHaveLength(2000);
    expect(items.filter(i => i.type === 'row')).toHaveLength(2000);
    expect(Date.now() - t0).toBeLessThan(40000); // generous: CI machines vary
  });
});
