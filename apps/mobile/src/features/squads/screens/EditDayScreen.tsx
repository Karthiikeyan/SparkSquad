import {
  PLAN_LIMITS,
  TASK_TYPES,
  VERIFY_KINDS,
  type PlanTask,
  type TaskType,
  type VerifyKind,
} from '@sparksquad/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  ChipToggle,
  ErrorState,
  IconButton,
  NavHeader,
  Screen,
  SegmentedControl,
  SkeletonCard,
  Stepper,
  Switch,
  Text,
  TextField,
  useToast,
} from '../../../components/ui';
import { t, type TKey } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import { colors, radius } from '../../../theme/tokens';
import { syncSoon } from '../actions';
import { dayFromSource } from '../model';
import { useSquad } from '../useSquad';

export interface DraftTask {
  key: string;
  title: string;
  type: TaskType;
  target: number;
  unit: string;
  verify: VerifyKind | null;
  link: string;
}

const TYPE_LABEL: Record<TaskType, TKey> = {
  check: 'editDay.typeCheck',
  count: 'editDay.typeCount',
  minutes: 'editDay.typeMinutes',
};

let seq = 0;
const newKey = () => `t${Date.now()}-${seq++}`;

export function toDraftTask(task: PlanTask): DraftTask {
  return {
    key: newKey(),
    title: task.title,
    type: task.type,
    target: task.target ?? (task.type === 'minutes' ? 30 : 1),
    unit: task.unit ?? '',
    verify: task.verify ?? null,
    link: task.link ?? '',
  };
}

/** Draft tasks → the raw objects the API re-validates with the shared parser. */
export function toPayloadTasks(tasks: readonly DraftTask[]): Record<string, unknown>[] {
  return tasks.map((d) => {
    const out: Record<string, unknown> = { title: d.title.trim(), type: d.type };
    if (d.type !== 'check') out.target = d.target;
    if (d.type === 'count' && d.unit.trim()) out.unit = d.unit.trim();
    if (d.verify) out.verify = d.verify;
    if (d.link.trim()) out.link = d.link.trim();
    return out;
  });
}

export function moveItem<T>(list: readonly T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return [...list];
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return next;
}

/** C5: owner/admin edits a future day (title, review day, tasks). Past days are locked server-side. */
export function EditDayScreen() {
  const { id, n: nParam } = useLocalSearchParams<{ id: string; n: string }>();
  const n = Number(nParam) || 1;
  const toast = useToast();
  const squad = useSquad(id ?? '');
  const day = squad.data ? dayFromSource(squad.data, n) : null;
  const [title, setTitle] = useState<string | null>(null);
  const [rest, setRest] = useState<boolean | null>(null);
  const [tasks, setTasks] = useState<DraftTask[] | null>(null);
  const [saving, setSaving] = useState(false);

  const header = (
    <NavHeader
      backLabel={t('common.back')}
      onBack={() => (router.canGoBack() ? router.back() : undefined)}
    />
  );
  if (squad.isPending)
    return (
      <Screen header={header}>
        <SkeletonCard />
      </Screen>
    );
  const ch = squad.data?.challenge;
  if (!squad.data || !ch || !day) {
    return (
      <Screen header={header}>
        <ErrorState message={t('plan.loading')} onRetry={() => void squad.refetch()} />
      </Screen>
    );
  }

  const curTitle = title ?? day.title;
  const curRest = rest ?? day.rest;
  const curTasks = tasks ?? day.tasks.map(toDraftTask);
  const update = (i: number, patch: Partial<DraftTask>) =>
    setTasks(curTasks.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  const valid = curRest || (curTasks.length > 0 && curTasks.every((d) => d.title.trim()));

  const save = async () => {
    if (!valid) {
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
          {curTasks.map((d, i) => (
            <View key={d.key} style={styles.task}>
              <View style={styles.taskHead}>
                <Text variant="footnoteSemibold" color="label2" style={styles.flex}>
                  {t('editDay.taskTitle', { n: i + 1 })}
                </Text>
                <IconButton
                  icon={ArrowUp}
                  size={36}
                  background="surface2"
                  accessibilityLabel={t('editDay.moveUp', { n: i + 1 })}
                  disabled={i === 0}
                  onPress={() => setTasks(moveItem(curTasks, i, i - 1))}
                />
                <IconButton
                  icon={ArrowDown}
                  size={36}
                  background="surface2"
                  accessibilityLabel={t('editDay.moveDown', { n: i + 1 })}
                  disabled={i === curTasks.length - 1}
                  onPress={() => setTasks(moveItem(curTasks, i, i + 1))}
                />
                <IconButton
                  icon={Trash2}
                  size={36}
                  background="surface2"
                  color="danger"
                  accessibilityLabel={t('editDay.remove', { n: i + 1 })}
                  onPress={() => setTasks(curTasks.filter((_, j) => j !== i))}
                />
              </View>
              <TextField
                placeholder={t('editDay.taskPlaceholder')}
                accessibilityLabel={t('editDay.taskTitle', { n: i + 1 })}
                value={d.title}
                onChangeText={(v) => update(i, { title: v })}
                maxLength={PLAN_LIMITS.taskTitleMax}
              />
              <SegmentedControl
                role="radiogroup"
                accessibilityLabel={t('editDay.type')}
                value={d.type}
                onChange={(type) => update(i, { type, target: type === 'minutes' ? 30 : d.target })}
                options={TASK_TYPES.map((type) => ({
                  value: type,
                  label: t(TYPE_LABEL[type]),
                }))}
              />
              {d.type !== 'check' ? (
                <View style={styles.targetRow}>
                  <Text variant="body" style={styles.flex}>
                    {t('editDay.target')}
                  </Text>
                  <Stepper
                    value={d.target}
                    onChange={(v) => update(i, { target: v })}
                    label={t('editDay.target')}
                    min={PLAN_LIMITS.targetMin}
                    max={PLAN_LIMITS.targetMax}
                    step={d.type === 'minutes' ? 5 : 1}
                  />
                </View>
              ) : null}
              {d.type === 'count' ? (
                <TextField
                  label={t('editDay.unit')}
                  placeholder={t('editDay.unitPlaceholder')}
                  value={d.unit}
                  onChangeText={(v) => update(i, { unit: v })}
                  maxLength={PLAN_LIMITS.unitMax}
                />
              ) : null}
              <View>
                <Text variant="footnote" color="label2" style={styles.chipsLabel}>
                  {t('editDay.verify')}
                </Text>
                <View
                  style={styles.chips}
                  accessibilityRole="radiogroup"
                  accessibilityLabel={t('editDay.verify')}
                >
                  <ChipToggle
                    label={t('editDay.verifyNone')}
                    role="radio"
                    selected={!d.verify}
                    onPress={() => update(i, { verify: null })}
                  />
                  {VERIFY_KINDS.map((v) => (
                    <ChipToggle
                      key={v}
                      label={t(`verifySources.${v}`)}
                      role="radio"
                      selected={d.verify === v}
                      onPress={() => update(i, { verify: v })}
                    />
                  ))}
                </View>
              </View>
              <TextField
                label={t('editDay.link')}
                placeholder={t('editDay.linkPlaceholder')}
                value={d.link}
                onChangeText={(v) => update(i, { link: v })}
                autoCapitalize="none"
                keyboardType="url"
                maxLength={PLAN_LIMITS.linkMax}
              />
            </View>
          ))}
          {curTasks.length < PLAN_LIMITS.maxTasksPerDay ? (
            <Button
              label={t('editDay.add')}
              variant="secondary"
              size="md"
              icon={<Plus size={18} color={colors.label} />}
              onPress={() =>
                setTasks([
                  ...curTasks,
                  {
                    key: newKey(),
                    title: '',
                    type: 'check',
                    target: 1,
                    unit: '',
                    verify: null,
                    link: '',
                  },
                ])
              }
            />
          ) : null}
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
  task: {
    backgroundColor: colors.surface,
    borderRadius: radius.listLarge,
    padding: 14,
    gap: 12,
    marginBottom: 12,
  },
  taskHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  targetRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  chipsLabel: { marginBottom: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
});
