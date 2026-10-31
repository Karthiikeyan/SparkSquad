import { useCallback, useState } from 'react';
import { useToast } from '../../components/ui';
import { errorMessage, isNetworkError } from '../../lib/api/errors';
import { refresh } from '../../lib/runtime';

/** Pull-to-refresh: flush the outbox, pull deltas, toast on real errors (offline is silent). */
export function useRefresh() {
  const [refreshing, setRefreshing] = useState(false);
  const toast = useToast();
  const onRefresh = useCallback(() => {
    setRefreshing(true);
    refresh()
      .catch((e: unknown) => {
        if (!isNetworkError(e)) toast.show({ message: errorMessage(e), kind: 'error' });
      })
      .finally(() => setRefreshing(false));
  }, [toast]);
  return { refreshing, onRefresh };
}
