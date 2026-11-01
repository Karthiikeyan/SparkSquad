import { compareLocalDates, diffDays, type SquadPreviewDTO } from '@sparksquad/shared';
import { router } from 'expo-router';
import { t } from '../../i18n';
import { formatLocalDate } from '../../lib/format';

/** "64 of 100 joined, starts Monday 3 November" (design Discover). */
export function squadMeta(s: SquadPreviewDTO, today: string): string {
  const base = { count: s.memberCount, limit: s.memberLimit };
  if (!s.challenge) return t('discover.squadMetaNoPlan', base);
  const date = formatLocalDate(s.challenge.startDate);
  return compareLocalDates(s.challenge.startDate, today) > 0
    ? t('discover.squadMeta', { ...base, date })
    : t('discover.squadMetaRunning', { ...base, date });
}

export function squadPlanLine(s: SquadPreviewDTO): string | null {
  if (!s.challenge) return null;
  return t('discover.squadPlan', {
    title: s.challenge.title,
    tasks: t('blank.days', { n: s.challenge.durationDays }),
  });
}

/** Upcoming starts first (soonest), then running squads, then squads without a plan. */
export function sortStartingSoon(
  list: readonly SquadPreviewDTO[],
  today: string,
): SquadPreviewDTO[] {
  const rank = (s: SquadPreviewDTO) =>
    !s.challenge ? 2 : compareLocalDates(s.challenge.startDate, today) > 0 ? 0 : 1;
  return [...list].sort(
    (a, b) =>
      rank(a) - rank(b) ||
      (a.challenge && b.challenge
        ? compareLocalDates(a.challenge.startDate, b.challenge.startDate)
        : 0),
  );
}

/** Short timeline for cards: "Starts Tuesday 3 November", "Day 12 of 60", "Plan coming soon". */
export function squadTimeline(s: SquadPreviewDTO, today: string): string {
  const ch = s.challenge;
  if (!ch) return t('discover.noPlan');
  if (compareLocalDates(ch.startDate, today) > 0) {
    return t('discover.startsOn', { date: formatLocalDate(ch.startDate) });
  }
  const n = Math.min(diffDays(ch.startDate, today) + 1, ch.durationDays);
  return t('discover.runningDay', { n, total: ch.durationDays });
}

/** Join button copy: members open the squad, pending requests say so. */
export function joinLabel(s: SquadPreviewDTO): string {
  if (s.myStatus === 'active') return t('discover.open');
  if (s.myStatus === 'pending') return t('discover.requested');
  return t('discover.join');
}

export function openSquadPreview(id: string): void {
  router.push({ pathname: '/squad/[id]/preview', params: { id } });
}

export function openTemplate(slug: string): void {
  router.push({ pathname: '/create/templates/[slug]', params: { slug } });
}

const MAX_RECENT = 6;

export function addRecent(list: readonly string[], q: string): string[] {
  const value = q.trim();
  if (!value) return [...list];
  return [value, ...list.filter((x) => x.toLowerCase() !== value.toLowerCase())].slice(
    0,
    MAX_RECENT,
  );
}
