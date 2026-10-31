import { parsePlan } from '@sparksquad/shared';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, ErrorState, NavHeader, Screen, SkeletonCard } from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import { useMe } from '../../auth/SessionProvider';
import { todayFor } from '../../today/model';
import { PlanPreviewCard, StartDateRow } from '../components';
import { afterPlanRoute, defaultStartDate, useCreateFlow } from '../flow';

/** D4: template preview (same as import) + start date + "Use this plan". */
export function TemplateDetailScreen() {
  const { slug = '' } = useLocalSearchParams<{ slug: string }>();
  const me = useMe();
  const { flow, update } = useCreateFlow();
  const today = todayFor(me, new Date());
  const [start, setStart] = useState(flow.startDate ?? defaultStartDate(today));
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

  const use = () => {
    update({
      plan: { plan: parsed.plan, fixes: parsed.fixes, stats: parsed.stats, templateSlug: slug },
      startDate: start,
    });
    router.push(afterPlanRoute(flow));
  };

  return (
    <Screen
      header={header}
      footer={<Button label={t('templates.use')} onPress={use} testID="use-template" />}
    >
      <PlanPreviewCard plan={parsed.plan} stats={parsed.stats} fixes={parsed.fixes} />
      <View style={styles.date}>
        <StartDateRow value={start} today={today} onChange={setStart} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  date: { marginTop: 12 },
});
