import { router } from 'expo-router';
import {
  BellRing,
  CalendarDays,
  Clock,
  Flame,
  Image as ImageIcon,
  MessageCircle,
  PartyPopper,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Avatar, AvatarRing, Button, EmptyState, Pressable, Text } from '../../../components/ui';
import { t } from '../../../i18n';
import { formatTime } from '../../../lib/format';
import { colors, fonts, iconStroke, radius } from '../../../theme/tokens';
import type { Board, FeedItem } from '../model';

export interface BoardSectionProps {
  board: Board;
  onNudge: (member: { id: string; name: string }) => void;
  /** Nudges everyone still waiting whom I haven't nudged today. */
  onNudgeAll?: (members: readonly { id: string; name: string }[]) => void;
  onFire: (checkinId: string) => void;
  /** Owners/admins of a squad with no challenge can set one up. */
  onSetUpPlan?: () => void;
}

function feedLine(item: FeedItem): string {
  const time = formatTime(new Date(item.checkin.createdAt));
  if (item.checkin.status === 'honest_miss') return t('squad.honestMiss', { time });
  if (item.tasksTotal === 0) return t('squad.restDay', { time });
  return t('squad.finished', { done: item.tasksDone, total: item.tasksTotal, time });
}

function FeedRow({
  item,
  first,
  onFire,
}: {
  item: FeedItem;
  first: boolean;
  onFire: (id: string) => void;
}) {
  const c = item.checkin;
  const name = item.author.isMe ? t('squad.you') : item.author.name;
  return (
    <Pressable
      noScale
      onPress={() => router.push({ pathname: '/checkins/[id]', params: { id: c.id } })}
      accessibilityRole="button"
      accessibilityLabel={t('squad.openCheckin', { name })}
      style={[styles.feedRow, !first && styles.feedSeparator]}
    >
      <Avatar
        name={item.author.name}
        id={item.author.id}
        color={item.author.avatarColor}
        label={item.author.isMe ? 'Y' : undefined}
        size={32}
        decorative
      />
      <View style={styles.feedBody}>
        <Text variant="body">
          <Text variant="bodySemibold">{name}</Text>
          <Text variant="body" color="label2">{` ${feedLine(item)}`}</Text>
        </Text>
        {c.note ? (
          <Text variant="body" style={{ color: colors.onControl }}>
            {c.note}
          </Text>
        ) : null}
        <View style={styles.meta}>
          {c.hasPhoto ? (
            <View style={styles.metaItem}>
              <ImageIcon size={14} color={colors.label2} strokeWidth={iconStroke} />
              <Text variant="caption" color="label2">
                {t('squad.proof')}
              </Text>
            </View>
          ) : null}
          {item.pending ? (
            <View style={styles.metaItem}>
              <Clock size={14} color={colors.label3} strokeWidth={iconStroke} />
              <Text variant="caption" color="label3">
                {t('common.pendingSync')}
              </Text>
            </View>
          ) : null}
        </View>
        <View style={styles.actions}>
          <Pressable
            onPress={() => onFire(c.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: c.reactedByMe }}
            accessibilityLabel={t(c.reactedByMe ? 'squad.fireOn' : 'squad.fire', {
              n: c.reactionCount,
            })}
            hitSlop={{ top: 7, bottom: 7 }}
            style={[styles.pill, c.reactedByMe ? styles.fireOn : styles.fireOff]}
            testID={`fire-${c.id}`}
          >
            <Flame
              size={16}
              color={c.reactedByMe ? colors.onAccent : colors.accent}
              fill={c.reactedByMe ? colors.onAccent : 'none'}
              strokeWidth={iconStroke}
            />
            <Text
              style={[styles.pillText, { color: c.reactedByMe ? colors.onAccent : colors.accent }]}
              tabular
            >
              {String(c.reactionCount)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/checkins/[id]', params: { id: c.id } })}
            accessibilityRole="button"
            accessibilityLabel={
              c.commentCount ? t('squad.comments', { n: c.commentCount }) : t('squad.comment')
            }
            hitSlop={{ top: 7, bottom: 7 }}
            style={[styles.pill, styles.commentPill]}
          >
            {c.commentCount ? (
              <MessageCircle size={14} color={colors.chipLabel} strokeWidth={iconStroke} />
            ) : null}
            <Text style={[styles.pillText, styles.commentText]} tabular>
              {c.commentCount ? String(c.commentCount) : t('squad.comment')}
            </Text>
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

/** C2 board body: count + member grid, still to check in (nudge), today's feed. */
export function BoardSection({
  board,
  onNudge,
  onNudgeAll,
  onFire,
  onSetUpPlan,
}: BoardSectionProps) {
  if (board.state === 'none') {
    return (
      <EmptyState
        icon={CalendarDays}
        message={`${t('squad.noChallengeTitle')}. ${t('squad.noChallengeBody')}`}
        actionLabel={onSetUpPlan ? t('squad.setupPlan') : undefined}
        onAction={onSetUpPlan}
      />
    );
  }
  const total = board.grid.length;
  const everyoneIn = board.state === 'running' && total >= 2 && board.checkedCount === total;
  const nudgeable = board.stillToCheckIn.filter((m) => !m.nudged);
  return (
    <View>
      {everyoneIn ? (
        <View style={styles.win} accessible accessibilityLiveRegion="polite" testID="everyone-in">
          <View style={styles.winIcon}>
            <PartyPopper size={22} color={colors.onAccent} strokeWidth={iconStroke} />
          </View>
          <View style={styles.flex}>
            <Text variant="headline">{t('squad.everyoneTitle')}</Text>
            <Text variant="footnote" color="label2">
              {t('squad.everyoneBody', { n: total })}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={styles.card}>
        <View
          style={styles.countRow}
          accessible
          accessibilityLabel={t('squad.showedUpLabel', { n: board.checkedCount, total })}
        >
          <Text style={styles.count} tabular>
            {String(board.checkedCount)}
            <Text style={[styles.count, { color: colors.iconMuted }]}>{`/${total}`}</Text>
          </Text>
          <Text variant="body" color="label2">
            {t('squad.showedUp')}
          </Text>
        </View>
        <AvatarRing
          variant="grid"
          members={board.grid.map((m) => ({
            id: m.id,
            name: m.name,
            avatarColor: m.avatarColor,
            checked: m.checked,
            shortName: m.isMe ? t('squad.you') : undefined,
            initials: m.isMe ? 'Y' : undefined,
          }))}
        />
      </View>

      {board.stillToCheckIn.length > 0 ? (
        <>
          <View style={styles.headingRow}>
            <Text variant="bodySemibold" accessibilityRole="header" style={styles.flex}>
              {t('squad.stillToCheckIn')}
            </Text>
            {onNudgeAll && nudgeable.length >= 2 ? (
              <Button
                label={t('squad.nudgeAll')}
                variant="soft"
                size="sm"
                icon={<BellRing size={15} color={colors.accent} strokeWidth={iconStroke} />}
                accessibilityLabel={t('squad.nudgeAllLabel', { n: nudgeable.length })}
                onPress={() => onNudgeAll(nudgeable.map((m) => ({ id: m.id, name: m.name })))}
                testID="nudge-all"
              />
            ) : null}
          </View>
          <View style={styles.list}>
            {board.stillToCheckIn.map((m, i) => (
              <View key={m.id} style={[styles.listRow, i > 0 && styles.separator]}>
                <Avatar name={m.name} id={m.id} color={m.avatarColor} size={32} decorative />
                <Text variant="body" style={styles.flex} numberOfLines={1}>
                  {m.name}
                </Text>
                {m.nudged ? (
                  <Button
                    label={t('squad.nudged')}
                    variant="secondary"
                    size="sm"
                    disabled
                    onPress={() => undefined}
                  />
                ) : (
                  <Button
                    label={t('squad.nudge')}
                    variant="soft"
                    size="sm"
                    accessibilityLabel={t('squad.nudgeLabel', { name: m.name })}
                    onPress={() => onNudge({ id: m.id, name: m.name })}
                    testID={`nudge-${m.id}`}
                  />
                )}
              </View>
            ))}
          </View>
        </>
      ) : null}

      <Text variant="bodySemibold" style={styles.heading} accessibilityRole="header">
        {t('squad.feed')}
      </Text>
      <View style={styles.feed}>
        {board.feed.length === 0 ? (
          <Text variant="body" color="label2">
            {t('squad.feedEmpty')}
          </Text>
        ) : (
          board.feed.map((item, i) => (
            <FeedRow key={item.checkin.id} item={item} first={i === 0} onFire={onFire} />
          ))
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.card, padding: 16, gap: 14 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 8 },
  count: { fontFamily: fonts.display, fontSize: 44, lineHeight: 46, color: colors.accent },
  win: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.list,
    padding: 14,
    marginBottom: 12,
  },
  winIcon: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: { marginTop: 20, marginBottom: 8, marginHorizontal: 4 },
  headingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 34,
    marginTop: 20,
    marginBottom: 8,
    marginHorizontal: 4,
  },
  list: { backgroundColor: colors.surface, borderRadius: radius.list, paddingHorizontal: 16 },
  listRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  flex: { flex: 1 },
  feed: {
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  feedRow: { flexDirection: 'row', gap: 12 },
  feedSeparator: {
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  feedBody: { flex: 1, gap: 4 },
  meta: { flexDirection: 'row', gap: 12 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  actions: { flexDirection: 'row', gap: 8, marginTop: 4 },
  pill: {
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fireOff: { backgroundColor: colors.accentSoft },
  fireOn: { backgroundColor: colors.accent },
  commentPill: { backgroundColor: colors.surface2, paddingHorizontal: 12 },
  pillText: { fontFamily: fonts.sansSemibold, fontSize: 13, lineHeight: 18 },
  commentText: { color: colors.chipLabel, fontFamily: fonts.sans },
});
