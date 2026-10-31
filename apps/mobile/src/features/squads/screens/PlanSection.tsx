import { exportPlan, planFileName, type PlanDay, type PlanTask } from '@sparksquad/shared';
import { File, Paths } from 'expo-file-system';
import { router } from 'expo-router';
import * as Sharing from 'expo-sharing';
import { Check, Clock, Flag } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { Linking, ScrollView, StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import { Button, DayStrip, PhaseBar, Skeleton, Text, useToast } from '../../../components/ui';
import { formatNumber, t } from '../../../i18n';
import { colors, fonts, iconStroke, radius } from '../../../theme/tokens';
import {
  canEditDay,
  canManage,
  dayFromSource,
  dayOfChallenge,
  nextMilestone,
  phaseFor,
  planStrip,
} from '../model';
import type { SquadSource } from '../source';

function TaskTile({ task, first }: { task: PlanTask; first: boolean }) {
  const verify = task.verify
    ? t('plan.autoChecked', { source: t(`verifySources.${task.verify}`) })
    : '';
  const meta =
    task.type === 'count'
      ? `${t('plan.countMeta')}${verify}`
      : task.type === 'minutes'
        ? `${t('plan.minutesMeta', { n: formatNumber(task.target ?? 1) })}${verify}`
        : `${t('plan.checkMeta')}${verify}`;
  return (
    <View style={[styles.task, first && styles.taskFirst]}>
      <View style={styles.tile} accessibilityElementsHidden importantForAccessibility="no">
        {task.type === 'count' ? (
          <Text style={styles.tileText} tabular>
            {formatNumber(task.target ?? 1)}
          </Text>
        ) : task.type === 'minutes' ? (
          <Clock size={18} color={colors.accent} strokeWidth={iconStroke} />
        ) : (
          <Check size={18} color={colors.accent} strokeWidth={iconStroke} />
        )}
      </View>
      <View style={styles.taskTexts}>
        <Text variant="bodyMedium">{task.title}</Text>
        <Text variant="footnote" color="label2">
          {meta}
          {task.link ? (
            <Text
              variant="footnote"
              color="accent"
              accessibilityRole="link"
              onPress={() => void Linking.openURL(task.link!)}
            >{`, ${t('plan.openLink')}`}</Text>
          ) : null}
        </Text>
      </View>
    </View>
  );
}

/** C4: phase, phase bar, 7-day strip (swipe for more weeks), day card, milestone, owner tools. */
export function PlanSection({
  src,
  today,
  syncedFrom,
}: {
  src: SquadSource;
  today: string;
  syncedFrom: string;
}) {
  const toast = useToast();
  const ch = src.challenge!;
  const todayN = dayOfChallenge(ch, today);
  const [selected, setSelected] = useState(todayN);
  const [width, setWidth] = useState(0);
  const strip = useMemo(() => planStrip(src, today, syncedFrom), [src, today, syncedFrom]);

  if (!src.plan) {
    return (
      <View accessible accessibilityLabel={t('plan.loading')} style={styles.loading}>
        <Skeleton height={64} radius={14} />
        <Skeleton height={180} radius={radius.card} />
      </View>
    );
  }
  const plan = src.plan;
  const phase = phaseFor(plan, selected);
  const day: PlanDay | null = dayFromSource(src, selected);
  const milestone = nextMilestone(plan, selected);
  const weeks = Math.ceil(strip.length / 7);
  const startWeek = Math.floor((todayN - 1) / 7);
  const manager = canManage(src.myRole);
  const editable = canEditDay(ch, selected, today);

  const exportFile = async () => {
    try {
      const file = new File(Paths.cache, planFileName(plan.title));
      if (file.exists) file.delete();
      file.create();
      await file.write(exportPlan(plan, src.edits));
      await Sharing.shareAsync(file.uri, {
        mimeType: 'application/json',
        dialogTitle: t('plan.export'),
      });
    } catch {
      toast.show({ message: t('errors.UNKNOWN'), kind: 'error' });
    }
  };

  return (
    <View>
      {phase ? (
        <>
          <View style={styles.phaseRow}>
            <Text variant="bodySemibold" style={styles.flex} numberOfLines={1}>
              {phase.phase.name}
            </Text>
            <Text variant="footnote" color="label2">
              {t('plan.phaseOf', {
                n: phase.index,
                total: phase.total,
                from: phase.phase.from_day,
                to: phase.phase.to_day,
              })}
            </Text>
          </View>
          <View style={styles.phaseBar}>
            <PhaseBar total={phase.total} current={phase.index} progress={phase.progress} />
          </View>
        </>
      ) : null}

      <View onLayout={(e: LayoutChangeEvent) => setWidth(e.nativeEvent.layout.width)}>
        {width > 0 ? (
          <ScrollView
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            contentOffset={{ x: startWeek * width, y: 0 }}
          >
            {Array.from({ length: weeks }, (_, w) => {
              const days = strip.slice(w * 7, w * 7 + 7);
              return (
                <View key={w} style={{ width }}>
                  <DayStrip days={days} columns={7} selected={selected} onSelect={setSelected} />
                </View>
              );
            })}
          </ScrollView>
        ) : null}
      </View>

      <View style={styles.card}>
        <Text variant="footnote" color="label2">
          {selected === todayN && strip[selected - 1]?.state === 'today'
            ? t('plan.dayToday', { n: selected })
            : t('plan.day', { n: selected })}
        </Text>
        <Text variant="title2" style={styles.dayTitle}>
          {day?.rest ? t('plan.restTitle') : (day?.title ?? '')}
        </Text>
        {day?.rest ? (
          <Text variant="footnote" color="label2">
            {day.title ? `${day.title}. ` : ''}
            {t('plan.restBody')}
          </Text>
        ) : (
          day?.tasks.map((task, i) => <TaskTile key={task.id} task={task} first={i === 0} />)
        )}
      </View>

      {milestone ? (
        <View style={styles.milestone}>
          <Flag size={16} color={colors.label2} strokeWidth={iconStroke} />
          <Text variant="footnote" color="label2" style={styles.flex}>
            {t('plan.milestone', { n: milestone.day, title: milestone.title })}
          </Text>
        </View>
      ) : null}

      {manager ? (
        <View style={styles.ownerRow}>
          <Button
            label={t('plan.edit')}
            variant="secondary"
            size="md"
            style={styles.flex}
            disabled={!editable}
            accessibilityHint={editable ? undefined : t('plan.locked')}
            onPress={() =>
              router.push({
                pathname: '/squad/[id]/plan/day/[n]',
                params: { id: src.squad.id, n: String(selected) },
              })
            }
          />
          <Button
            label={t('plan.export')}
            variant="secondary"
            size="md"
            style={styles.flex}
            onPress={() => void exportFile()}
          />
        </View>
      ) : null}
      {manager && !editable ? (
        <Text variant="caption" color="label3" style={styles.locked}>
          {t('plan.locked')}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { gap: 14 },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    marginHorizontal: 2,
    marginBottom: 8,
  },
  phaseBar: { marginBottom: 16 },
  flex: { flex: 1 },
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, marginTop: 14 },
  dayTitle: { marginTop: 2, marginBottom: 6 },
  task: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  taskFirst: {},
  tile: {
    width: 36,
    height: 36,
    borderRadius: 10,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileText: { fontFamily: fonts.sansSemibold, fontSize: 13, color: colors.accent },
  taskTexts: { flex: 1, gap: 2 },
  milestone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 12,
    marginHorizontal: 4,
  },
  ownerRow: { flexDirection: 'row', gap: 10, marginTop: 20 },
  locked: { marginTop: 6, textAlign: 'center' },
});
