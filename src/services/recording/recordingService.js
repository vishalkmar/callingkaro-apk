import { Platform } from 'react-native';
import {
  DocumentDirectoryPath,
  ExternalStorageDirectoryPath,
  copyFile,
  downloadFile,
  exists,
  getFSInfo,
  mkdir,
  scanFile,
  stat,
  unlink,
} from '@dr.pogodin/react-native-fs';
import Share from 'react-native-share';
import * as recordingsRepo from '@db/recordingsRepo';
import * as callLogRepo from '@db/callLogRepo';
import { clearCallHistory, deleteAllLocalData } from '@db/localData';
import { getRecordingUrl } from '@services/api/voiceApi';
import { request, STATUS } from '@services/permissions/permissions';
import logger from '@utils/logger';

const log = logger.scope('recording');

// App-specific folder: no storage permission needed, deleted with the app.
export const RECORDINGS_DIR = `${DocumentDirectoryPath}/recordings`;
const PUBLIC_DIR = `${ExternalStorageDirectoryPath}/Music/CallingKaro`;
const MIN_FREE_BYTES = 20 * 1024 * 1024;

export class RecordingError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

const ensureDir = async dir => {
  if (!(await exists(dir))) {
    await mkdir(dir);
  }
};

const removeFile = async path => {
  try {
    if (path && (await exists(path))) {
      await unlink(path);
    }
  } catch (e) {
    log.warn('unlink failed', e?.message);
  }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

/**
 * After a recorded call ends: fetch a short-lived URL from our server and download the file into
 * app storage. The provider needs a few seconds to finish the recording, so retry for ~1 minute.
 */
export const downloadForCall = async ({ callLogId, callSid, attempts = 8 }) => {
  // Already downloaded (auto-download after the call + "Check for a recording" in Call Details).
  const have = (await recordingsRepo.listByCall(callLogId))[0];
  if (have && (await exists(have.filePath))) {
    return have.filePath;
  }
  const fs = await getFSInfo().catch(() => null);
  if (fs && fs.freeSpace < MIN_FREE_BYTES) {
    throw new RecordingError('STORAGE_FULL', 'Your phone storage is full. Free some space to save recordings.');
  }
  await ensureDir(RECORDINGS_DIR);
  for (let i = 0; i < attempts; i++) {
    try {
      const { url, durationSec } = await getRecordingUrl(callSid);
      const filePath = `${RECORDINGS_DIR}/${callSid}.mp3`;
      const res = await downloadFile({ fromUrl: url, toFile: filePath }).promise;
      if (res.statusCode !== 200) {
        await removeFile(filePath); // never keep a half / error-page file
        throw new Error(`HTTP ${res.statusCode}`);
      }
      const info = await stat(filePath);
      await recordingsRepo.add({
        callLogId,
        filePath,
        durationSec: durationSec || 0,
        sizeBytes: Number(info.size) || 0,
      });
      log.log('recording saved', callSid);
      return filePath;
    } catch (e) {
      if (/ENOSPC|space/i.test(e?.message || '')) {
        await removeFile(`${RECORDINGS_DIR}/${callSid}.mp3`);
        throw new RecordingError('STORAGE_FULL', 'Your phone storage is full. Free some space to save recordings.');
      }
      if (e?.code === 'NO_RECORDING' || /HTTP|Network|timeout/i.test(e?.message || '')) {
        await sleep(Math.min(15000, 3000 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  throw new RecordingError('NOT_READY', 'The recording is not ready yet. Try again from Call Details.');
};

/** "Save to phone": copies into Music/CallingKaro so other apps can see it. */
export const saveToPhone = async rec => {
  const api = Number(Platform.Version);
  if (api <= 32) {
    const s = await request('storage');
    if (s !== STATUS.GRANTED && api <= 29) {
      throw new RecordingError(
        s === STATUS.BLOCKED ? 'PERMISSION_BLOCKED' : 'PERMISSION_DENIED',
        'Storage permission is needed to save recordings to your phone.',
      );
    }
  }
  try {
    await ensureDir(PUBLIC_DIR);
    // Non-Latin names (e.g. Hindi) would become only underscores -> fall back to the number.
    const label = (rec.contactName || '')
      .replace(/[^\w+]/g, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');
    const who = label || (rec.number || 'call').replace(/[^\d+]/g, '');
    const name = `CallingKaro_${who}_${rec.createdAt}.mp3`;
    const dest = `${PUBLIC_DIR}/${name}`;
    await copyFile(rec.filePath, dest);
    await scanFile(dest).catch(() => {});
    return dest;
  } catch (e) {
    if (/ENOSPC|space/i.test(e?.message || '')) {
      throw new RecordingError('STORAGE_FULL', 'Your phone storage is full.');
    }
    throw new RecordingError('SAVE_FAILED', 'Could not save the recording to your phone.');
  }
};

export const shareRecording = rec =>
  Share.open({
    url: `file://${rec.filePath}`,
    type: 'audio/mpeg',
    failOnCancel: false,
    title: 'Share recording',
  }).catch(() => null);

export const deleteRecording = async rec => {
  await recordingsRepo.remove(rec.id);
  await removeFile(rec.filePath);
};

/** Deletes a history entry; its recordings too when deleteFiles is true (UI asks first). */
export const deleteCallLogWithRecordings = async (callLogId, { deleteFiles = true } = {}) => {
  const recs = await recordingsRepo.listByCall(callLogId);
  if (deleteFiles) {
    for (const r of recs) {
      await deleteRecording(r);
    }
  }
  await callLogRepo.remove(callLogId);
};

export const deleteAllRecordings = async () => {
  const recs = await recordingsRepo.clearAll();
  await Promise.all(recs.map(r => removeFile(r.filePath)));
};

export const clearHistoryAndRecordings = async () => {
  const recs = await clearCallHistory();
  await Promise.all(recs.map(r => removeFile(r.filePath)));
};

export const wipeLocalData = async () => {
  const recs = await deleteAllLocalData();
  await Promise.all(recs.map(r => removeFile(r.filePath)));
};

export const totalRecordingsSize = () => recordingsRepo.totalSize();
