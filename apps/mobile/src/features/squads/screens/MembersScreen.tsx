import type { MemberDTO, Role } from '@sparksquad/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  Avatar,
  BottomSheet,
  Button,
  ErrorState,
  NavHeader,
  Pressable,
  Screen,
  SkeletonCard,
  Text,
  useToast,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import { colors, radius } from '../../../theme/tokens';
import { useMe } from '../../auth/SessionProvider';
import { confirmBlock, ReportSheet, type ReportTarget } from '../../safety/ReportSheet';
import { syncSoon } from '../actions';
import { useSquad } from '../useSquad';

type Member = MemberDTO & { consistency: number | null };

const ROLE_KEY = {
  owner: 'squads.roleOwner',
  admin: 'squads.roleAdmin',
  member: 'squads.roleMember',
} as const;

const monthYear = new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' });

/** Which management actions I may take on `target` (server enforces the same rules). */
export function memberActions(myRole: Role | null, target: Pick<Member, 'role'>, isMe: boolean) {
  const owner = myRole === 'owner';
  const admin = myRole === 'admin';
  return {
    promote: owner && !isMe && target.role === 'member',
    demote: owner && !isMe && target.role === 'admin',
    remove: !isMe && target.role !== 'owner' && (owner || (admin && target.role === 'member')),
    report: !isMe,
  };
}

/** C7: roles, joined date, consistency %; owner/admin actions; report and block for everyone. */
export function MembersScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const me = useMe();
  const toast = useToast();
  const queryClient = useQueryClient();
  const squad = useSquad(id);
  const list = useQuery({ queryKey: ['members', id], queryFn: () => endpoints.squadMembers(id) });
  const [active, setActive] = useState<Member | null>(null);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const myRole = squad.data?.myRole ?? null;

  const done = (message: string) => {
    toast.show({ message, kind: 'success' });
    void queryClient.invalidateQueries({ queryKey: ['members', id] });
    syncSoon();
  };
  const fail = (e: unknown) => toast.show({ message: errorMessage(e), kind: 'error' });

  const setRole = (m: Member, role: 'admin' | 'member') => {
    setActive(null);
    endpoints
      .setRole(id, m.user.id, role)
      .then(() =>
        done(
          t('members.roleChanged', {
            name: m.user.displayName,
            role: t(role === 'admin' ? 'members.roleAdmin' : 'members.roleMember'),
          }),
        ),
      )
      .catch(fail);
  };
  const remove = (m: Member) => {
    setActive(null);
    Alert.alert(t('members.removeConfirm', { name: m.user.displayName }), t('members.removeBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('members.remove'),
        style: 'destructive',
        onPress: () => {
          endpoints
            .removeMember(id, m.user.id)
            .then(() => done(t('members.removed', { name: m.user.displayName })))
            .catch(fail);
        },
      },
    ]);
  };

  let body;
  if (list.isPending) body = <SkeletonCard />;
  else if (list.isError)
    body = <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />;
  else
    body = (
      <View style={styles.group}>
        {list.data.members.map((m, i) => {
          const isMe = m.user.id === me.id;
          const name = isMe ? t('squad.you') : m.user.displayName;
          const sub = [
            t(ROLE_KEY[m.role]),
            t('members.joined', { date: monthYear.format(new Date(m.joinedAt)) }),
          ].join(', ');
          return (
            <Pressable
              key={m.user.id}
              noScale
              onPress={() => setActive(m)}
              accessibilityRole="button"
              accessibilityLabel={`${name}, ${sub}${m.consistency !== null ? `, ${t('members.consistency', { n: m.consistency })}` : ''}`}
              accessibilityHint={t('members.actions', { name })}
              style={[styles.row, i > 0 && styles.separator]}
            >
              <Avatar
                name={m.user.displayName}
                id={m.user.id}
                color={m.user.avatarColor}
                size={32}
                decorative
              />
              <View style={styles.texts}>
                <Text variant="bodyMedium" numberOfLines={1}>
                  {name}
                </Text>
                <Text variant="caption" color="label2">
                  {sub}
                </Text>
              </View>
              {m.consistency !== null ? (
                <Text variant="bodySemibold" tabular>{`${m.consistency}%`}</Text>
              ) : null}
            </Pressable>
          );
        })}
      </View>
    );

  const acts = active ? memberActions(myRole, active, active.user.id === me.id) : null;
  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('members.title')}
      </Text>
      {body}
      <BottomSheet
        visible={!!active}
        onClose={() => setActive(null)}
        accessibilityLabel={active ? t('members.actions', { name: active.user.displayName }) : ''}
      >
        {active && acts ? (
          <View style={styles.sheet}>
            <Text variant="title2">{active.user.displayName}</Text>
            <Button
              label={t('members.viewProfile')}
              variant="secondary"
              onPress={() => {
                const target = active;
                setActive(null);
                router.push({
                  pathname: '/user/[id]',
                  params: { id: target.user.id, squadId: id },
                });
              }}
            />
            {acts.promote ? (
              <Button
                label={t('members.makeAdmin')}
                variant="secondary"
                onPress={() => setRole(active, 'admin')}
              />
            ) : null}
            {acts.demote ? (
              <Button
                label={t('members.makeMember')}
                variant="secondary"
                onPress={() => setRole(active, 'member')}
              />
            ) : null}
            {acts.report ? (
              <Button
                label={t('members.report', { name: active.user.displayName })}
                variant="secondary"
                onPress={() => {
                  const target = active;
                  setActive(null);
                  setReport({ targetType: 'user', targetId: target.user.id });
                }}
              />
            ) : null}
            {acts.report ? (
              <Button
                label={t('checkinDetail.block', { name: active.user.displayName })}
                variant="destructive"
                onPress={() => {
                  const target = active;
                  setActive(null);
                  confirmBlock({ id: target.user.id, name: target.user.displayName }, done, (m) =>
                    toast.show({ message: m, kind: 'error' }),
                  );
                }}
              />
            ) : null}
            {acts.remove ? (
              <Button
                label={t('members.remove')}
                variant="destructive"
                onPress={() => remove(active)}
              />
            ) : null}
          </View>
        ) : null}
      </BottomSheet>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  group: { backgroundColor: colors.surface, borderRadius: radius.list, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  texts: { flex: 1, gap: 1, minWidth: 0 },
  sheet: { gap: 10, paddingBottom: 8 },
});
