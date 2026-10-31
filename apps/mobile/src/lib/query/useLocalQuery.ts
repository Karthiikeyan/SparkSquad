import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import type { LocalDb } from '../db/types';
import { getRuntime } from '../runtime';

/**
 * Reads from the on-device store. Keys must start with `local` so syncs and outbox changes
 * invalidate them; they never wait for the network.
 */
export function useLocalQuery<T>(
  queryKey: readonly unknown[],
  read: (db: LocalDb) => T | Promise<T>,
): UseQueryResult<T> {
  return useQuery({
    queryKey,
    queryFn: async () => read(getRuntime().db),
    networkMode: 'always',
    staleTime: Infinity,
  });
}
