import { qk } from '../../lib/query/keys';
import { useLocalQuery } from '../../lib/query/useLocalQuery';
import { useMe } from '../auth/SessionProvider';
import { readYouSource, type YouSource } from './source';

export const youKey = (meId: string) => [...qk.local, 'you', meId] as const;

/** My history, streaks and badges from the local store; refreshed after every sync. */
export function useYou() {
  const me = useMe();
  return useLocalQuery<YouSource>(youKey(me.id), (db) => readYouSource(db, me.id));
}
