import type { ConfigResponse } from '@sparksquad/shared';
import { useQuery, type UseQueryResult } from '@tanstack/react-query';
import { endpoints } from '../../lib/api/endpoints';
import { qk } from '../../lib/query/keys';

/** Public server config (features, limits, min version). Cached for an hour. */
export function useConfig(): UseQueryResult<ConfigResponse> {
  return useQuery({
    queryKey: qk.config,
    queryFn: endpoints.config,
    staleTime: 60 * 60_000,
    retry: 1,
  });
}
