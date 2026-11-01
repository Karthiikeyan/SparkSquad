import type { TemplateSummaryDTO } from '@sparksquad/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarDays, ChevronRight, LayoutGrid, ListChecks } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  EmptyState,
  ErrorState,
  NavHeader,
  Pressable,
  Screen,
  SkeletonCard,
  Text,
} from '../../../components/ui';
import { t, tMaybe } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import { categoriesFor, CATEGORY_ICON } from '../../../lib/categories';
import { qk } from '../../../lib/query/keys';
import { colors, fonts, iconStroke, radius } from '../../../theme/tokens';
import { useMe } from '../../auth/SessionProvider';
import { CategoryFilter, type CategoryValue } from '../../discover/CategoryFilter';

export function templateMeta(
  tpl: Pick<TemplateSummaryDTO, 'durationDays' | 'tasksPerDay'>,
): string {
  return tpl.tasksPerDay === 1
    ? t('templates.metaOne', { days: tpl.durationDays })
    : t('templates.meta', { days: tpl.durationDays, tasks: tpl.tasksPerDay });
}

/** One line on what the plan is for (optional: new server templates may not have one yet). */
export function templateBlurb(slug: string): string | undefined {
  return tMaybe(`templates.blurb.${slug}`);
}

function Fact({ icon: Icon, label }: { icon: typeof CalendarDays; label: string }) {
  return (
    <View style={styles.fact}>
      <Icon size={13} color={colors.label2} strokeWidth={iconStroke} />
      <Text variant="caption" color="label2">
        {label}
      </Text>
    </View>
  );
}

/** Full-width card: what it is, what it's for, how long, how much a day. */
export function TemplateTile({ tpl, onPress }: { tpl: TemplateSummaryDTO; onPress: () => void }) {
  const Icon = CATEGORY_ICON[tpl.category];
  const blurb = templateBlurb(tpl.slug);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${tpl.title}, ${templateMeta(tpl)}`}
      style={styles.card}
      testID={`template-${tpl.slug}`}
    >
      <View style={styles.icon}>
        <Icon size={22} color={colors.accent} strokeWidth={iconStroke} />
      </View>
      <View style={styles.texts}>
        <Text style={styles.cardTitle} numberOfLines={2}>
          {tpl.title}
        </Text>
        {blurb ? (
          <Text variant="footnote" color="label2" numberOfLines={2}>
            {blurb}
          </Text>
        ) : null}
        <View style={styles.facts}>
          <Fact icon={CalendarDays} label={t('templates.days', { n: tpl.durationDays })} />
          <Fact
            icon={ListChecks}
            label={
              tpl.tasksPerDay === 1
                ? t('templates.perDayOne')
                : t('templates.perDay', { n: tpl.tasksPerDay })
            }
          />
        </View>
      </View>
      <ChevronRight size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
    </Pressable>
  );
}

/** D3: every template as a readable card, filtered by category. */
export function TemplatesScreen() {
  const me = useMe();
  const [filter, setFilter] = useState<CategoryValue>('all');
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
    const present = new Set(list.data.templates.map((x) => x.category));
    const categories = categoriesFor(me.interests).filter((c) => present.has(c));
    const shown = list.data.templates.filter((x) => filter === 'all' || x.category === filter);
    body = (
      <>
        <CategoryFilter categories={categories} value={filter} onChange={setFilter} />
        <Text variant="footnote" color="label2" style={styles.count}>
          {shown.length === 1 ? t('templates.countOne') : t('templates.count', { n: shown.length })}
        </Text>
        <View style={styles.list}>
          {shown.map((tpl) => (
            <TemplateTile
              key={tpl.slug}
              tpl={tpl}
              onPress={() =>
                router.push({ pathname: '/create/templates/[slug]', params: { slug: tpl.slug } })
              }
            />
          ))}
        </View>
      </>
    );
  }
  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('templates.title')}
      </Text>
      <Text variant="body" color="label2" style={styles.intro}>
        {t('templates.intro')}
      </Text>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4 },
  intro: { marginTop: 4, marginBottom: 16 },
  count: { marginTop: 16, marginBottom: 8, marginHorizontal: 4 },
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.surface,
    borderRadius: radius.listLarge,
    padding: 14,
  },
  icon: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0, gap: 3 },
  cardTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.label,
  },
  facts: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 4 },
  fact: { flexDirection: 'row', alignItems: 'center', gap: 4 },
});
