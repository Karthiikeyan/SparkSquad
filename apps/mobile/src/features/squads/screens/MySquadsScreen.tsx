import { useQueries } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ChevronRight, Users } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  CountRing,
  EmptyState,
  ErrorState,
  Pressable,
  Screen,
  SectionLabel,
  SkeletonCard,
  Text,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { formatLocalDate } from '../../../lib/format';
import { useOnline } from '../../../lib/hooks/useOnline';
import { qk } from '../../../lib/query/keys';
import { useLocalQuery } from '../../../lib/query/useLocalQuery';
import { colors, iconStroke, radius } from '../../../theme/tokens';
import { useMe } from '../../auth/SessionProvider';
import { useRefresh } from '../../system/useRefresh';
import { buildBoard, canManage } from '../model';
import { readMySquadIds, readSquadSource } from '../source';

interface Row {
  id: string;
  name: string;
  line: string;
  checked: number;
  total: number;
  showRing: boolean;
  manages: boolean;
  privacy: 'public' | 'private';
}

/** C1: my squads with today's count ring, start/join buttons and requests to review. */
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
      const line = !ch
        ? t('squads.noChallenge')
        : board.state === 'upcoming'
          ? t('squads.startsOn', { title: ch.title, date: formatLocalDate(ch.startDate) })
          : t('squads.dayOf', { title: ch.title, n: board.dayNumber, total: ch.durationDays });
      rows.push({
        id,
        name: src.squad.name,
        line,
        checked: board.checkedCount,
        total: src.members.length,
        showRing: board.state === 'running',
        manages: canManage(src.myRole),
        privacy: src.squad.privacy,
      });
    }
    return rows.sort((a, b) => a.name.localeCompare(b.name));
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
      <EmptyState
        icon={Users}
        message={t('empty.squads')}
        actionLabel={t('squads.join')}
        onAction={() => router.push('/join')}
        secondaryLabel={t('squads.start')}
        onSecondary={() => router.push('/create/basics')}
      />
    );
  else
    body = (
      <>
        {actions}
        <View style={styles.group}>
          {list.data.map((r, i) => (
            <Pressable
              key={r.id}
              noScale
              onPress={() => router.push({ pathname: '/squad/[id]', params: { id: r.id } })}
              accessibilityRole="button"
              accessibilityLabel={`${r.name}, ${r.line}${
                r.showRing ? `, ${t('squads.checkedToday', { n: r.checked, total: r.total })}` : ''
              }`}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.separator,
                pressed && styles.pressed,
              ]}
              testID={`squad-${r.id}`}
            >
              <View style={styles.texts}>
                <Text variant="headline" numberOfLines={1}>
                  {r.name}
                </Text>
                <Text variant="footnote" color="label2" numberOfLines={1}>
                  {r.line}
                </Text>
              </View>
              {r.showRing ? (
                <CountRing
                  value={r.checked}
                  total={r.total}
                  accessibilityLabel={t('squads.checkedToday', { n: r.checked, total: r.total })}
                />
              ) : null}
              <ChevronRight size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
            </Pressable>
          ))}
        </View>
        {waiting.length > 0 ? (
          <View style={styles.requests}>
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
                  style={[styles.row, styles.rowShort, i > 0 && styles.separator]}
                >
                  <Text variant="body" style={styles.texts}>
                    {t('squads.requestsRow', { squad: row.name, n })}
                  </Text>
                  <ChevronRight size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}
      </>
    );

  return (
    <Screen title={t('squads.title')} withTabBar refreshing={refreshing} onRefresh={onRefresh}>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  flex: { flex: 1 },
  group: { backgroundColor: colors.surface, borderRadius: radius.listLarge, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 72, paddingVertical: 10 },
  rowShort: { minHeight: 52 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  pressed: { opacity: 0.7 },
  texts: { flex: 1, gap: 2, minWidth: 0 },
  requests: { marginTop: 24 },
});
