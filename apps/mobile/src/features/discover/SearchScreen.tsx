import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  ErrorState,
  GroupedList,
  ListRow,
  NavHeader,
  Screen,
  SearchField,
  SkeletonCard,
  Text,
} from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/errors';
import { getPref, setPref } from '../../lib/prefs';
import { qk } from '../../lib/query/keys';
import { useMe } from '../auth/SessionProvider';
import { todayFor } from '../today/model';
import { addRecent } from './model';
import { SquadList, TemplateGrid } from './parts';

function useDebounced(value: string, ms = 300): string {
  const [v, setV] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setV(value), ms);
    return () => clearTimeout(timer);
  }, [value, ms]);
  return v;
}

/** E2: squads and templates matching a query; recent searches when empty. */
export function SearchScreen() {
  const me = useMe();
  const today = todayFor(me, new Date());
  const [q, setQ] = useState('');
  const [recent, setRecent] = useState<string[]>(() => getPref('recentSearches') ?? []);
  const query = useDebounced(q.trim());
  const results = useQuery({
    queryKey: qk.discover(undefined, query),
    queryFn: () => endpoints.discover({ q: query }),
    enabled: query.length >= 2,
    staleTime: 60_000,
  });

  const remember = (value: string) => {
    const next = addRecent(recent, value);
    setRecent(next);
    setPref('recentSearches', next);
  };

  let body;
  if (query.length < 2) {
    body = recent.length ? (
      <>
        <View style={styles.recentHead}>
          <Text variant="footnote" color="label2">
            {t('discover.recent')}
          </Text>
          <Button
            label={t('discover.clearRecent')}
            variant="ghost"
            size="sm"
            onPress={() => {
              setRecent([]);
              setPref('recentSearches', []);
            }}
          />
        </View>
        <GroupedList>
          {recent.map((r) => (
            <ListRow key={r} title={r} chevron onPress={() => setQ(r)} />
          ))}
        </GroupedList>
      </>
    ) : null;
  } else if (results.isPending) body = <SkeletonCard />;
  else if (results.isError)
    body = (
      <ErrorState message={errorMessage(results.error)} onRetry={() => void results.refetch()} />
    );
  else if (!results.data.squads.length && !results.data.templates.length)
    body = (
      <Text variant="body" color="label2" accessibilityLiveRegion="polite">
        {t('discover.noResults', { q: query })}
      </Text>
    );
  else
    body = (
      <>
        {results.data.squads.length ? (
          <View style={styles.section}>
            <Text variant="headline" style={styles.heading}>
              {t('discover.results')}
            </Text>
            <SquadList squads={results.data.squads} today={today} />
          </View>
        ) : null}
        {results.data.templates.length ? (
          <View style={styles.section}>
            <Text variant="headline" style={styles.heading}>
              {t('discover.templates')}
            </Text>
            <TemplateGrid templates={results.data.templates} />
          </View>
        ) : null}
      </>
    );

  return (
    <Screen header={<NavHeader backLabel={t('discover.title')} onBack={() => router.back()} />}>
      <SearchField
        accessibilityLabel={t('discover.search')}
        placeholder={t('discover.search')}
        value={q}
        onChangeText={setQ}
        onSubmitEditing={() => remember(q)}
        autoFocus
        containerStyle={styles.search}
        testID="search-input"
      />
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  search: { marginBottom: 16 },
  recentHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginHorizontal: 4,
  },
  section: { marginBottom: 20 },
  heading: { marginHorizontal: 4, marginBottom: 8 },
});
