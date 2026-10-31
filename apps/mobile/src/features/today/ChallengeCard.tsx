import { Clock, MoonStar } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import {
  AvatarRing,
  Button,
  Pressable,
  ProgressBar,
  Skeleton,
  TaskRow,
  Text,
} from '../../components/ui';
import { formatNumber, t } from '../../i18n';
import { formatLocalDate, formatTime } from '../../lib/format';
import { colors, fonts, iconStroke, radius } from '../../theme/tokens';
import { draftDoneCount, type DraftValues } from '../checkin/submit';
import type { TodayCard } from './model';
import { taskMeta } from './taskText';

export interface ChallengeCardProps {
  card: TodayCard;
  draft: DraftValues;
  onToggle: (index: number) => void;
  onCheckIn: (date?: string) => void;
  onOpenSquad: () => void;
}

function Header({ card, onOpenSquad }: Pick<ChallengeCardProps, 'card' | 'onOpenSquad'>) {
  return (
    <Pressable
      noScale
      onPress={onOpenSquad}
      accessibilityRole="button"
      accessibilityLabel={`${card.challenge.title}, ${card.squad.name}`}
      accessibilityHint={t('today.openSquad', { squad: card.squad.name })}
      style={styles.header}
    >
      <View style={styles.headerTexts}>
        <Text variant="title2" numberOfLines={2}>
          {card.challenge.title}
        </Text>
        <Text variant="footnote" color="label2" numberOfLines={1}>
          {card.squad.name}
        </Text>
      </View>
      {card.state === 'active' ? (
        <Text variant="footnote" color="label2" tabular style={styles.dayOf}>
          {t('today.dayOf', { n: card.dayNumber, total: card.challenge.durationDays })}
        </Text>
      ) : null}
    </Pressable>
  );
}

function Ring({ card }: { card: TodayCard }) {
  const label = t('today.checkedIn', { n: card.checkedCount, total: card.members.length });
  return (
    <View style={styles.ringRow}>
      <AvatarRing
        members={card.members.map((m) => ({
          id: m.id,
          name: m.name,
          avatarColor: m.avatarColor,
          checked: m.checked,
          initials: m.isMe ? 'Y' : undefined,
        }))}
        accessibilityLabel={label}
      />
      <Text variant="footnote" color="label2" importantForAccessibility="no">
        {label}
      </Text>
    </View>
  );
}

function Backfill({ card, onCheckIn }: Pick<ChallengeCardProps, 'card' | 'onCheckIn'>) {
  if (!card.backfill) return null;
  const date = card.backfill.date;
  return (
    <View style={styles.backfill}>
      <Text variant="footnote" color="label2">
        {t('today.backfill')}
      </Text>
      <Button
        label={t('today.backfillButton')}
        variant="secondary"
        size="sm"
        onPress={() => onCheckIn(date)}
        style={styles.backfillButton}
        testID={`backfill-${card.challenge.id}`}
      />
    </View>
  );
}

/** B1 card: one active challenge with its squad ring, tasks and check-in button (B3 when done). */
export function ChallengeCard({
  card,
  draft,
  onToggle,
  onCheckIn,
  onOpenSquad,
}: ChallengeCardProps) {
  const { day, mine } = card;

  if (card.state === 'upcoming') {
    return (
      <View style={styles.card}>
        <Header card={card} onOpenSquad={onOpenSquad} />
        <Text variant="body" color="accent">
          {t('today.upcoming', { date: formatLocalDate(card.challenge.startDate) })}
        </Text>
        <Text variant="footnote" color="label2">
          {t('today.upcomingBody')}
        </Text>
      </View>
    );
  }

  if (card.state === 'finished') {
    return (
      <View style={styles.card}>
        <Header card={card} onOpenSquad={onOpenSquad} />
        <Text variant="footnote" color="label2">
          {t('today.finished')}
        </Text>
      </View>
    );
  }

  if (!day) {
    return (
      <View style={styles.card} accessible accessibilityLabel={t('today.planLoading')}>
        <Header card={card} onOpenSquad={onOpenSquad} />
        <Ring card={card} />
        <Skeleton height={44} radius={12} />
        <Skeleton height={44} radius={12} />
      </View>
    );
  }

  // B3: already checked in today — collapse to time, edit link and squad progress.
  if (mine) {
    const time = formatTime(new Date(mine.createdAt));
    return (
      <View style={styles.card} testID={`card-${card.challenge.id}`}>
        <Header card={card} onOpenSquad={onOpenSquad} />
        <View style={styles.doneRow}>
          <View style={styles.doneTexts}>
            <Text variant="bodyMedium">
              {mine.status === 'honest_miss'
                ? t('today.missedAt', { time })
                : t('today.checkedAt', { time })}
            </Text>
            {card.minePending ? (
              <View style={styles.pendingRow}>
                <Clock size={14} color={colors.label3} strokeWidth={iconStroke} />
                <Text variant="caption" color="label3">
                  {t('today.pending')}
                </Text>
              </View>
            ) : null}
          </View>
          <Button
            label={t('today.edit')}
            variant="ghost"
            size="sm"
            onPress={() => onCheckIn()}
            accessibilityLabel={t('today.editLabel', { title: card.challenge.title })}
          />
        </View>
        <Ring card={card} />
        <ProgressBar
          value={card.members.length ? card.checkedCount / card.members.length : 0}
          accessibilityLabel={t('today.checkedIn', {
            n: card.checkedCount,
            total: card.members.length,
          })}
        />
        <Backfill card={card} onCheckIn={onCheckIn} />
      </View>
    );
  }

  if (day.rest) {
    return (
      <View style={styles.card}>
        <Header card={card} onOpenSquad={onOpenSquad} />
        <View style={styles.restRow}>
          <MoonStar size={22} color={colors.accent} strokeWidth={iconStroke} />
          <View style={styles.doneTexts}>
            <Text variant="bodySemibold">{t('today.restTitle')}</Text>
            <Text variant="footnote" color="label2">
              {t('today.restBody')}
            </Text>
          </View>
        </View>
        <Ring card={card} />
        <Backfill card={card} onCheckIn={onCheckIn} />
      </View>
    );
  }

  if (card.kind === 'steps') {
    const task = day.tasks[0]!;
    const value = typeof draft[0] === 'number' ? draft[0] : 0;
    const target = task.target ?? 1;
    return (
      <View style={[styles.card, styles.stepsCard]} testID={`card-${card.challenge.id}`}>
        <Header card={card} onOpenSquad={onOpenSquad} />
        <View style={styles.stepsRow}>
          <View style={styles.doneTexts}>
            <Text style={styles.stepsValue} tabular>
              {formatNumber(value)}
              <Text variant="body" color="label2">
                {` ${t('today.stepsOf', { target: formatNumber(target) })}`}
              </Text>
            </Text>
            <Text variant="footnote" color="label2">
              {t('today.stepsHint')}
            </Text>
          </View>
          <Button label={t('today.checkIn')} variant="soft" size="md" onPress={() => onCheckIn()} />
        </View>
        <ProgressBar value={value / target} />
        <Backfill card={card} onCheckIn={onCheckIn} />
      </View>
    );
  }

  const done = draftDoneCount(day.tasks, draft);
  const all = done === day.tasks.length;
  return (
    <View style={styles.card} testID={`card-${card.challenge.id}`}>
      <Header card={card} onOpenSquad={onOpenSquad} />
      <Ring card={card} />
      <View>
        {day.tasks.map((task, i) => (
          <TaskRow
            key={task.id}
            title={task.title}
            meta={taskMeta(task, draft[i])}
            done={draftDoneCount([task], { 0: draft[i] ?? false }) === 1}
            onToggle={() => onToggle(i)}
            testID={`task-${card.challenge.id}-${i}`}
          />
        ))}
      </View>
      <Button
        label={
          all
            ? t('today.checkInAll')
            : t('today.checkInProgress', { done, total: day.tasks.length })
        }
        onPress={() => onCheckIn()}
        testID={`checkin-${card.challenge.id}`}
      />
      <Backfill card={card} onCheckIn={onCheckIn} />
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 14 },
  stepsCard: { gap: 12 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: 8,
  },
  headerTexts: { flex: 1, gap: 2 },
  dayOf: { paddingTop: 4 },
  ringRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  doneRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  doneTexts: { flex: 1, gap: 2 },
  pendingRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  restRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stepsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 12 },
  stepsValue: {
    fontFamily: fonts.displaySemibold,
    fontSize: 30,
    lineHeight: 34,
    color: colors.label,
  },
  backfill: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
    paddingTop: 12,
    gap: 8,
  },
  backfillButton: { alignSelf: 'flex-start' },
});
