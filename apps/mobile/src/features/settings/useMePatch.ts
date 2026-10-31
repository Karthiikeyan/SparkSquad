import type { MeDTO, UpdateMeInput } from '@sparksquad/shared';
import { useCallback } from 'react';
import { useToast } from '../../components/ui';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/errors';
import { useMe, useSession } from '../auth/SessionProvider';

/** Optimistic `PATCH /v1/me`: applies the change at once, rolls back with a toast on failure. */
export function useMePatch() {
  const me = useMe();
  const { setMe } = useSession();
  const toast = useToast();
  return useCallback(
    async (patch: UpdateMeInput): Promise<boolean> => {
      const prev = me;
      setMe({ ...me, ...patch } as MeDTO);
      try {
        setMe(await endpoints.updateMe(patch));
        return true;
      } catch (e) {
        setMe(prev);
        toast.show({ message: errorMessage(e), kind: 'error' });
        return false;
      }
    },
    [me, setMe, toast],
  );
}
