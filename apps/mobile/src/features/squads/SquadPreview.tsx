import { compareLocalDates, localDateInZone, type SquadPreviewDTO } from '@sparksquad/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { CalendarDays, Lock, Users } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  Card,
  ErrorState,
  NavHeader,
  Screen,
  SkeletonCard,
  Text,
  useToast,
} from '../../components/ui';
import { t } from '../../i18n';
import { track } from '../../lib/analytics';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage, isApiError } from '../../lib/api/errors';
import { formatLocalDate } from '../../lib/format';
import { qk } from '../../lib/query/keys';
import { refresh } from '../../lib/runtime';
import { colors, iconStroke } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';

export type PreviewSource = { code: string } | { squadId: string };

function sourceKey(s: PreviewSource): string {
  return 'code' in s ? `code:${s.code}` : `id:${s.squadId}`;
}

export type JoinAction = 'join' | 'request' | 'pending' | 'member' | 'closed';

/** What the main button does for this viewer (E3). Private squads need the invite code. */
export function joinAction(p: SquadPreviewDTO, viaCode: boolean): JoinAction {
  if (p.myStatus === 'active') return 'member';
  if (p.myStatus === 'pending') return 'pending';
  if (p.privacy === 'private') return viaCode ? 'request' : 'closed';
  if (p.myStatus === 'removed') return 'closed';
  return 'join';
}

function goHome() {
  if (router.canGoBack()) router.back();
  else router.replace('/today');
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text variant="footnote" color="label2" style={styles.sectionLabel}>
        {title}
      </Text>
      <Card variant="tile">{children}</Card>
    </View>
  );
}

/** E3: public-safe squad details before joining; also the landing for invite links. */
export function SquadPreview({ source }: { source: PreviewSource }) {
  const me = useMe();
  const toast = useToast();
  const queryClient = useQueryClient();
  const key = qk.squadPreview(sourceKey(source));
  const viaCode = 'code' in source;

  const query = useQuery({
    queryKey: key,
    queryFn: () =>
      'code' in source
        ? endpoints.invitePreview(source.code)
        : endpoints.squadPreview(source.squadId),
  });

  const join = useMutation({
    mutationFn: () =>
      endpoints.joinSquad('code' in source ? { code: source.code } : { squadId: source.squadId }),
    onSuccess: (res) => {
      queryClient.setQueryData(key, res.preview);
      track('squad_join', { status: res.status, via: viaCode ? 'code' : 'discover' });
      if (res.status === 'active') {
        toast.show({ message: t('preview.joined', { name: res.preview.name }), kind: 'success' });
        refresh().catch(() => undefined);
        router.replace('/today');
      } else {
        toast.show({
          message: t('preview.requested', { name: res.preview.name }),
          kind: 'success',
        });
      }
    },
    onError: (e) => {
      if (isApiError(e) && (e.code === 'ALREADY_MEMBER' || e.code === 'REQUEST_PENDING')) {
        void query.refetch();
      }
      toast.show({ message: errorMessage(e), kind: 'error' });
    },
  });

  const header = <NavHeader backLabel={t('common.back')} onBack={goHome} />;

  if (query.isPending) {
    return (
      <Screen header={header}>
        <View accessibilityLabel={t('preview.loading')}>
          <SkeletonCard />
        </View>
      </Screen>
    );
  }
  if (query.isError) {
    return (
      <Screen header={header}>
        <ErrorState message={errorMessage(query.error)} onRetry={() => void query.refetch()} />
      </Screen>
    );
  }

  const p = query.data;
  const action = joinAction(p, viaCode);
  const today = localDateInZone(new Date(), me.timezone);
  const ch = p.challenge;

  const footer =
    action === 'member' ? (
      <Button label={t('preview.open')} onPress={() => router.replace('/today')} />
    ) : action === 'pending' ? (
      <View style={styles.footerNote}>
        <Button label={t('preview.pending')} disabled onPress={() => undefined} />
        <Text variant="caption" color="label3" align="center">
          {t('preview.pendingBody')}
        </Text>
      </View>
    ) : action === 'closed' ? null : (
      <View style={styles.footerNote}>
        <Button
          label={t(action === 'join' ? 'preview.join' : 'preview.request')}
          onPress={() => join.mutate()}
          loading={join.isPending}
          testID="preview-join"
        />
        {action === 'request' ? (
          <Text variant="caption" color="label3" align="center">
            {t('preview.requestNote')}
          </Text>
        ) : null}
      </View>
    );

  return (
    <Screen header={header} footer={footer}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {p.name}
      </Text>
      <View style={styles.meta}>
        <View style={styles.metaItem}>
          <Users size={16} color={colors.label2} strokeWidth={iconStroke} />
          <Text variant="footnote" color="label2" tabular>
            {t('preview.members', { count: p.memberCount, limit: p.memberLimit })}
          </Text>
        </View>
        <View style={styles.metaItem}>
          {p.privacy === 'private' ? (
            <Lock size={16} color={colors.label2} strokeWidth={iconStroke} />
          ) : null}
          <Text variant="footnote" color="label2">
            {`${t(`categories.${p.category}`)}, ${t(p.privacy === 'private' ? 'preview.private' : 'preview.public')}`}
          </Text>
        </View>
      </View>

      <View style={styles.owner}>
        <Avatar
          name={p.owner.displayName}
          color={p.owner.avatarColor}
          id={p.owner.id}
          size={32}
          decorative
        />
        <Text variant="body" color="label2">
          {t('preview.owner', { name: p.owner.displayName })}
        </Text>
      </View>

      <Section title={t('preview.plan')}>
        {ch ? (
          <View style={styles.plan}>
            <Text variant="title2">{ch.title}</Text>
            <Text variant="footnote" color="label2">
              {t('preview.planSummary', { days: ch.durationDays, perWeek: ch.daysPerWeek })}
            </Text>
            <View style={styles.metaItem}>
              <CalendarDays size={16} color={colors.accent} strokeWidth={iconStroke} />
              <Text variant="footnote" color="label">
                {t(
                  compareLocalDates(ch.startDate, today) > 0 ? 'preview.starts' : 'preview.started',
                  {
                    date: formatLocalDate(ch.startDate),
                  },
                )}
              </Text>
            </View>
          </View>
        ) : (
          <Text variant="body" color="label2">
            {t('preview.noPlan')}
          </Text>
        )}
      </Section>

      {p.description ? (
        <Section title={t('preview.about')}>
          <Text variant="body">{p.description}</Text>
        </Section>
      ) : null}
      {p.rules ? (
        <Section title={t('preview.rules')}>
          <Text variant="body">{p.rules}</Text>
        </Section>
      ) : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 6 },
  meta: { flexDirection: 'row', flexWrap: 'wrap', gap: 14, marginBottom: 14 },
  metaItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 20 },
  section: { marginBottom: 16 },
  sectionLabel: { marginHorizontal: 4, marginBottom: 6 },
  plan: { gap: 6 },
  footerNote: { gap: 8 },
});
