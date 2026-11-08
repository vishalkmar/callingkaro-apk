import * as callLogRepo from '@db/callLogRepo';
import * as contactsRepo from '@db/contactsRepo';
import * as kv from '@db/kvRepo';
import { listCalls, getCall } from '@services/api/voiceApi';
import { STORAGE_KEYS } from '@constants/config';
import { useCallStore } from '@store/callStore';
import logger from '@utils/logger';

const log = logger.scope('history');
let reconciling = false;

/**
 * Local DB is the user's view, the server is the money truth.
 * Fresh install / reinstall: pull the last 50 server call records once to rebuild Recent.
 */
export const syncHistoryOnce = async () => {
  try {
    if (await kv.get(STORAGE_KEYS.HISTORY_SYNCED, false)) {
      return 0;
    }
    if ((await callLogRepo.count()) > 0) {
      await kv.set(STORAGE_KEYS.HISTORY_SYNCED, true);
      return 0;
    }
    const page = await listCalls(1);
    const names = new Map();
    for (const c of page.items || []) {
      if (!names.has(c.to)) {
        names.set(c.to, (await contactsRepo.getByNumber(c.to))?.name || null);
      }
    }
    const added = await callLogRepo.importServerCalls((page.items || []).slice(0, 50), n => names.get(n));
    await kv.set(STORAGE_KEYS.HISTORY_SYNCED, true);
    log.log('history rebuilt from server', added);
    return added;
  } catch (e) {
    log.warn('history sync failed (will retry next start)', e?.code);
    return 0;
  }
};

/**
 * App killed mid-call / network lost before the final result: ask the server what really happened
 * (it billed from the provider webhook) and fix the local rows.
 */
export const reconcileUnfinishedCalls = async () => {
  if (reconciling) {
    return;
  }
  reconciling = true;
  try {
    const rows = [...(await callLogRepo.listStuck()), ...(await callLogRepo.listUnreconciled())];
    // Never touch the call that is live right now (app returned to the foreground mid-call).
    const live = useCallStore.getState().activeCall?.localId;
    const seen = new Set(live ? [live] : []);
    for (const row of rows) {
      if (seen.has(row.id)) {
        continue;
      }
      seen.add(row.id);
      if (!row.callSid) {
        // never reached the provider
        await callLogRepo.finish(row.id, { status: 'failed', endedAt: row.startedAt, talkSeconds: 0, creditsUsed: 0 });
        await callLogRepo.applyServerResult(row.id, { status: 'failed', talkSeconds: 0, credits: 0 });
        continue;
      }
      try {
        const c = await getCall(row.callSid);
        if (!c.billed && ['initiated', 'ringing', 'in-progress'].includes(c.status)) {
          continue; // server still working on it
        }
        await callLogRepo.applyServerResult(row.id, {
          status: callLogRepo.mapServerStatus(c.status),
          talkSeconds: c.talkSeconds,
          credits: c.credits,
          callerId: c.callerId,
          endReason: c.endReason,
        });
      } catch (e) {
        if (e.status === 404) {
          await callLogRepo.applyServerResult(row.id, { status: 'failed', talkSeconds: 0, credits: 0 });
        }
      }
    }
  } catch (e) {
    log.warn('reconcile failed', e?.message);
  } finally {
    reconciling = false;
  }
};
