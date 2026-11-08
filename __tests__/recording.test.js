// Phase 23 app side: recording download / save / share / delete against an in-memory file system.
import { Platform } from 'react-native';
import { createSqlJsAdapter } from './helpers/sqljsAdapter';
import { setDbAdapter, initDatabase } from '@db/index';
import * as callLogRepo from '@db/callLogRepo';
import * as recordingsRepo from '@db/recordingsRepo';

const mockFiles = new Map(); // path -> size
const mockFs = { free: 10 * 1024 ** 3, download: () => ({ statusCode: 200, size: 500000 }) };
jest.mock('@dr.pogodin/react-native-fs', () => ({
  DocumentDirectoryPath: '/data/app/files',
  ExternalStorageDirectoryPath: '/storage/emulated/0',
  exists: jest.fn(async p => mockFiles.has(p) || [...mockFiles.keys()].some(k => k.startsWith(`${p}/`))),
  mkdir: jest.fn(async () => {}),
  unlink: jest.fn(async p => {
    mockFiles.delete(p);
  }),
  stat: jest.fn(async p => ({ size: mockFiles.get(p) || 0 })),
  getFSInfo: jest.fn(async () => ({ freeSpace: mockFs.free })),
  copyFile: jest.fn(async (from, to) => {
    if (mockFs.copyError) {
      throw new Error(mockFs.copyError);
    }
    mockFiles.set(to, mockFiles.get(from) || 0);
  }),
  scanFile: jest.fn(async () => []),
  downloadFile: jest.fn(({ toFile }) => ({
    promise: (async () => {
      const r = mockFs.download();
      if (r.throw) {
        throw new Error(r.throw);
      }
      mockFiles.set(toFile, r.size); // even an error page is written to disk
      return { statusCode: r.statusCode };
    })(),
  })),
}));
jest.mock('react-native-share', () => ({ open: jest.fn(async () => ({})) }));
jest.mock('@services/api/voiceApi', () => ({
  getRecordingUrl: jest.fn(async () => ({ url: 'https://api/x', durationSec: 61 })),
}));
let mockPerm = 'granted';
jest.mock('@services/permissions/permissions', () => ({
  request: jest.fn(async () => mockPerm),
  STATUS: { GRANTED: 'granted', DENIED: 'denied', BLOCKED: 'blocked' },
}));

const fs = require('@dr.pogodin/react-native-fs');
const voiceApi = require('@services/api/voiceApi');
const Share = require('react-native-share');
const svc = require('@services/recording/recordingService');

const setApi = v => Object.defineProperty(Platform, 'Version', { get: () => v, configurable: true });
let callId;

beforeEach(async () => {
  jest.clearAllMocks();
  mockFiles.clear();
  mockFs.free = 10 * 1024 ** 3;
  mockFs.download = () => ({ statusCode: 200, size: 500000 });
  delete mockFs.copyError;
  mockPerm = 'granted';
  setApi(34);
  setDbAdapter(await createSqlJsAdapter());
  await initDatabase();
  callId = await callLogRepo.insert({ number: '+919876543210', contactName: 'Ravi Kumar' });
});

describe('download after the call (P23.T12, T14)', () => {
  test('saved in app storage + recordings row + call flagged', async () => {
    const p = await svc.downloadForCall({ callLogId: callId, callSid: 'CA1' });
    expect(p).toBe('/data/app/files/recordings/CA1.mp3');
    const [rec] = await recordingsRepo.listByCall(callId);
    expect(rec).toMatchObject({ durationSec: 61, sizeBytes: 500000, contactName: 'Ravi Kumar' });
    expect((await callLogRepo.getById(callId)).hasRecording).toBe(true);
  });

  test('BUG FIX: downloading again (auto + "Check for a recording") does not duplicate it', async () => {
    await svc.downloadForCall({ callLogId: callId, callSid: 'CA1' });
    await svc.downloadForCall({ callLogId: callId, callSid: 'CA1' });
    expect(await recordingsRepo.listByCall(callId)).toHaveLength(1);
    expect(fs.downloadFile).toHaveBeenCalledTimes(1);
  });

  test('BUG FIX: a failed HTTP download leaves no half file; retried until ready', async () => {
    let n = 0;
    mockFs.download = () => (++n < 2 ? { statusCode: 404, size: 120 } : { statusCode: 200, size: 400000 });
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const p = svc.downloadForCall({ callLogId: callId, callSid: 'CA2' });
      await jest.advanceTimersByTimeAsync(4000);
      await p;
    } finally {
      jest.useRealTimers();
    }
    expect(fs.unlink).toHaveBeenCalledWith('/data/app/files/recordings/CA2.mp3'); // the 404 page was removed
    expect(mockFiles.get('/data/app/files/recordings/CA2.mp3')).toBe(400000);
  });

  test('not ready after all attempts -> NOT_READY', async () => {
    voiceApi.getRecordingUrl.mockRejectedValue(Object.assign(new Error('none'), { code: 'NO_RECORDING' }));
    jest.useFakeTimers({ doNotFake: ['nextTick', 'setImmediate'] });
    try {
      const p = svc.downloadForCall({ callLogId: callId, callSid: 'CA3', attempts: 2 }).catch(e => e);
      await jest.advanceTimersByTimeAsync(20000);
      expect(await p).toMatchObject({ code: 'NOT_READY' });
    } finally {
      jest.useRealTimers();
      voiceApi.getRecordingUrl.mockReset();
      voiceApi.getRecordingUrl.mockImplementation(async () => ({ url: 'https://api/x', durationSec: 61 }));
    }
  });

  test('T17 storage full -> clear message, nothing downloaded', async () => {
    mockFs.free = 5 * 1024 * 1024;
    await expect(svc.downloadForCall({ callLogId: callId, callSid: 'CA4' })).rejects.toMatchObject({
      code: 'STORAGE_FULL',
    });
    expect(fs.downloadFile).not.toHaveBeenCalled();
  });
});

describe('save / share / delete (P23.T13, T15, T18)', () => {
  const saved = async () => {
    await svc.downloadForCall({ callLogId: callId, callSid: 'CA9' });
    return (await recordingsRepo.listByCall(callId))[0];
  };

  test('save to phone -> Music/CallingKaro with a readable name, media scan', async () => {
    const rec = await saved();
    const dest = await svc.saveToPhone(rec);
    expect(dest).toMatch(/^\/storage\/emulated\/0\/Music\/CallingKaro\/CallingKaro_Ravi_Kumar_\d+\.mp3$/);
    expect(fs.scanFile).toHaveBeenCalledWith(dest);
  });

  test('BUG FIX: Hindi contact names give a number-based file name, not "CallingKaro____"', async () => {
    const rec = { ...(await saved()), contactName: 'राम' };
    expect(await svc.saveToPhone(rec)).toMatch(/CallingKaro_\+919876543210_\d+\.mp3$/);
  });

  test('Android 10 asks for storage; refused -> clear error', async () => {
    setApi(29);
    mockPerm = 'blocked';
    await expect(svc.saveToPhone(await saved())).rejects.toMatchObject({ code: 'PERMISSION_BLOCKED' });
  });

  test('Android 14 needs no permission to save', async () => {
    const perms = require('@services/permissions/permissions');
    await svc.saveToPhone(await saved());
    expect(perms.request).not.toHaveBeenCalled();
  });

  test('disk full while saving -> STORAGE_FULL', async () => {
    mockFs.copyError = 'ENOSPC: no space left';
    await expect(svc.saveToPhone(await saved())).rejects.toMatchObject({ code: 'STORAGE_FULL' });
  });

  test('share opens the system sheet as audio/mpeg', async () => {
    await svc.shareRecording(await saved());
    expect(Share.open).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'audio/mpeg', url: expect.stringMatching(/^file:\/\//) }),
    );
  });

  test('delete removes row + file; deleting a call can keep or delete its recording', async () => {
    const rec = await saved();
    await svc.deleteCallLogWithRecordings(callId, { deleteFiles: false });
    expect(mockFiles.has(rec.filePath)).toBe(true);
    expect(await recordingsRepo.listAll()).toHaveLength(1);
    await svc.deleteRecording((await recordingsRepo.listAll())[0]);
    expect(mockFiles.has(rec.filePath)).toBe(false);
    expect(await svc.totalRecordingsSize()).toBe(0);
  });
});
