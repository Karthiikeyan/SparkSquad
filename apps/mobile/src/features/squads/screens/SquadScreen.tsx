import { addDays } from '@sparksquad/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronRight, MessageCircle, Pin, Settings, Share2 } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  ErrorState,
  IconButton,
  NavHeader,
  Pressable,
  Screen,
  SegmentedControl,
  SkeletonCard,
  Text,
  useToast,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { getRuntime } from '../../../lib/runtime';
import { colors, iconStroke, radius } from '../../../theme/tokens';
import { useMe } from '../../auth/SessionProvider';
import { useRefresh } from '../../system/useRefresh';
import { sendNudge, toggleFire } from '../actions';
import { buildBoard, canManage } from '../model';
import { useSquad } from '../useSquad';
import { BoardSection } from './BoardSection';
import { LeaderboardSection } from './LeaderboardSection';
import { PlanSection } from './PlanSection';

type Tab = 'board' | 'leaderboard' | 'plan';
const isTab = (v: string | undefined): v is Tab =>
  v === 'board' || v === 'leaderboard' || v === 'plan';

function chatApp(url: string): string {
  return /t\.me|telegram\.me/.test(url) ? t('squad.telegram') : t('squad.whatsapp');
}

/** C2–C4: squad board, leaderboard and plan behind one segmented control. */
export function SquadScreen() {
  const { id, tab } = useLocalSearchParams<{ id: string; tab?: string }>();
  const me = useMe();
  const toast = useToast();
  const squad = useSquad(id ?? '');
  const { refreshing, onRefresh } = useRefresh();
  const [section, setSection] = useState<Tab>(isTab(tab) ? tab : 'board');

  const back = () => (router.canGoBack() ? router.back() : router.replace('/squads'));
  const header = (right?: React.ReactNode) => (
    <NavHeader backLabel={t('squad.back')} onBack={back} right={right} />
  );

  if (squad.isPending) {
    return (
      <Screen header={header()}>
        <SkeletonCard />
      </Screen>
    );
  }
  if (squad.isError || !squad.data) {
    return (
      <Screen header={header()} refreshing={refreshing} onRefresh={onRefresh}>
        <ErrorState message={t('squad.notFound')} onRetry={onRefresh} />
      </Screen>
    );
  }

  const src = squad.data;
  const board = buildBoard(src, new Date());
  const ch = src.challenge;
  const meta = ch
    ? t('squad.meta', {
        title: ch.title,
        n: board.dayNumber,
        total: ch.durationDays,
        members: src.members.length,
      })
    : t('squad.metaNoChallenge', { members: src.members.length });

  const nudge = (m: { id: string; name: string }) => {
    if (!ch) return;
    const { db, outbox } = getRuntime();
    sendNudge(db, outbox, {
      challengeId: ch.id,
      fromUserId: me.id,
      toUserId: m.id,
      localDate: board.today,
    })
      .then(() => toast.show({ message: t('squad.nudgeSent', { name: m.name }), kind: 'success' }))
      .catch(() => toast.show({ message: t('errors.UNKNOWN'), kind: 'error' }));
  };
  const fire = (checkinId: string) => {
    const { db, outbox } = getRuntime();
    toggleFire(db, outbox, checkinId).catch(() => undefined);
  };

  const chatUrl = src.squad.chatUrl;
  const footer =
    section === 'board' && chatUrl ? (
      <Pressable
        onPress={() => void Linking.openURL(chatUrl)}
        accessibilityRole="link"
        accessibilityLabel={t('squad.chat', { app: chatApp(chatUrl) })}
        style={styles.chat}
      >
        <MessageCircle size={20} color={colors.label} strokeWidth={iconStroke} />
        <Text variant="body" style={styles.flex}>
          {t('squad.chat', { app: chatApp(chatUrl) })}
        </Text>
        <ChevronRight size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
      </Pressable>
    ) : undefined;

  return (
    <Screen
      header={header(
        <View style={styles.headerRight}>
          {ch ? (
            <IconButton
              icon={Share2}
              background="transparent"
              accessibilityLabel={t('squad.share')}
              onPress={() =>
                router.push({ pathname: '/squad/[id]/share', params: { id: src.squad.id } })
              }
            />
          ) : null}
          <IconButton
            icon={Settings}
            background="transparent"
            accessibilityLabel={t('squad.settings')}
            onPress={() =>
              router.push({ pathname: '/squad/[id]/settings', params: { id: src.squad.id } })
            }
            testID="squad-settings"
          />
        </View>,
      )}
      refreshing={refreshing}
      onRefresh={onRefresh}
      footer={footer}
    >
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {src.squad.name}
      </Text>
      <Pressable
        noScale
        onPress={() =>
          router.push({ pathname: '/squad/[id]/members', params: { id: src.squad.id } })
        }
        accessibilityRole="button"
        accessibilityHint={t('squad.members')}
      >
        <Text variant="body" color="label2" style={styles.meta}>
          {meta}
        </Text>
      </Pressable>

      {src.announcement ? (
        <View
          style={styles.announcement}
          accessible
          accessibilityLabel={`${t('squad.announcement')}: ${src.announcement.body}`}
        >
          <Pin size={16} color={colors.accent} strokeWidth={iconStroke} />
          <Text variant="body" style={styles.flex}>
            {src.announcement.body}
          </Text>
        </View>
      ) : null}

      {ch ? (
        <SegmentedControl
          accessibilityLabel={t('squad.sections')}
          value={section}
          onChange={setSection}
          options={[
            { value: 'board', label: t('squad.board') },
            { value: 'leaderboard', label: t('squad.leaderboard') },
            { value: 'plan', label: t('squad.plan') },
          ]}
          style={styles.segments}
        />
      ) : null}

      {section === 'board' || !ch ? (
        <BoardSection
          board={board}
          onNudge={nudge}
          onFire={fire}
          onSetUpPlan={
            canManage(src.myRole)
              ? () => router.push({ pathname: '/create/plan', params: { squadId: src.squad.id } })
              : undefined
          }
        />
      ) : section === 'leaderboard' ? (
        <LeaderboardSection challengeId={ch.id} />
      ) : (
        <PlanSection src={src} today={board.today} syncedFrom={addDays(board.today, -7)} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRight: { flexDirection: 'row', alignItems: 'center', marginRight: -10 },
  title: { marginTop: 4, marginBottom: 2 },
  meta: { marginBottom: 14 },
  flex: { flex: 1 },
  announcement: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: radius.list,
    padding: 12,
    marginBottom: 14,
  },
  segments: { marginBottom: 16 },
  chat: {
    height: 48,
    borderRadius: radius.input,
    backgroundColor: colors.surface,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
  },
});
