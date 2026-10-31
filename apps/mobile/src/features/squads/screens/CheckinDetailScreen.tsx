import { commentRetentionDays, TEXT_LIMITS, type CommentDTO } from '@sparksquad/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import {
  CheckCircle2,
  Circle,
  Flag,
  Flame,
  MoreHorizontal,
  Send,
  Trash2,
} from 'lucide-react-native';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  Avatar,
  BottomSheet,
  Button,
  ErrorState,
  IconButton,
  NavHeader,
  Pressable,
  Screen,
  SkeletonCard,
  Text,
  TextField,
  useToast,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage, isNetworkError } from '../../../lib/api/errors';
import { formatLocalDate, formatTime } from '../../../lib/format';
import { qk } from '../../../lib/query/keys';
import { useLocalQuery } from '../../../lib/query/useLocalQuery';
import { getRuntime } from '../../../lib/runtime';
import { colors, fonts, iconStroke, radius } from '../../../theme/tokens';
import { useMe } from '../../auth/SessionProvider';
import { localProofUri } from '../../checkin/localProof';
import { confirmBlock, ReportSheet, type ReportTarget } from '../../safety/ReportSheet';
import { taskMeta } from '../../today/taskText';
import { bumpCommentCount, toggleFire } from '../actions';
import { readCheckinContext } from '../checkinContext';

/** C6: full check-in, fire reaction, comments (140 chars, expiry note), report/block. */
export function CheckinDetailScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const toast = useToast();
  const queryClient = useQueryClient();
  const local = useLocalQuery([...qk.local, 'checkin', id], (db) => readCheckinContext(db, id));
  const remote = useQuery({ queryKey: ['checkin', id], queryFn: () => endpoints.checkin(id) });
  const comments = useQuery({ queryKey: qk.comments(id), queryFn: () => endpoints.comments(id) });
  const [draft, setDraft] = useState('');
  const [posting, setPosting] = useState(false);
  const [menu, setMenu] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);

  const header = (right?: React.ReactNode) => (
    <NavHeader backLabel={t('common.back')} onBack={() => router.back()} right={right} />
  );
  const ctx = local.data;
  // Local copy wins for live counts (outbox updates it); the server fills gaps (photo URL, author).
  const checkin = ctx?.checkin ?? remote.data?.checkin ?? null;
  if (!checkin) {
    if (local.isPending || remote.isPending)
      return (
        <Screen header={header()}>
          <SkeletonCard />
        </Screen>
      );
    return (
      <Screen header={header()}>
        <ErrorState message={errorMessage(remote.error)} onRetry={() => void remote.refetch()} />
      </Screen>
    );
  }

  const mine = checkin.userId === me.id;
  const author = ctx?.author ?? remote.data?.author ?? null;
  const name = mine ? me.displayName : (author?.displayName ?? '');
  const photoUrl = remote.data?.checkin.photoUrl ?? checkin.photoUrl;
  const localPhoto = mine ? localProofUri(checkin.challengeId, checkin.localDate) : null;
  const day = ctx?.day ?? null;
  const retention = commentRetentionDays(me.plan, ctx?.squad?.isPro ?? false);

  const fire = () => {
    const { db, outbox } = getRuntime();
    toggleFire(db, outbox, checkin.id).catch(() => undefined);
  };

  const post = async () => {
    const body = draft.trim();
    if (!body) return;
    setPosting(true);
    try {
      const created = await endpoints.addComment(checkin.id, body);
      queryClient.setQueryData<{ comments: CommentDTO[] }>(qk.comments(checkin.id), (cur) => ({
        comments: [...(cur?.comments ?? []), created],
      }));
      setDraft('');
      await bumpCommentCount(getRuntime().db, checkin.id, 1);
    } catch (e) {
      if (isNetworkError(e)) {
        await getRuntime().outbox.enqueue('comment', `comment:${checkin.id}:${Date.now()}`, {
          checkinId: checkin.id,
          body,
        });
        setDraft('');
        toast.show({ message: t('checkinDetail.queued'), kind: 'info' });
      } else {
        toast.show({ message: errorMessage(e), kind: 'error' });
      }
    } finally {
      setPosting(false);
    }
  };

  const remove = (c: CommentDTO) =>
    Alert.alert(t('checkinDetail.deleteComment'), undefined, [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('checkinDetail.deleteComment'),
        style: 'destructive',
        onPress: () => {
          endpoints
            .deleteComment(c.id)
            .then(async () => {
              queryClient.setQueryData<{ comments: CommentDTO[] }>(
                qk.comments(checkin.id),
                (cur) => ({
                  comments: (cur?.comments ?? []).filter((x) => x.id !== c.id),
                }),
              );
              await bumpCommentCount(getRuntime().db, checkin.id, -1);
              toast.show({ message: t('checkinDetail.deleted'), kind: 'success' });
            })
            .catch((e: unknown) => toast.show({ message: errorMessage(e), kind: 'error' }));
        },
      },
    ]);

  return (
    <Screen
      header={header(
        mine ? undefined : (
          <IconButton
            icon={MoreHorizontal}
            background="transparent"
            accessibilityLabel={t('checkinDetail.more')}
            onPress={() => setMenu(true)}
          />
        ),
      )}
      footer={
        <View style={styles.composer}>
          <TextField
            placeholder={t('checkinDetail.placeholder')}
            accessibilityLabel={t('checkinDetail.placeholder')}
            value={draft}
            onChangeText={setDraft}
            maxLength={TEXT_LIMITS.comment}
            containerStyle={styles.flex}
            returnKeyType="send"
            onSubmitEditing={() => void post()}
            testID="comment-input"
          />
          <IconButton
            icon={Send}
            background="accent"
            color="onAccent"
            accessibilityLabel={t('checkinDetail.sendLabel')}
            disabled={!draft.trim() || posting}
            onPress={() => void post()}
          />
        </View>
      }
    >
      <View style={styles.head}>
        <Avatar
          name={name}
          id={checkin.userId}
          color={mine ? me.avatarColor : author?.avatarColor}
          size={40}
          decorative
        />
        <View style={styles.flex}>
          <Text variant="title2" accessibilityRole="header">
            {mine ? t('squad.you') : t('checkinDetail.title', { name })}
          </Text>
          <Text variant="footnote" color="label2">
            {t('checkinDetail.dayLine', {
              n: checkin.dayNumber,
              date: formatLocalDate(checkin.localDate),
            })}
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        <Text variant="bodySemibold">{t(`checkinDetail.status_${checkin.status}`)}</Text>
        {day && checkin.status !== 'honest_miss'
          ? day.tasks.map((task, i) => {
              const v = checkin.values.find((x) => x.t === i)?.v;
              const met =
                task.type === 'check'
                  ? v === true
                  : typeof v === 'number' && v >= (task.target ?? 1);
              const Icon = met ? CheckCircle2 : Circle;
              return (
                <View key={task.id} style={styles.taskRow}>
                  <Icon
                    size={20}
                    color={met ? colors.success : colors.missed}
                    strokeWidth={iconStroke}
                  />
                  <View style={styles.flex}>
                    <Text variant="body">{task.title}</Text>
                    <Text variant="footnote" color="label2">
                      {taskMeta(task, v)}
                    </Text>
                  </View>
                </View>
              );
            })
          : null}
        {checkin.note ? <Text variant="body">{checkin.note}</Text> : null}
        {photoUrl || localPhoto ? (
          <Image
            source={{ uri: photoUrl ?? localPhoto ?? '' }}
            style={styles.photo}
            contentFit="cover"
            accessibilityIgnoresInvertColors
          />
        ) : checkin.hasPhoto ? (
          <Text variant="footnote" color="label2">
            {t('checkinDetail.proofLocal', { name })}
          </Text>
        ) : null}
        <Pressable
          onPress={fire}
          hitSlop={{ top: 7, bottom: 7 }}
          accessibilityRole="button"
          accessibilityState={{ selected: checkin.reactedByMe }}
          accessibilityLabel={t(checkin.reactedByMe ? 'squad.fireOn' : 'squad.fire', {
            n: checkin.reactionCount,
          })}
          style={[styles.fire, checkin.reactedByMe ? styles.fireOn : styles.fireOff]}
        >
          <Flame
            size={16}
            color={checkin.reactedByMe ? colors.onAccent : colors.accent}
            fill={checkin.reactedByMe ? colors.onAccent : 'none'}
            strokeWidth={iconStroke}
          />
          <Text
            style={[
              styles.fireText,
              { color: checkin.reactedByMe ? colors.onAccent : colors.accent },
            ]}
            tabular
          >
            {String(checkin.reactionCount)}
          </Text>
        </Pressable>
      </View>

      <Text variant="bodySemibold" style={styles.heading} accessibilityRole="header">
        {t('checkinDetail.comments')}
      </Text>
      <View style={styles.card}>
        {comments.isPending ? (
          <SkeletonCard />
        ) : comments.isError ? (
          <ErrorState
            message={errorMessage(comments.error)}
            onRetry={() => void comments.refetch()}
          />
        ) : comments.data.comments.length === 0 ? (
          <Text variant="body" color="label2">
            {t('checkinDetail.noComments')}
          </Text>
        ) : (
          comments.data.comments.map((c) => {
            const own = c.user.id === me.id;
            return (
              <View key={c.id} style={styles.comment}>
                <Avatar
                  name={c.user.displayName}
                  id={c.user.id}
                  color={c.user.avatarColor}
                  size={28}
                  decorative
                />
                <View style={styles.flex}>
                  <Text variant="footnoteSemibold">
                    {own ? t('squad.you') : c.user.displayName}
                    <Text
                      variant="footnote"
                      color="label3"
                    >{`  ${formatTime(new Date(c.createdAt))}`}</Text>
                  </Text>
                  <Text variant="body">{c.body}</Text>
                </View>
                {own ? (
                  <IconButton
                    icon={Trash2}
                    size={36}
                    background="transparent"
                    color="label3"
                    accessibilityLabel={t('checkinDetail.deleteComment')}
                    onPress={() => remove(c)}
                  />
                ) : (
                  <IconButton
                    icon={Flag}
                    size={36}
                    background="transparent"
                    color="label3"
                    accessibilityLabel={t('checkinDetail.reportComment')}
                    onPress={() => setReport({ targetType: 'comment', targetId: c.id })}
                  />
                )}
              </View>
            );
          })
        )}
      </View>
      <Text variant="caption" color="label3" style={styles.expiry}>
        {t('checkinDetail.expiry', { days: retention })}
      </Text>

      <BottomSheet
        visible={menu}
        onClose={() => setMenu(false)}
        accessibilityLabel={t('checkinDetail.more')}
      >
        <View style={styles.menu}>
          <Button
            label={t('checkinDetail.report')}
            variant="secondary"
            onPress={() => {
              setMenu(false);
              setReport({ targetType: 'checkin', targetId: checkin.id });
            }}
          />
          <Button
            label={t('checkinDetail.block', { name })}
            variant="destructive"
            onPress={() => {
              setMenu(false);
              confirmBlock(
                { id: checkin.userId, name },
                (m) => {
                  toast.show({ message: m, kind: 'success' });
                  router.back();
                },
                (m) => toast.show({ message: m, kind: 'error' }),
              );
            }}
          />
        </View>
      </BottomSheet>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4, marginBottom: 16 },
  card: { backgroundColor: colors.surface, borderRadius: radius.list, padding: 16, gap: 12 },
  taskRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: radius.button },
  fire: {
    alignSelf: 'flex-start',
    minHeight: 30,
    borderRadius: 15,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  fireOff: { backgroundColor: colors.accentSoft },
  fireOn: { backgroundColor: colors.accent },
  fireText: { fontFamily: fonts.sansSemibold, fontSize: 13 },
  heading: { marginTop: 20, marginBottom: 8, marginHorizontal: 4 },
  comment: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  expiry: { marginTop: 6, marginHorizontal: 4 },
  composer: { flexDirection: 'row', alignItems: 'flex-end', gap: 8 },
  menu: { gap: 10, paddingBottom: 8 },
});
