import { CATEGORIES, type Category } from '@sparksquad/shared';
import { useInfiniteQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { Compass, Search } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  ChipToggle,
  EmptyState,
  ErrorState,
  Pressable,
  Screen,
  SkeletonCard,
  Text,
} from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/errors';
import { qk } from '../../lib/query/keys';
import { colors, iconStroke, radius } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';
import { useRefresh } from '../system/useRefresh';
import { todayFor } from '../today/model';
import { defaultCategory, sortStartingSoon } from './model';
import { SquadList, TemplateGrid } from './parts';

const SHOWN = CATEGORIES.filter((c) => c !== 'other');

/** E1: search, category chips, squads starting soon (Join), plan templates, start a squad. */
export function DiscoverScreen() {
  const me = useMe();
  const today = todayFor(me, new Date());
  const [category, setCategory] = useState<Category>(defaultCategory(me.interests));
  const { refreshing, onRefresh } = useRefresh();
  const list = useInfiniteQuery({
    queryKey: qk.discover(category, undefined),
    queryFn: ({ pageParam }) => endpoints.discover({ category, cursor: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    staleTime: 5 * 60_000,
  });

  const squads = sortStartingSoon(list.data?.pages.flatMap((p) => p.squads) ?? [], today);
  const templates = list.data?.pages[0]?.templates ?? [];

  let body;
  if (list.isPending) body = <SkeletonCard />;
  else if (list.isError)
    body = <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />;
  else
    body = (
      <>
        <Text variant="headline" style={styles.heading} accessibilityRole="header">
          {t('discover.startingSoon')}
        </Text>
        {squads.length ? (
          <SquadList squads={squads} today={today} />
        ) : (
          <EmptyState
            icon={Compass}
            message={t('discover.noSquads')}
            actionLabel={t('discover.startSquad')}
            onAction={() => router.push('/create/basics')}
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
        <View style={styles.templatesHead}>
          <Text variant="headline" accessibilityRole="header">
            {t('discover.templates')}
          </Text>
          <Button
            label={t('discover.startSquad')}
            variant="ghost"
            size="sm"
            onPress={() => router.push('/create/basics')}
          />
        </View>
        <TemplateGrid templates={templates} />
      </>
    );

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
      <View
        style={styles.chips}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('discover.categories')}
      >
        {SHOWN.map((c) => (
          <ChipToggle
            key={c}
            label={t(`categories.${c}`)}
            role="radio"
            selected={category === c}
            onPress={() => setCategory(c)}
          />
        ))}
      </View>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: {
    height: 40,
    borderRadius: radius.button,
    backgroundColor: colors.control,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    marginBottom: 12,
  },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  heading: { marginHorizontal: 4, marginBottom: 8 },
  templatesHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 4,
    marginHorizontal: 4,
  },
});
