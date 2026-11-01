import { parsePlan, type PlanTask } from '@sparksquad/shared';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { CircleCheck, Flag } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable as RNPressable, StyleSheet, View } from 'react-native';
import {
  Button,
  ErrorState,
  NavHeader,
  PhaseBar,
  Screen,
  SkeletonCard,
  Text,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import { CATEGORY_ICON } from '../../../lib/categories';
import { colors, fonts, iconStroke, radius } from '../../../theme/tokens';
import { useMe } from '../../auth/SessionProvider';
import { todayFor } from '../../today/model';
import { targetLabel } from '../../today/taskText';
import { PlanStat, StartDateRow } from '../components';
import { afterPlanRoute, defaultStartDate, useCreateFlow } from '../flow';

function Heading({ children }: { children: string }) {
  return (
    <Text variant="headline" accessibilityRole="header" style={styles.heading}>
      {children}
    </Text>
  );
}

function TaskLine({ task, first }: { task: PlanTask; first: boolean }) {
  return (
    <View style={[styles.line, !first && styles.separator]}>
      <CircleCheck size={18} color={colors.accent} strokeWidth={iconStroke} />
      <View style={styles.flex}>
        <Text variant="body">{task.title}</Text>
        <Text variant="caption" color="label2">
          {targetLabel(task)}
        </Text>
      </View>
    </View>
  );
}

/** D4: what the plan is, how it progresses, what a day looks like, then a start date and "Use". */
export function TemplateDetailScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const me = useMe();
  const { flow, update } = useCreateFlow();
  const today = todayFor(me, new Date());
  const [start, setStart] = useState(flow.startDate ?? defaultStartDate(today));
  const [allDays, setAllDays] = useState(false);
  const tpl = useQuery({
    queryKey: ['template', slug],
    queryFn: () => endpoints.template(slug),
    staleTime: Infinity,
  });
  const header = <NavHeader backLabel={t('common.back')} onBack={() => router.back()} />;

  if (tpl.isPending) {
    return (
      <Screen header={header}>
        <SkeletonCard />
      </Screen>
    );
  }
  const parsed = tpl.isError ? null : parsePlan(tpl.data);
  if (!parsed?.ok) {
    return (
      <Screen header={header}>
        <ErrorState
          message={tpl.isError ? errorMessage(tpl.error) : t('importPlan.errorTitle')}
          onRetry={() => void tpl.refetch()}
        />
      </Screen>
    );
  }

  const { plan, stats } = parsed;
  const use = () => {
    update({
      plan: { plan, fixes: parsed.fixes, stats, templateSlug: slug },
      startDate: start,
    });
    router.push(afterPlanRoute(flow));
  };
  const Icon = CATEGORY_ICON[plan.category];
  const sampleDay = plan.days.find((d) => !d.rest);

  return (
    <Screen
      header={header}
      footer={
        <View style={styles.footer}>
          <StartDateRow value={start} today={today} onChange={setStart} />
          <Button label={t('templates.use')} onPress={use} testID="use-template" />
        </View>
      }
    >
      <View style={styles.hero}>
        <View style={styles.heroIcon}>
          <Icon size={26} color={colors.accent} strokeWidth={iconStroke} />
        </View>
        <Text variant="caption" color="accent">
          {t(`categories.${plan.category}`)}
        </Text>
        <Text style={styles.title} accessibilityRole="header">
          {plan.title}
        </Text>
        {plan.goal ? (
          <Text variant="callout" color="label2">
            {plan.goal}
          </Text>
        ) : null}
        <View style={styles.stats}>
          <PlanStat value={stats.days} label={t('planPreview.days')} />
          <PlanStat value={stats.tasks} label={t('planPreview.tasks')} />
          <PlanStat value={stats.restDays} label={t('planPreview.reviewDays')} />
        </View>
      </View>

      {plan.phases.length > 0 ? (
        <>
          <Heading>{t('templates.howItGoes')}</Heading>
          <View style={styles.group}>
            {plan.phases.map((p, i) => (
              <View key={p.name} style={[styles.phase, i > 0 && styles.separator]}>
                <View style={styles.phaseHead}>
                  <Text variant="bodyMedium" style={styles.flex}>
                    {p.name}
                  </Text>
                  <Text variant="footnote" color="label2" tabular>
                    {t('templates.dayRange', { from: p.from_day, to: p.to_day })}
                  </Text>
                </View>
                <PhaseBar total={plan.phases.length} current={i + 1} progress={1} />
              </View>
            ))}
          </View>
        </>
      ) : null}

      {sampleDay ? (
        <>
          <Heading>{t('templates.dayLooksLike', { n: sampleDay.day })}</Heading>
          <View style={styles.group}>
            {sampleDay.tasks.map((task, i) => (
              <TaskLine key={task.id} task={task} first={i === 0} />
            ))}
          </View>
        </>
      ) : null}

      {plan.milestones.length > 0 ? (
        <>
          <Heading>{t('templates.milestones')}</Heading>
          <View style={styles.group}>
            {plan.milestones.map((m, i) => (
              <View key={m.day} style={[styles.line, i > 0 && styles.separator]}>
                <Flag size={18} color={colors.accent} strokeWidth={iconStroke} />
                <Text variant="body" style={styles.flex}>
                  {m.title}
                </Text>
                <Text variant="footnote" color="label2" tabular>
                  {t('planPreview.dayRow', { n: m.day })}
                </Text>
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Heading>{t('templates.everyDay')}</Heading>
      <View style={styles.group}>
        {(allDays ? plan.days : plan.days.slice(0, 5)).map((d, i) => (
          <View key={d.day} style={[styles.line, i > 0 && styles.separator]}>
            <Text variant="footnote" color="label2" style={styles.dayNumber} tabular>
              {String(d.day)}
            </Text>
            <Text variant="body" style={styles.flex} numberOfLines={1}>
              {d.rest ? t('planPreview.rest') : d.title}
            </Text>
          </View>
        ))}
        {plan.days.length > 5 ? (
          <RNPressable
            onPress={() => setAllDays((v) => !v)}
            accessibilityRole="button"
            style={[styles.seeAll, styles.separator]}
          >
            <Text variant="body" color="accent">
              {allDays
                ? t('planPreview.seeLess')
                : t('planPreview.seeAll', { n: plan.days.length })}
            </Text>
          </RNPressable>
        ) : null}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  footer: { gap: 8 },
  hero: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 6 },
  heroIcon: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 6,
  },
  title: { fontFamily: fonts.display, fontSize: 28, lineHeight: 33, color: colors.label },
  stats: { flexDirection: 'row', gap: 8, marginTop: 10 },
  heading: { marginTop: 20, marginBottom: 8, marginHorizontal: 4 },
  group: { backgroundColor: colors.surface, borderRadius: radius.list, paddingHorizontal: 14 },
  phase: { paddingVertical: 12, gap: 8 },
  phaseHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  line: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  dayNumber: { width: 22, textAlign: 'right' },
  seeAll: { minHeight: 44, justifyContent: 'center' },
});
