import type { TemplateSummaryDTO } from '@sparksquad/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { LayoutGrid } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  NavHeader,
  Pressable,
  Screen,
  SectionLabel,
  SkeletonCard,
  Text,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import { qk } from '../../../lib/query/keys';
import { colors, fonts, radius } from '../../../theme/tokens';

export function templateMeta(
  tpl: Pick<TemplateSummaryDTO, 'durationDays' | 'tasksPerDay'>,
): string {
  return tpl.tasksPerDay === 1
    ? t('templates.metaOne', { days: tpl.durationDays })
    : t('templates.meta', { days: tpl.durationDays, tasks: tpl.tasksPerDay });
}

export function TemplateTile({ tpl, onPress }: { tpl: TemplateSummaryDTO; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tpl.title}, ${templateMeta(tpl)}`}
      style={styles.tile}
      testID={`template-${tpl.slug}`}
    >
      <Text style={styles.tileTitle}>{tpl.title}</Text>
      <Text variant="footnote" color="label2">
        {templateMeta(tpl)}
      </Text>
    </Pressable>
  );
}

/** D3: templates grid by category. */
export function TemplatesScreen() {
  const list = useQuery({
    queryKey: qk.templates,
    queryFn: endpoints.templates,
    staleTime: 60 * 60_000,
  });
  let body;
  if (list.isPending) body = <SkeletonCard />;
  else if (list.isError)
    body = <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />;
  else if (list.data.templates.length === 0)
    body = <EmptyState icon={LayoutGrid} message={t('templates.empty')} />;
  else {
    const groups = new Map<TemplateSummaryDTO['category'], TemplateSummaryDTO[]>();
    for (const tpl of list.data.templates)
      groups.set(tpl.category, [...(groups.get(tpl.category) ?? []), tpl]);
    body = [...groups.entries()].map(([category, items]) => (
      <View key={category} style={styles.section}>
        <SectionLabel>{t(`categories.${category}`)}</SectionLabel>
        <View style={styles.grid}>
          {items.map((tpl) => (
            <View key={tpl.slug} style={styles.cell}>
              <TemplateTile
                tpl={tpl}
                onPress={() =>
                  router.push({ pathname: '/create/templates/[slug]', params: { slug: tpl.slug } })
                }
              />
            </View>
          ))}
        </View>
      </View>
    ));
  }
  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('templates.title')}
      </Text>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  section: { marginBottom: 20 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { width: '50%', padding: 5 },
  tile: {
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    padding: 14,
    gap: 4,
    minHeight: 88,
  },
  tileTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 20,
    lineHeight: 24,
    color: colors.label,
  },
});
