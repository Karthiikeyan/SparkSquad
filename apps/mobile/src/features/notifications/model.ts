import { localDateInZone, type LocalDate, type NotificationDTO } from '@sparksquad/shared';
import { t, tMaybe } from '../../i18n';

function str(payload: Record<string, unknown>, key: string): string | undefined {
  const v = payload[key];
  return typeof v === 'string' && v.trim() ? v : undefined;
}

function num(payload: Record<string, unknown>, key: string): number {
  const v = payload[key];
  return typeof v === 'number' && Number.isFinite(v) ? v : 0;
}

/** One line of inbox copy per notification kind (B8). */
export function notificationText(n: NotificationDTO): string {
  const p = n.payload;
  const squad = str(p, 'squadName') ?? t('inbox.yourSquad');
  switch (n.kind) {
    case 'nudge':
      return t('inbox.nudge', {
        name: str(p, 'fromName') ?? t('inbox.someone'),
        title: str(p, 'title') ?? '',
      });
    case 'join_request':
      return t('inbox.join_request', { name: str(p, 'name') ?? t('inbox.someone'), squad });
    case 'request_approved':
      return t('inbox.request_approved', { squad });
    case 'announcement':
      return t('inbox.announcement', { squad, body: str(p, 'body') ?? '' });
    case 'milestone':
      return t('inbox.milestone', { squad });
    case 'badge': {
      const badge = str(p, 'badge');
      return t('inbox.badge', { badge: (badge && tMaybe(`badges.${badge}`)) ?? badge ?? '' });
    }
    case 'freeze_used':
      return t('inbox.freeze_used', { n: num(p, 'streak'), title: str(p, 'title') ?? '' });
    case 'challenge_ended':
      return t('inbox.challenge_ended', {
        title: str(p, 'title') ?? '',
        done: num(p, 'daysDone'),
        elapsed: num(p, 'daysElapsed'),
      });
    case 'role_changed': {
      const role = str(p, 'role') ?? 'member';
      return t('inbox.role_changed', {
        role: tMaybe(`inbox.role_${role}`) ?? t('inbox.role_member'),
        squad,
      });
    }
    case 'digest':
    default:
      return t('inbox.digest');
  }
}

/** Where tapping a notification goes in the app. */
export function notificationRoute(n: NotificationDTO): string {
  const squadId = str(n.payload, 'squadId');
  const challengeId = str(n.payload, 'challengeId');
  if (n.kind === 'badge') return '/you';
  if (!squadId) return '/today';
  if (n.kind === 'join_request') return `/squad/${squadId}/requests`;
  if (n.kind === 'challenge_ended' && challengeId)
    return `/squad/${squadId}/history/${challengeId}`;
  if (n.kind === 'freeze_used') return '/today';
  return `/squad/${squadId}`;
}

export function groupByDay(
  list: readonly NotificationDTO[],
  today: LocalDate,
  timeZone: string,
): { today: NotificationDTO[]; earlier: NotificationDTO[] } {
  const out = { today: [] as NotificationDTO[], earlier: [] as NotificationDTO[] };
  for (const n of list) {
    const day = localDateInZone(new Date(n.createdAt), timeZone);
    (day === today ? out.today : out.earlier).push(n);
  }
  return out;
}

/**
 * B6: the "streak freeze used" note, shown once on the morning it was created.
 * `lastShown` is the local date the sheet was last dismissed.
 */
export function freezeNotice(
  list: readonly NotificationDTO[],
  today: LocalDate,
  timeZone: string,
  lastShown: LocalDate | undefined,
): NotificationDTO | null {
  if (lastShown === today) return null;
  return (
    list.find(
      (n) =>
        n.kind === 'freeze_used' &&
        !n.readAt &&
        localDateInZone(new Date(n.createdAt), timeZone) === today,
    ) ?? null
  );
}
