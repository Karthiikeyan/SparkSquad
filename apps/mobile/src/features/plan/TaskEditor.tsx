import {
  PLAN_LIMITS,
  TASK_TYPES,
  VERIFY_KINDS,
  type PlanTask,
  type TaskType,
  type VerifyKind,
} from '@sparksquad/shared';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  ChipToggle,
  IconButton,
  SegmentedControl,
  Stepper,
  Text,
  TextField,
} from '../../components/ui';
import { t, type TKey } from '../../i18n';
import { colors, radius } from '../../theme/tokens';

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
export const newTaskKey = () => `t${Date.now()}-${seq++}`;

export function emptyTask(): DraftTask {
  return {
    key: newTaskKey(),
    title: '',
    type: 'check',
    target: 1,
    unit: '',
    verify: null,
    link: '',
  };
}

export function toDraftTask(task: PlanTask): DraftTask {
  return {
    key: newTaskKey(),
    title: task.title,
    type: task.type,
    target: task.target ?? (task.type === 'minutes' ? 30 : 1),
    unit: task.unit ?? '',
    verify: task.verify ?? null,
    link: task.link ?? '',
  };
}

/** Draft tasks → the raw objects the shared parser and API accept. */
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

export const tasksValid = (tasks: readonly DraftTask[]) =>
  tasks.length > 0 && tasks.every((d) => d.title.trim().length > 0);

/** Edit a list of tasks: title, type, target, unit, auto-check, link; reorder, add, remove. */
export function TaskListEditor({
  tasks,
  onChange,
}: {
  tasks: DraftTask[];
  onChange: (tasks: DraftTask[]) => void;
}) {
  const update = (i: number, patch: Partial<DraftTask>) =>
    onChange(tasks.map((d, j) => (j === i ? { ...d, ...patch } : d)));
  return (
    <View>
      {tasks.map((d, i) => (
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
              onPress={() => onChange(moveItem(tasks, i, i - 1))}
            />
            <IconButton
              icon={ArrowDown}
              size={36}
              background="surface2"
              accessibilityLabel={t('editDay.moveDown', { n: i + 1 })}
              disabled={i === tasks.length - 1}
              onPress={() => onChange(moveItem(tasks, i, i + 1))}
            />
            <IconButton
              icon={Trash2}
              size={36}
              background="surface2"
              color="danger"
              accessibilityLabel={t('editDay.remove', { n: i + 1 })}
              onPress={() => onChange(tasks.filter((_, j) => j !== i))}
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
            options={TASK_TYPES.map((type) => ({ value: type, label: t(TYPE_LABEL[type]) }))}
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
      {tasks.length < PLAN_LIMITS.maxTasksPerDay ? (
        <Button
          label={t('editDay.add')}
          variant="secondary"
          size="md"
          icon={<Plus size={18} color={colors.label} />}
          onPress={() => onChange([...tasks, emptyTask()])}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
