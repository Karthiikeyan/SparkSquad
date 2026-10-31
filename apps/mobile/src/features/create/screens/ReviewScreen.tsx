import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Button, Card, NavHeader, Screen, Text, useToast } from '../../../components/ui';
import { openPaywallFor } from '../../billing/paywallRoute';
import { t } from '../../../i18n';
import { track } from '../../../lib/analytics';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import { formatLocalDate } from '../../../lib/format';
import { refresh } from '../../../lib/runtime';
import { useMe } from '../../auth/SessionProvider';
import { todayFor } from '../../today/model';
import { CreateHeader, StartDateRow } from '../components';
import { clampStartDate, defaultStartDate, useCreateFlow } from '../flow';

/** D10: Step 3 of 3. Summary (squad + challenge + start date) → create squad, then the challenge. */
export function ReviewScreen() {
  const me = useMe();
  const toast = useToast();
  const { flow, update } = useCreateFlow();
  const today = todayFor(me, new Date());
  const start = clampStartDate(flow.startDate ?? defaultStartDate(today), today);
  const [busy, setBusy] = useState(false);
  const chosen = flow.plan;
  const b = flow.basics;

  if (!chosen || (!b && !flow.squadId)) {
    return (
      <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
        <Text variant="body" color="label2">
          {t('errors.UNKNOWN')}
        </Text>
      </Screen>
    );
  }

  const submit = async () => {
    setBusy(true);
    let squadId = flow.squadId;
    try {
      if (!squadId && b) {
        // Created once; a retry after a failed plan save reuses it.
        const squad = await endpoints.createSquad(b);
        squadId = squad.id;
        update({ squadId });
        track('squad_create', { privacy: b.privacy, category: b.category });
      }
      if (!squadId) return;
      const res = await endpoints.createChallenge(squadId, {
        plan: chosen.plan as unknown as Record<string, unknown>,
        startDate: start,
        templateSlug: chosen.templateSlug,
      });
      track('challenge_create', { days: chosen.stats.days, template: chosen.templateSlug ?? null });
      await refresh().catch(() => undefined);
      if (flow.existing) {
        toast.show({
          message: t('review.planReady', {
            title: res.challenge.title,
            date: formatLocalDate(start),
          }),
          kind: 'success',
        });
        router.dismissTo({ pathname: '/squad/[id]', params: { id: squadId } });
      } else {
        router.replace({ pathname: '/create/done', params: { squadId, start } });
      }
    } catch (e) {
      const squadMade = !flow.existing && !!squadId;
      toast.show({
        message: squadMade ? `${t('review.failedPlan')} ${errorMessage(e)}` : errorMessage(e),
        kind: 'error',
      });
      openPaywallFor(e);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen
      header={
        flow.existing ? (
          <NavHeader backLabel={t('common.back')} onBack={() => router.back()} />
        ) : (
          <CreateHeader step={3} />
        )
      }
      footer={
        <Button
          label={flow.existing ? t('review.start') : t('review.create')}
          onPress={() => void submit()}
          loading={busy}
          testID="review-create"
        />
      }
    >
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('review.title')}
      </Text>
      <Card gap={14}>
        {b ? (
          <View style={styles.block}>
            <Text variant="footnote" color="label2">
              {t('review.squad')}
            </Text>
            <Text variant="title2">{b.name}</Text>
            <Text variant="footnote" color="label2">
              {`${t(`categories.${b.category}`)}, ${t(b.privacy === 'private' ? 'create.privacyPrivate' : 'create.privacyPublic')}`}
            </Text>
          </View>
        ) : null}
        <View style={styles.block}>
          <Text variant="footnote" color="label2">
            {t('review.challenge')}
          </Text>
          <Text variant="title2">{chosen.plan.title}</Text>
          <Text variant="footnote" color="label2">
            {t('preview.planSummary', {
              days: chosen.plan.duration_days,
              perWeek: chosen.plan.days_per_week,
            })}
          </Text>
        </View>
      </Card>
      <View style={styles.date}>
        <StartDateRow value={start} today={today} onChange={(d) => update({ startDate: d })} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginBottom: 16 },
  block: { gap: 2 },
  date: { marginTop: 12 },
});
