import { isValidTimeZone, type MeDTO } from '@sparksquad/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getCalendars } from 'expo-localization';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { identify, resetAnalytics } from '../../lib/analytics';
import { endpoints } from '../../lib/api/endpoints';
import { appEvents } from '../../lib/appEvents';
import { authClient } from '../../lib/auth';
import { getKv, parseJson } from '../../lib/db/helpers';
import { registerPushToken, unregisterPushToken } from '../../lib/notifications';
import { getPref, removePref, setPref } from '../../lib/prefs';
import { clearLocalData, getRuntime, refresh, setSignedIn } from '../../lib/runtime';
import { KV_ME } from '../../lib/sync/applySync';
import { clearReminders } from '../reminders/schedule';
import { hasRequiredProfile, type SessionStatus } from './routing';
import { signOutGoogle } from './signIn';

export interface SessionValue {
  status: SessionStatus;
  userId: string | null;
  me: MeDTO | null;
  /** `me` couldn't be loaded and nothing is cached (offline on first launch, server down). */
  meError: boolean;
  onboarded: boolean;
  pendingRoute: string | null;
  pendingInvite: string | null;
  setMe: (me: MeDTO) => void;
  retryMe: () => void;
  /** Marks onboarding done; the index route then sends the user to `route` (or Today). */
  completeOnboarding: (route?: string) => void;
  clearPendingRoute: () => void;
  setPendingInvite: (code: string | null) => void;
  signOut: () => Promise<void>;
}

const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession must be used inside SessionProvider');
  return ctx;
}

/** The signed-in user; only use on screens behind the signed-in guard. */
export function useMe(): MeDTO {
  const { me } = useSession();
  if (!me) throw new Error('useMe used without a loaded profile');
  return me;
}

export const meQueryKey = (userId: string | null) => ['session', 'me', userId] as const;

function deviceTimeZone(): string | null {
  const tz = getCalendars()[0]?.timeZone;
  return tz && isValidTimeZone(tz) ? tz : null;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const session = authClient.useSession();
  const userId = session.data?.user.id ?? null;
  const status: SessionStatus = userId ? 'signedIn' : session.isPending ? 'loading' : 'signedOut';

  const [cachedMe, setCachedMe] = useState<MeDTO | null>(null);
  const [storeReady, setStoreReady] = useState(false);
  const [onboarded, setOnboarded] = useState(false);
  const [pendingRoute, setPendingRoute] = useState<string | null>(null);
  const [pendingInvite, setPendingInviteState] = useState<string | null>(
    () => getPref('pendingInvite') ?? null,
  );
  const sawIncomplete = useRef(false);
  const tzChecked = useRef<string | null>(null);
  const pushRegistered = useRef<string | null>(null);
  const signingOut = useRef(false);

  // Prepare the local store for this user (wipe on account switch), then start syncing.
  useEffect(() => {
    let alive = true;
    setStoreReady(false);
    sawIncomplete.current = false;
    if (!userId) {
      setSignedIn(false);
      setCachedMe(null);
      setOnboarded(false);
      return;
    }
    setOnboarded(getPref('onboardedUserId') === userId);
    identify(userId);
    (async () => {
      const { db } = getRuntime();
      const stored = parseJson<MeDTO | null>(await getKv(db, KV_ME), null);
      if (stored && stored.id !== userId) await clearLocalData();
      if (!alive) return;
      setCachedMe(stored?.id === userId ? stored : null);
      setSignedIn(true);
      setStoreReady(true);
      refresh().catch(() => undefined);
    })().catch(() => {
      if (alive) {
        setSignedIn(true);
        setStoreReady(true);
      }
    });
    return () => {
      alive = false;
    };
  }, [userId]);

  const meQuery = useQuery({
    queryKey: meQueryKey(userId),
    queryFn: endpoints.me,
    enabled: !!userId && storeReady,
    staleTime: 5 * 60_000,
  });

  const me = meQuery.data ?? cachedMe;
  const meError = !!userId && storeReady && !me && meQuery.isError;
  const effectiveStatus: SessionStatus =
    status === 'signedIn' && !me && !meError ? 'loading' : status;

  const setMe = useCallback(
    (next: MeDTO) => queryClient.setQueryData(meQueryKey(next.id), next),
    [queryClient],
  );

  const markOnboarded = useCallback(() => {
    if (!userId) return;
    setPref('onboardedUserId', userId);
    setOnboarded(true);
  }, [userId]);

  // Returning users who already finished A5/A6 on another phone skip onboarding.
  useEffect(() => {
    if (!me || me.id !== userId || onboarded) return;
    if (!hasRequiredProfile(me)) sawIncomplete.current = true;
    else if (!sawIncomplete.current) markOnboarded();
  }, [me, userId, onboarded, markOnboarded]);

  // Keep the server's timezone in step with the phone (Architecture §7).
  useEffect(() => {
    const fresh = meQuery.data;
    if (!fresh || tzChecked.current === fresh.id) return;
    tzChecked.current = fresh.id;
    const tz = deviceTimeZone();
    if (tz && tz !== fresh.timezone) {
      endpoints
        .updateMe({ timezone: tz })
        .then(setMe)
        .catch(() => {
          tzChecked.current = null;
        });
    }
  }, [meQuery.data, setMe]);

  useEffect(() => {
    if (!userId || !onboarded || pushRegistered.current === userId) return;
    pushRegistered.current = userId;
    registerPushToken().catch(() => {
      pushRegistered.current = null;
    });
  }, [userId, onboarded]);

  const signOut = useCallback(async () => {
    if (signingOut.current) return;
    signingOut.current = true;
    try {
      await unregisterPushToken();
      setSignedIn(false);
      try {
        await authClient.signOut();
      } catch {
        // Clear the local session even if the server can't be reached.
      }
      await signOutGoogle();
      await clearReminders();
      await clearLocalData();
      removePref('onboardedUserId');
      removePref('pendingInvite');
      setPendingInviteState(null);
      setPendingRoute(null);
      pushRegistered.current = null;
      tzChecked.current = null;
      resetAnalytics();
      queryClient.clear();
      await session.refetch();
    } finally {
      signingOut.current = false;
    }
  }, [queryClient, session]);

  // The API said our session is gone (expired, revoked, account deleted).
  useEffect(
    () =>
      appEvents.on('unauthorized', () => {
        if (userId) signOut().catch(() => undefined);
      }),
    [userId, signOut],
  );

  const setPendingInvite = useCallback((code: string | null) => {
    if (code) setPref('pendingInvite', code);
    else removePref('pendingInvite');
    setPendingInviteState(code);
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      status: effectiveStatus,
      userId,
      me,
      meError,
      onboarded,
      pendingRoute,
      pendingInvite,
      setMe,
      retryMe: () => {
        void meQuery.refetch();
      },
      completeOnboarding: (route) => {
        if (route) setPendingRoute(route);
        markOnboarded();
      },
      clearPendingRoute: () => setPendingRoute(null),
      setPendingInvite,
      signOut,
    }),
    [
      effectiveStatus,
      userId,
      me,
      meError,
      onboarded,
      pendingRoute,
      pendingInvite,
      setMe,
      meQuery,
      markOnboarded,
      setPendingInvite,
      signOut,
    ],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
