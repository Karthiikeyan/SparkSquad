import { usernameSchema } from '@sparksquad/shared';
import { useEffect, useState } from 'react';
import { endpoints } from '../../lib/api/endpoints';

export type UsernameState = 'empty' | 'invalid' | 'checking' | 'available' | 'taken' | 'unknown';

export function validUsername(value: string): string | null {
  const parsed = usernameSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

/** Debounced availability check; `current` is the user's own username (always available). */
export function useUsernameCheck(value: string, current: string | null, delayMs = 400) {
  const [state, setState] = useState<UsernameState>('empty');
  useEffect(() => {
    if (!value) {
      setState('empty');
      return;
    }
    const name = validUsername(value);
    if (!name) {
      setState('invalid');
      return;
    }
    if (name === current) {
      setState('available');
      return;
    }
    setState('checking');
    const controller = new AbortController();
    const timer = setTimeout(() => {
      endpoints
        .usernameAvailable(name, controller.signal)
        .then((r) => setState(r.available ? 'available' : 'taken'))
        // Offline or server trouble: let the save decide.
        .catch(() => {
          if (!controller.signal.aborted) setState('unknown');
        });
    }, delayMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [value, current, delayMs]);
  return state;
}
