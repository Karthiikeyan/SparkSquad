import type { Category, DiscoverSort, SquadPreviewDTO } from '@sparksquad/shared';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Compass, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  Pressable,
  Screen,
  SegmentedControl,
  SkeletonCard,
  Text,
} from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/errors';
import { CATEGORY_ICON, categoriesFor } from '../../lib/categories';
import { qk } from '../../lib/query/keys';
import { colors, iconStroke, radius } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';
import { useRefresh } from '../system/useRefresh';
import { todayFor } from '../today/model';
import { CategoryFilter, type CategoryValue } from './CategoryFilter';
import { SquadList, SquadRail, StartSquadCard, TemplateGrid, TemplateRail } from './parts';

const SORTS: readonly { value: DiscoverSort; label: () => string }[] = [
  { value: 'popular', label: () => t('discover.sortPopular') },
  { value: 'soon', label: () => t('discover.sortSoon') },
  { value: 'new', label: () => t('discover.sortNew') },
];

function SectionHead({
  title,
  action,
}: {
  title: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.sectionHead}>
      <Text variant="headline" accessibilityRole="header">
        {title}
      </Text>
      {action ? (
        <Button label={action.label} variant="ghost" size="sm" onPress={action.onPress} />
      ) : null}
    </View>
  );
}

/** E1: search, a one-row category filter, curated sections, then templates and Start a squad. */
export function DiscoverScreen() {
  const me = useMe();
  const today = todayFor(me, new Date());
  const [filter, setFilter] = useState<CategoryValue>('all');
  const [sort, setSort] = useState<DiscoverSort>('popular');
  const { refreshing, onRefresh } = useRefresh();
  const chips = useMemo(() => categoriesFor(me.interests), [me.interests]);

  return (
    <Screen title={t('discover.title')} withTabBar refreshing={refreshing} onRefresh={onRefresh}>
      <Pressable
        noScale
        onPress={() => router.push('/discover/search')}
        accessibilityRole="search"
        accessibilityLabel={t('discover.search')}
        style={styles.search}
        testID="discover-search"
      >
        <Search size={18} color={colors.label3} strokeWidth={iconStroke} />
        <Text variant="body" color="label3">
          {t('discover.search')}
        </Text>
      </Pressable>
      <CategoryFilter
        categories={chips}
        value={filter}
        onChange={setFilter}
        active={sort !== 'popular'}
        extra={
          <View style={styles.sortBlock}>
            <Text variant="footnote" color="label2" style={styles.sortLabel}>
              {t('discover.sort')}
            </Text>
            <SegmentedControl
              options={SORTS.map((s) => ({ value: s.value, label: s.label() }))}
              value={sort}
              onChange={setSort}
              role="radiogroup"
              accessibilityLabel={t('discover.sort')}
            />
          </View>
        }
      />
      {filter === 'all' && sort === 'popular' ? (
        <AllSections today={today} />
      ) : (
        <FilteredList category={filter === 'all' ? undefined : filter} sort={sort} today={today} />
      )}
      <StartSquadCard />
    </Screen>
  );
}

function useDiscover(category: Category | undefined, sort: DiscoverSort) {
  return useQuery({
    queryKey: qk.discover(category, undefined, sort),
    queryFn: () => endpoints.discover({ category, sort }),
    staleTime: 5 * 60_000,
  });
}

/** "All": popular rail, starting soon, templates, newest. Sections without squads are skipped. */
function AllSections({ today }: { today: string }) {
  const popular = useDiscover(undefined, 'popular');
  const soon = useDiscover(undefined, 'soon');
  const fresh = useDiscover(undefined, 'new');

  if (popular.isPending) return <SkeletonCard />;
  if (popular.isError) {
    return (
      <ErrorState message={errorMessage(popular.error)} onRetry={() => void popular.refetch()} />
    );
  }
  const popularList = popular.data.squads.slice(0, 8);
  const shown = new Set(popularList.map((s) => s.id));
  const soonList = (soon.data?.squads ?? []).filter((s) => !shown.has(s.id)).slice(0, 5);
  soonList.forEach((s) => shown.add(s.id));
  const freshList = (fresh.data?.squads ?? []).filter((s) => !shown.has(s.id)).slice(0, 5);
  const templates = popular.data.templates;

  return (
    <>
      {popularList.length > 0 ? (
        <>
          <SectionHead title={t('discover.popular')} />
          <SquadRail squads={popularList} today={today} />
        </>
      ) : (
        <EmptyState
          icon={Compass}
          message={t('discover.noSquads')}
          actionLabel={t('discover.startSquad')}
          onAction={() => router.push('/create/basics')}
        />
      )}
      {soonList.length > 0 ? (
        <>
          <SectionHead title={t('discover.startingSoon')} />
          <SquadList squads={soonList} today={today} />
        </>
      ) : null}
      {templates.length > 0 ? (
        <>
          <SectionHead
            title={t('discover.templates')}
            action={{
              label: t('discover.seeAll'),
              onPress: () => router.push('/create/templates'),
            }}
          />
          <TemplateRail templates={templates} />
        </>
      ) : null}
      {freshList.length > 0 ? (
        <>
          <SectionHead title={t('discover.newSquads')} />
          <SquadList squads={freshList} today={today} />
        </>
      ) : null}
    </>
  );
}

/** A category or a sort choice: the full paged list, then matching templates. */
function FilteredList({
  category,
  sort,
  today,
}: {
  category: Category | undefined;
  sort: DiscoverSort;
  today: string;
}) {
  const list = useInfiniteQuery({
    queryKey: [...qk.discover(category, undefined, sort), 'paged'],
    queryFn: ({ pageParam }) => endpoints.discover({ category, sort, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 5 * 60_000,
  });
  const squads: SquadPreviewDTO[] = list.data?.pages.flatMap((p) => p.squads) ?? [];
  const templates = list.data?.pages[0]?.templates ?? [];

  let body;
  if (list.isPending) body = <SkeletonCard />;
  else if (list.isError)
    body = <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />;
  else
    body = (
      <>
        {squads.length ? (
          <SquadList squads={squads} today={today} />
        ) : (
          <EmptyState
            icon={category ? CATEGORY_ICON[category] : Compass}
            message={t('discover.noSquads')}
          />
        )}
        {list.hasNextPage ? (
          <Button
            label={t('discover.loadMore')}
            variant="ghost"
            size="md"
            loading={list.isFetchingNextPage}
            onPress={() => void list.fetchNextPage()}
          />
        ) : null}
        {templates.length > 0 ? (
          <>
            <SectionHead title={t('discover.templates')} />
            <TemplateGrid templates={templates} />
          </>
        ) : null}
      </>
    );

  return (
    <>
      <Text variant="footnote" color="label2" style={styles.sortedBy}>
        {t('discover.sortedBy', { sort: SORTS.find((s) => s.value === sort)?.label() ?? '' })}
      </Text>
      {body}
    </>
  );
}

const styles = StyleSheet.create({
  search: {
    minHeight: 44,
    borderRadius: radius.button,
    backgroundColor: colors.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  sortBlock: { marginTop: 14 },
  sortLabel: { marginBottom: 8 },
  sortedBy: { marginTop: 14, marginBottom: 8, marginHorizontal: 4 },
  sectionHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 34,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 4,
  },
});
