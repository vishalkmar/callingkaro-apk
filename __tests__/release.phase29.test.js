// P29.T11 Play review: the app manifest only keeps permissions CallingKaro really uses.
import fs from 'fs';
import path from 'path';

const manifest = fs.readFileSync(path.join(__dirname, '..', 'android', 'app', 'src', 'main', 'AndroidManifest.xml'), 'utf8');
const declared = name =>
  new RegExp(`<uses-permission android:name="android\\.permission\\.${name}"(?![^>]*tools:node="remove")`).test(manifest);
const removed = name => new RegExp(`android\\.permission\\.${name}" tools:node="remove"`).test(manifest);

test.each(['SCHEDULE_EXACT_ALARM', 'USE_FULL_SCREEN_INTENT', 'READ_PHONE_STATE'])(
  '%s (added by a library, not used) is stripped from the merged manifest',
  name => {
    expect(removed(name)).toBe(true);
    expect(declared(name)).toBe(false);
  },
);

test.each(['RECORD_AUDIO', 'READ_CONTACTS', 'POST_NOTIFICATIONS', 'BLUETOOTH_CONNECT', 'FOREGROUND_SERVICE_MICROPHONE'])(
  '%s (core feature) stays',
  name => expect(declared(name)).toBe(true),
);

test('old-Android storage / bluetooth permissions are capped by maxSdkVersion', () => {
  expect(manifest).toMatch(/READ_EXTERNAL_STORAGE" android:maxSdkVersion="32"/);
  expect(manifest).toMatch(/WRITE_EXTERNAL_STORAGE" android:maxSdkVersion="29"/);
  expect(manifest).toMatch(/permission\.BLUETOOTH" android:maxSdkVersion="30"/);
});

test('the spin reminder is an inexact trigger (no exact-alarm permission needed)', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'src', 'services', 'notifications', 'notifications.js'), 'utf8');
  expect(src).toMatch(/TriggerType\.TIMESTAMP/);
  expect(src).not.toMatch(/alarmManager/);
});
