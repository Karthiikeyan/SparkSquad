import { CHALLENGE_LIMITS, PLAN_LIMITS } from '@sparksquad/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Button,
  ChipToggle,
  NavHeader,
  Screen,
  Stepper,
  Text,
  TextField,
  useToast,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { useMe } from '../../auth/SessionProvider';
import {
  emptyTask,
  TaskListEditor,
  tasksValid,
  toPayloadTasks,
  type DraftTask,
} from '../../plan/TaskEditor';
import { todayFor } from '../../today/model';
import { afterPlanRoute, buildBlankPlan, defaultStartDate, useCreateFlow } from '../flow';

const PRESETS = [7, 21, 30, 60, 90] as const;

/** D9: title, length preset (or custom), days per week, default daily tasks. */
export function BlankScreen() {
  const me = useMe();
  const toast = useToast();
  const { flow, update } = useCreateFlow();
  const [title, setTitle] = useState('');
  const [days, setDays] = useState<number>(30);
  const [custom, setCustom] = useState(false);
  const [perWeek, setPerWeek] = useState(7);
  const [tasks, setTasks] = useState<DraftTask[]>([emptyTask()]);

  const next = () => {
    if (!title.trim() || !tasksValid(tasks)) {
      toast.show({ message: t('editDay.invalid'), kind: 'error' });
      return;
    }
    const result = buildBlankPlan({
      title,
      category: flow.basics?.category ?? 'other',
      durationDays: days,
      daysPerWeek: perWeek,
      tasks: toPayloadTasks(tasks),
    });
    if (!result.ok) {
      toast.show({ message: result.errors[0] ?? t('errors.PLAN_INVALID'), kind: 'error' });
      return;
    }
    update({
      plan: { plan: result.plan, fixes: result.fixes, stats: result.stats },
      startDate: flow.startDate ?? defaultStartDate(todayFor(me, new Date())),
    });
    router.push(afterPlanRoute(flow));
  };

  return (
    <Screen
      header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}
      footer={<Button label={t('blank.continue')} onPress={next} testID="blank-continue" />}
    >
      <Text variant="title1" accessibilityRole="header">
        {t('blank.title')}
      </Text>
      <Text variant="body" color="label2" style={styles.body}>
        {t('blank.body')}
      </Text>
      <View style={styles.form}>
        <TextField
          label={t('blank.planTitle')}
          placeholder={t('blank.planTitlePlaceholder')}
          value={title}
          onChangeText={setTitle}
          maxLength={PLAN_LIMITS.titleMax}
        />
        <View>
          <Text variant="footnote" color="label2" style={styles.label}>
            {t('blank.duration')}
          </Text>
          <View
            style={styles.chips}
            accessibilityRole="radiogroup"
            accessibilityLabel={t('blank.duration')}
          >
            {PRESETS.map((d) => (
              <ChipToggle
                key={d}
                label={t('blank.days', { n: d })}
                role="radio"
                selected={!custom && days === d}
                onPress={() => {
                  setCustom(false);
                  setDays(d);
                }}
              />
            ))}
            <ChipToggle
              label={t('blank.custom')}
              role="radio"
              selected={custom}
              onPress={() => setCustom(true)}
            />
          </View>
          {custom ? (
            <View style={styles.row}>
              <Text variant="body" style={styles.flex}>
                {t('blank.customDays')}
              </Text>
              <Stepper
                value={days}
                onChange={setDays}
                label={t('blank.customDays')}
                min={CHALLENGE_LIMITS.minDays}
                max={CHALLENGE_LIMITS.maxDays}
              />
            </View>
          ) : null}
        </View>
        <View>
          <View style={styles.row}>
            <Text variant="body" style={styles.flex}>
              {t('blank.perWeek')}
            </Text>
            <Stepper
              value={perWeek}
              onChange={setPerWeek}
              label={t('blank.perWeek')}
              min={1}
              max={7}
            />
          </View>
          <Text variant="caption" color="label3">
            {t('blank.perWeekHelp')}
          </Text>
        </View>
        <View>
          <Text variant="footnote" color="label2" style={styles.label}>
            {t('blank.tasks')}
          </Text>
          <Text variant="caption" color="label3" style={styles.help}>
            {t('blank.tasksHelp')}
          </Text>
          <TaskListEditor tasks={tasks} onChange={setTasks} />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: 6, marginBottom: 18 },
  form: { gap: 18 },
  label: { marginBottom: 6 },
  help: { marginBottom: 10 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  flex: { flex: 1 },
});
