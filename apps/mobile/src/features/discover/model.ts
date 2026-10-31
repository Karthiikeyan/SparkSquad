import { compareLocalDates, type Category, type SquadPreviewDTO } from '@sparksquad/shared';
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

export function defaultCategory(interests: readonly string[]): Category {
  const first = interests[0];
  return first === 'fitness' || first === 'learning' ? first : 'career';
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
