import { PLAN_LIMITS } from '@sparksquad/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { Lock } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  EmptyState,
  ErrorState,
  NavHeader,
  Screen,
  SkeletonCard,
  Switch,
  Text,
  TextField,
  useToast,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import {
  TaskListEditor,
  tasksValid,
  toDraftTask,
  toPayloadTasks,
  type DraftTask,
} from '../../plan/TaskEditor';
import { syncSoon } from '../actions';
import { canEditDay, dayFromSource } from '../model';
import { useSquad } from '../useSquad';
import { useMe } from '../../auth/SessionProvider';
import { todayFor } from '../../today/model';

/** C5: owner/admin edits a future day (title, review day, tasks). Past days and today are locked. */
export function EditDayScreen() {
  const { id, n: nParam } = useLocalSearchParams<{ id: string; n: string }>();
  const n = Number(nParam) || 1;
  const me = useMe();
  const toast = useToast();
  const squad = useSquad(id ?? '');
  const day = squad.data ? dayFromSource(squad.data, n) : null;
  const [title, setTitle] = useState<string | null>(null);
  const [rest, setRest] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<DraftTask[] | null>(null);
  const [saving, setSaving] = useState(false);

  const header = <NavHeader backLabel={t('common.back')} onBack={() => router.back()} />;
  if (squad.isPending) {
    return (
      <Screen header={header}>
        <SkeletonCard />
      </Screen>
    );
  }
  const ch = squad.data?.challenge;
  if (!squad.data || !ch || !day) {
    return (
      <Screen header={header}>
        <ErrorState message={t('plan.loading')} onRetry={() => void squad.refetch()} />
      </Screen>
    );
  }

  if (!canEditDay(ch, n, todayFor(me, new Date()))) {
    return (
      <Screen header={header}>
        <EmptyState icon={Lock} message={t('plan.locked')} />
      </Screen>
    );
  }

  const curTitle = title ?? day.title;
  const curRest = rest ?? day.rest;
  const curTasks = tasks ?? day.tasks.map(toDraftTask);

  const save = async () => {
    if (!curRest && !tasksValid(curTasks)) {
      toast.show({ message: t('editDay.invalid'), kind: 'error' });
      return;
    }
    setSaving(true);
    try {
      const res = await endpoints.editDay(ch.id, n, {
        title: curTitle.trim() || undefined,
        rest: curRest,
        tasks: curRest ? [] : toPayloadTasks(curTasks),
      });
      syncSoon();
      toast.show({
        message: res.fixes.length
          ? `${t('editDay.saved', { n })} ${t('editDay.fixed', { n: res.fixes.length })}`
          : t('editDay.saved', { n }),
        kind: 'success',
      });
      router.back();
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen
      header={header}
      footer={
        <Button
          label={t('editDay.save')}
          onPress={() => void save()}
          loading={saving}
          testID="save-day"
        />
      }
    >
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('editDay.title', { n })}
      </Text>
      <TextField
        label={t('editDay.dayTitle')}
        value={curTitle}
        onChangeText={setTitle}
        maxLength={PLAN_LIMITS.dayTitleMax}
      />
      <View style={styles.restRow}>
        <Text variant="body" style={styles.flex}>
          {t('editDay.rest')}
        </Text>
        <Switch value={curRest} onValueChange={setRest} accessibilityLabel={t('editDay.rest')} />
      </View>
      {!curRest ? (
        <>
          <Text variant="footnote" color="label2" style={styles.section}>
            {t('editDay.tasks')}
          </Text>
          <TaskListEditor tasks={curTasks} onChange={setTasks} />
        </>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  flex: { flex: 1 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, marginTop: 12 },
  section: { marginTop: 16, marginBottom: 8, marginHorizontal: 4 },
});
