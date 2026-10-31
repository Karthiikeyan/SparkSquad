import { qk } from '../../lib/query/keys';
import { useLocalQuery } from '../../lib/query/useLocalQuery';
import { useMe } from '../auth/SessionProvider';
import { readSquadSource } from './source';

/** One squad from the local store (null when it isn't synced, e.g. after leaving). */
export function useSquad(squadId: string) {
  const me = useMe();
  return useLocalQuery([...qk.squad(squadId), me.id, me.timezone], (db) =>
    readSquadSource(db, me, squadId),
  );
}
