import type { SyncResponse } from '@sparksquad/shared';
import { getKv } from '../db/helpers';
import type { LocalDb } from '../db/types';
import { applySync, KV_CURSOR } from './applySync';

export interface SyncDeps {
  db: LocalDb;
  fetchSync: (since?: string) => Promise<SyncResponse>;
  onSynced?: () => void;
}

export interface SyncEngine {
  /** Pulls deltas. Concurrent calls share one request; a call made mid-flight queues one more. */
  sync(): Promise<void>;
}

export function createSyncEngine(deps: SyncDeps): SyncEngine {
  let running: Promise<void> | null = null;
  let again = false;

  async function pullOnce(): Promise<void> {
    const cursor = await getKv(deps.db, KV_CURSOR);
    const res = await deps.fetchSync(cursor);
    await applySync(deps.db, res);
    deps.onSynced?.();
  }

  function sync(): Promise<void> {
    if (running) {
      again = true;
      return running;
    }
    running = (async () => {
      try {
        do {
          again = false;
          await pullOnce();
        } while (again);
      } finally {
        running = null;
      }
    })();
    return running;
  }

  return { sync };
}
