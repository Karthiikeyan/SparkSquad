import NetInfo from '@react-native-community/netinfo';
import { AppState } from 'react-native';
import { clearAllLocalProofs } from '../features/checkin/localProof';
import { endpoints } from './api/endpoints';
import { appEvents } from './appEvents';
import { openLocalDb } from './db/client';
import type { LocalDb } from './db/types';
import { createOutboxHandlers, revertRejected } from './outbox/handlers';
import { createOutbox, type Outbox } from './outbox/outbox';
import { ensurePlans } from './plans';
import { uploadProof } from './photoUpload';
import { clearKeyed } from './prefs';
import { wipeLocalData } from './sync/applySync';
import { createSyncEngine, type SyncEngine } from './sync/engine';

export interface Runtime {
  db: LocalDb;
  sync: SyncEngine;
  outbox: Outbox;
}

let runtime: Runtime | null = null;
let starting: Promise<Runtime> | null = null;
let signedIn = false;

/** Sync and outbox delivery only run with a session (otherwise every call would 401). */
export function setSignedIn(value: boolean): void {
  signedIn = value;
}

/** Opens the DB and creates the sync engine + outbox (once). */
export function startRuntime(): Promise<Runtime> {
  if (starting) return starting;
  starting = (async () => {
    const db = await openLocalDb();
    const sync = createSyncEngine({
      db,
      fetchSync: endpoints.sync,
      onSynced: () => appEvents.emit('syncCompleted'),
    });
    const outbox = createOutbox({
      db,
      handlers: createOutboxHandlers(db, endpoints, (id, uri) => uploadProof(id, uri)),
      onChange: () => appEvents.emit('outboxChanged'),
      onPermanentFailure: (item) => revertRejected(db, endpoints, item),
    });
    runtime = { db, sync, outbox };
    return runtime;
  })();
  starting.catch(() => {
    starting = null;
  });
  return starting;
}

export function getRuntime(): Runtime {
  if (!runtime) throw new Error('Runtime not started');
  return runtime;
}

/** Flush queued writes first so the pull sees them, then pull deltas. Errors are swallowed (offline). */
export async function refresh(): Promise<void> {
  if (!runtime || !signedIn) return;
  try {
    await flushAndSchedule();
  } catch {
    // Retried on the next trigger.
  }
  await runtime.sync.sync();
  if ((await ensurePlans(runtime.db)) > 0) appEvents.emit('syncCompleted');
}

let listening = false;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

/** Flushes the outbox, then arms one timer for the next backed-off item (if any). */
async function flushAndSchedule(): Promise<void> {
  if (!runtime || !signedIn) return;
  const { outbox } = runtime;
  await outbox.flush();
  const due = await outbox.nextDueAt();
  if (retryTimer) clearTimeout(retryTimer);
  retryTimer = null;
  if (due !== null && listening) {
    retryTimer = setTimeout(
      () => {
        retryTimer = null;
        flushAndSchedule().catch(() => undefined);
      },
      Math.max(1_000, due - Date.now()),
    );
  }
}

/** Refresh on app foreground and when connectivity returns (no sockets, Architecture §5). */
export function startBackgroundTriggers(): () => void {
  if (listening) return () => undefined;
  listening = true;
  let wasOnline = true;
  const appSub = AppState.addEventListener('change', (s) => {
    if (s === 'active') refresh().catch(() => undefined);
  });
  const netUnsub = NetInfo.addEventListener((state) => {
    const online = state.isConnected !== false && state.isInternetReachable !== false;
    if (online && !wasOnline && runtime) {
      runtime.outbox
        .retryNow()
        .then(refresh)
        .catch(() => undefined);
    }
    wasOnline = online;
  });
  const outboxUnsub = appEvents.on('outboxChanged', () => {
    // Deliver new writes right away; failures back off inside the outbox and retry on a timer.
    flushAndSchedule().catch(() => undefined);
  });
  return () => {
    listening = false;
    if (retryTimer) clearTimeout(retryTimer);
    retryTimer = null;
    appSub.remove();
    netUnsub();
    outboxUnsub();
  };
}

export async function clearLocalData(): Promise<void> {
  if (runtime) await wipeLocalData(runtime.db);
  // Drafts and Free-plan proof photos are keyed by challenge/date only; drop them so the next
  // account on this phone never sees or uploads them.
  clearKeyed();
  clearAllLocalProofs();
}
