import {
  limitsFor,
  type Category,
  type ChallengeDTO,
  type SquadPreviewDTO,
} from '@sparksquad/shared';
import { useQueries, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import {
  CheckCircle2,
  ChevronRight,
  Clock,
  Compass,
  Flame,
  Moon,
  RotateCw,
  UserPlus,
  Users,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import {
  AvatarRing,
  Button,
  EmptyState,
  ErrorState,
  ProgressBar,
  Pressable,
  Screen,
  SectionLabel,
  SkeletonCard,
  Text,
  type RingMember,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { CATEGORY_ICON } from '../../../lib/categories';
import { formatLocalDate } from '../../../lib/format';
import { useOnline } from '../../../lib/hooks/useOnline';
import { qk } from '../../../lib/query/keys';
import { useLocalQuery } from '../../../lib/query/useLocalQuery';
import { parseJson } from '../../../lib/db/helpers';
import { challenges, streaks } from '../../../lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { colors, fonts, iconStroke, radius } from '../../../theme/tokens';
import { useMe } from '../../auth/SessionProvider';
import { SquadList } from '../../discover/parts';
import { useRefresh } from '../../system/useRefresh';
import { todayFor } from '../../today/model';
import { buildBoard, canManage } from '../model';
import { readMySquadIds, readSquadSource } from '../source';

type MyState = 'done' | 'missed' | 'pending' | 'rest' | null;

interface Row {
  id: string;
  name: string;
  category: Category;
  line: string;
  challengeId: string | null;
  running: boolean;
  /** The last challenge is over and nothing new has started. */
  ended: boolean;
  dayNumber: number;
  duration: number;
  checked: number;
  total: number;
  ring: RingMember[];
  mine: MyState;
  /** My streak in this squad's challenge (0 when none). */
  streak: number;
  role: 'owner' | 'admin' | 'member' | null;
  manages: boolean;
  privacy: 'public' | 'private';
}

/** C1: one card per squad with today's progress and my status, then room-to-grow suggestions. */
export function MySquadsScreen() {
  const me = useMe();
  const online = useOnline();
  const { refreshing, onRefresh } = useRefresh();
  const list = useLocalQuery([...qk.squads, me.id, me.timezone], async (db) => {
    const now = new Date();
    const rows: Row[] = [];
    for (const id of await readMySquadIds(db)) {
      const src = await readSquadSource(db, me, id, now);
      if (!src) continue;
      const board = buildBoard(src, now);
      const ch = src.challenge;
      const running = board.state === 'running';
      const endedRows = ch
        ? []
        : await db
            .select()
            .from(challenges)
            .where(and(eq(challenges.squadId, id), eq(challenges.status, 'ended')))
            .all();
      const lastEnded = endedRows
        .map((r) => parseJson<ChallengeDTO | null>(r.data, null))
        .filter((c): c is ChallengeDTO => c !== null)
        .sort((a, b) => b.startDate.localeCompare(a.startDate))[0];
      const endedTitle = board.state === 'finished' ? ch?.title : lastEnded?.title;
      const line = endedTitle
        ? t('squads.ended', { title: endedTitle })
        : !ch
          ? t('squads.noChallenge')
          : board.state === 'upcoming'
            ? t('squads.startsOn', { title: ch.title, date: formatLocalDate(ch.startDate) })
            : t('squads.dayOf', { title: ch.title, n: board.dayNumber, total: ch.durationDays });
      const myCheckin = src.checkins.find((c) => c.userId === me.id && c.localDate === board.today);
      const mine: MyState = !running
        ? null
        : myCheckin
          ? myCheckin.status === 'honest_miss'
            ? 'missed'
            : 'done'
          : board.day?.rest
            ? 'rest'
            : 'pending';
      const streakRow = ch
        ? await db.select().from(streaks).where(eq(streaks.scope, ch.id)).get()
        : undefined;
      rows.push({
        id,
        name: src.squad.name,
        category: src.squad.category,
        line,
        challengeId: ch?.id ?? null,
        running,
        ended: !!endedTitle,
        dayNumber: board.dayNumber,
        duration: ch?.durationDays ?? 0,
        checked: board.checkedCount,
        total: src.members.length,
        ring: board.grid.map((m) => ({
          id: m.id,
          name: m.name,
          avatarColor: m.avatarColor,
          checked: m.checked,
        })),
        mine,
        streak: streakRow?.current ?? 0,
        role: src.myRole,
        manages: canManage(src.myRole),
        privacy: src.squad.privacy,
      });
    }
    // Squads still waiting on me first, then by name.
    const rank = (r: Row) => (r.mine === 'pending' ? 0 : 1);
    return rows.sort((a, b) => rank(a) - rank(b) || a.name.localeCompare(b.name));
  });

  const managed = (list.data ?? []).filter((r) => r.manages && r.privacy === 'private');
  const requests = useQueries({
    queries: managed.map((r) => ({
      queryKey: ['requests', r.id],
      queryFn: () => endpoints.squadRequests(r.id),
      enabled: online,
      staleTime: 60_000,
    })),
  });
  const waiting = managed
    .map((r, i) => ({ row: r, n: requests[i]?.data?.requests.length ?? 0 }))
    .filter((x) => x.n > 0);

  const limit = limitsFor(me.plan).squadsJoined;
  const count = list.data?.length ?? 0;
  const hasRoom = count < limit;

  const actions = (
    <View style={styles.actions}>
      <Button
        label={t('squads.start')}
        onPress={() => router.push('/create/basics')}
        style={styles.flex}
      />
      <Button
        label={t('squads.join')}
        variant="secondary"
        onPress={() => router.push('/join')}
        style={styles.flex}
      />
    </View>
  );

  let body;
  if (list.isPending) body = <SkeletonCard />;
  else if (list.isError) body = <ErrorState onRetry={() => void list.refetch()} />;
  else if (list.data.length === 0)
    body = (
      <>
        <EmptyState
          icon={Users}
          message={t('empty.squads')}
          actionLabel={t('squads.join')}
          onAction={() => router.push('/join')}
          secondaryLabel={t('squads.start')}
          onSecondary={() => router.push('/create/basics')}
        />
        {online ? <Suggestions interests={me.interests} /> : null}
      </>
    );
  else
    body = (
      <>
        <View style={styles.top}>{actions}</View>
        <View style={styles.cards}>
          {list.data.map((r) => (
            <SquadCard key={r.id} r={r} />
          ))}
        </View>
        <Text variant="footnote" color="label2" style={styles.slots}>
          {t('squads.slots', { n: count, limit })}
        </Text>
        {waiting.length > 0 ? (
          <View style={styles.block}>
            <SectionLabel>{t('squads.requests')}</SectionLabel>
            <View style={styles.group}>
              {waiting.map(({ row, n }, i) => (
                <Pressable
                  key={row.id}
                  noScale
                  onPress={() =>
                    router.push({ pathname: '/squad/[id]/requests', params: { id: row.id } })
                  }
                  accessibilityRole="button"
                  style={[styles.reqRow, i > 0 && styles.separator]}
                >
                  <Text variant="body" style={styles.flex}>
                    {t('squads.requestsRow', { squad: row.name, n })}
                  </Text>
                  <ChevronRight size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
        {hasRoom && online ? (
          <Suggestions interests={me.interests} exclude={list.data.map((r) => r.id)} />
        ) : null}
      </>
    );

  return (
    <Screen title={t('squads.title')} withTabBar refreshing={refreshing} onRefresh={onRefresh}>
      {body}
    </Screen>
  );
}

function StatusPill({ r }: { r: Row }) {
  if (r.mine === 'pending') {
    const challengeId = r.challengeId;
    if (!challengeId) return null;
    return (
      <Button
        label={t('squads.checkIn')}
        size="sm"
        onPress={() => router.push({ pathname: '/checkin/[challengeId]', params: { challengeId } })}
        accessibilityLabel={`${t('squads.checkIn')}, ${r.name}`}
      />
    );
  }
  if (!r.mine) return null;
  const map = {
    done: { icon: CheckCircle2, color: colors.success, label: t('squads.youDone') },
    missed: { icon: Clock, color: colors.label2, label: t('squads.youMissed') },
    rest: { icon: Moon, color: colors.label2, label: t('squads.youRest') },
  } as const;
  const s = map[r.mine];
  const Icon = s.icon;
  return (
    <View style={styles.pill}>
      <Icon size={15} color={s.color} strokeWidth={iconStroke} />
      <Text variant="footnote" style={{ color: s.color }}>
        {s.label}
      </Text>
    </View>
  );
}

function SquadCard({ r }: { r: Row }) {
  const Icon = CATEGORY_ICON[r.category];
  const roleLabel =
    r.role === 'owner' ? t('squads.roleOwner') : r.role === 'admin' ? t('squads.roleAdmin') : null;
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/squad/[id]', params: { id: r.id } })}
      accessibilityRole="button"
      accessibilityLabel={`${r.name}, ${r.line}${
        r.running ? `, ${t('squads.checkedToday', { n: r.checked, total: r.total })}` : ''
      }`}
      style={styles.card}
      testID={`squad-${r.id}`}
    >
      <View style={styles.cardHead}>
        <View style={styles.icon}>
          <Icon size={20} color={colors.accent} strokeWidth={iconStroke} />
        </View>
        <View style={styles.texts}>
          <View style={styles.nameRow}>
            <Text style={styles.name} numberOfLines={1}>
              {r.name}
            </Text>
            {roleLabel ? (
              <View style={styles.role}>
                <Text variant="caption" color="label2">
                  {roleLabel}
                </Text>
              </View>
            ) : null}
          </View>
          <Text variant="footnote" color="label2" numberOfLines={1}>
            {r.line}
          </Text>
        </View>
        {r.streak > 0 ? (
          <View
            style={styles.streak}
            accessible
            accessibilityLabel={t('squads.streakLabel', { n: r.streak })}
          >
            <Flame size={16} color={colors.accent} strokeWidth={iconStroke} />
            <Text variant="bodySemibold" color="accent" tabular>
              {r.streak}
            </Text>
          </View>
        ) : null}
        <ChevronRight size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
      </View>

      {r.running ? (
        <>
          <ProgressBar
            value={r.duration ? r.dayNumber / r.duration : 0}
            accessibilityLabel={t('squads.progress')}
          />
          <View style={styles.cardFoot}>
            <View style={styles.today}>
              <AvatarRing
                members={r.ring}
                max={5}
                accessibilityLabel={t('squads.checkedToday', { n: r.checked, total: r.total })}
              />
              <Text variant="footnote" color="label2" numberOfLines={1} style={styles.flex}>
                {t('squads.checkedToday', { n: r.checked, total: r.total })}
              </Text>
            </View>
            <StatusPill r={r} />
          </View>
        </>
      ) : null}

      {r.ended ? (
        <View style={styles.solo}>
          {r.manages ? (
            <Button
              label={t('squads.nextChallenge')}
              size="md"
              icon={<RotateCw size={16} color={colors.onAccent} strokeWidth={iconStroke} />}
              accessibilityLabel={`${t('squads.nextChallenge')}, ${r.name}`}
              onPress={() => router.push({ pathname: '/create/plan', params: { squadId: r.id } })}
              style={styles.flex}
              testID={`next-challenge-${r.id}`}
            />
          ) : (
            <Text variant="footnote" color="label2" style={styles.flex}>
              {t('squads.nextWaiting')}
            </Text>
          )}
        </View>
      ) : null}

      {r.total === 1 && r.manages ? (
        <View style={styles.solo}>
          <Text variant="footnote" color="label2" style={styles.flex}>
            {t('squads.soloHint')}
          </Text>
          <Button
            label={t('squads.invite')}
            variant="soft"
            size="sm"
            icon={<UserPlus size={16} color={colors.accent} strokeWidth={iconStroke} />}
            accessibilityLabel={`${t('squads.invite')}, ${r.name}`}
            onPress={() => router.push({ pathname: '/squad/[id]/invite', params: { id: r.id } })}
            testID={`invite-${r.id}`}
          />
        </View>
      ) : null}
    </Pressable>
  );
}

/** Popular public squads in my interests that I'm not in yet. */
function Suggestions({
  interests,
  exclude = [],
}: {
  interests: readonly string[];
  exclude?: readonly string[];
}) {
  const me = useMe();
  const q = useQuery({
    queryKey: qk.discover(undefined, undefined, 'popular'),
    queryFn: () => endpoints.discover({ sort: 'popular' }),
    staleTime: 5 * 60_000,
  });
  const today = todayFor(me, new Date());
  const mine = (s: SquadPreviewDTO) => (interests.includes(s.category) ? 0 : 1);
  const items: SquadPreviewDTO[] = (q.data?.squads ?? [])
    .filter((s) => !exclude.includes(s.id) && !s.myStatus)
    .sort((a, b) => mine(a) - mine(b))
    .slice(0, 3);
  const topics = interests
    .slice(0, 2)
    .map((i) => t(`categories.${i as Category}`))
    .join(', ');
  return (
    <View style={styles.block}>
      <View style={styles.suggestHead}>
        <View style={styles.texts}>
          <Text variant="headline" accessibilityRole="header">
            {t('squads.findMore')}
          </Text>
          <Text variant="footnote" color="label2">
            {topics ? t('squads.findMoreBody', { topics }) : t('squads.findMoreAny')}
          </Text>
        </View>
      </View>
      {items.length > 0 ? <SquadList squads={items} today={today} /> : null}
      <Button
        label={t('squads.browse')}
        variant="soft"
        size="md"
        icon={<Compass size={18} color={colors.accent} strokeWidth={iconStroke} />}
        onPress={() => router.push('/discover')}
        style={styles.browse}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  actions: { flexDirection: 'row', gap: 10 },
  top: { marginBottom: 16 },
  cards: { gap: 12 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    gap: 14,
  },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: {
    fontFamily: fonts.displaySemibold,
    fontSize: 19,
    lineHeight: 24,
    color: colors.label,
    flexShrink: 1,
  },
  role: {
    backgroundColor: colors.control,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  cardFoot: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 34 },
  today: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 0 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  streak: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  solo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    paddingTop: 12,
  },
  slots: { marginTop: 10, marginHorizontal: 4 },
  block: { marginTop: 24 },
  group: { backgroundColor: colors.surface, borderRadius: radius.listLarge, paddingHorizontal: 16 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  suggestHead: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    marginBottom: 10,
    marginHorizontal: 4,
  },
  browse: { marginTop: 12 },
});
