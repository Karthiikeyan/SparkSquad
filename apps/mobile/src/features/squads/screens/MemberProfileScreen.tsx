import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  NavHeader,
  Screen,
  StatTile,
  Text,
  useToast,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { useMe } from '../../auth/SessionProvider';
import { confirmBlock, ReportSheet, type ReportTarget } from '../../safety/ReportSheet';
import { currentRuns, restChecker } from '../model';
import { useSquad } from '../useSquad';
import { todayFor } from '../../today/model';

/** C8: public profile inside a squad: name, avatar, consistency and current run. No private data. */
export function MemberProfileScreen() {
  const { id = '', squadId = '' } = useLocalSearchParams<{ id: string; squadId?: string }>();
  const me = useMe();
  const toast = useToast();
  const squad = useSquad(squadId);
  const members = useQuery({
    queryKey: ['members', squadId],
    queryFn: () => endpoints.squadMembers(squadId),
    enabled: !!squadId,
  });
  const [report, setReport] = useState<ReportTarget | null>(null);

  const src = squad.data;
  const local = src?.members.find((m) => m.userId === id);
  const remote = members.data?.members.find((m) => m.user.id === id);
  const name = remote?.user.displayName ?? local?.name ?? '';
  const username = remote?.user.username ?? local?.username ?? null;
  const color = remote?.user.avatarColor ?? local?.avatarColor ?? 0;
  const today = todayFor(me, new Date());
  const run = src?.challenge
    ? (currentRuns(src.checkins, today, restChecker(src)).get(id) ?? 0)
    : 0;
  const isMe = id === me.id;

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <View style={styles.head}>
        <Avatar name={name || '?'} id={id} color={color} size={56} decorative />
        <View style={styles.flex}>
          <Text variant="title2" accessibilityRole="header">
            {isMe ? t('squad.you') : name}
          </Text>
          {username ? <Text variant="footnote" color="label2">{`@${username}`}</Text> : null}
        </View>
      </View>
      {remote?.consistency !== undefined && remote?.consistency !== null ? (
        <View style={styles.stats}>
          <StatTile
            value={`${remote.consistency}%`}
            label={t('profilePublic.consistency')}
            accent
          />
          <StatTile value={String(run)} label={t('profilePublic.run')} />
        </View>
      ) : (
        <Text variant="body" color="label2">
          {t('profilePublic.noData')}
        </Text>
      )}
      {!isMe ? (
        <View style={styles.actions}>
          <Button
            label={t('profilePublic.report')}
            variant="secondary"
            style={styles.flex}
            onPress={() => setReport({ targetType: 'user', targetId: id })}
          />
          <Button
            label={t('profilePublic.block')}
            variant="destructive"
            style={styles.flex}
            onPress={() =>
              confirmBlock(
                { id, name },
                (m) => {
                  toast.show({ message: m, kind: 'success' });
                  router.back();
                },
                (m) => toast.show({ message: m, kind: 'error' }),
              )
            }
          />
        </View>
      ) : null}
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 14, marginTop: 4, marginBottom: 20 },
  stats: { flexDirection: 'row', gap: 8 },
  actions: { flexDirection: 'row', gap: 10, marginTop: 24 },
});
