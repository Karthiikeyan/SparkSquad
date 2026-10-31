import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { UserCheck } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  NavHeader,
  Screen,
  SkeletonCard,
  Text,
  useToast,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage } from '../../../lib/api/errors';
import { formatLocalDate } from '../../../lib/format';
import { colors, radius } from '../../../theme/tokens';
import { syncSoon } from '../actions';

/** C9: approve or decline each request, or approve all. */
export function RequestsScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const queryClient = useQueryClient();
  const list = useQuery({ queryKey: ['requests', id], queryFn: () => endpoints.squadRequests(id) });
  const [busy, setBusy] = useState<string | null>(null);

  const after = (message: string) => {
    toast.show({ message, kind: 'success' });
    void queryClient.invalidateQueries({ queryKey: ['requests', id] });
    void queryClient.invalidateQueries({ queryKey: ['members', id] });
    syncSoon();
  };
  const decide = async (userId: string, approve: boolean) => {
    setBusy(userId);
    try {
      await endpoints.decideRequest(id, userId, approve);
      after(t(approve ? 'requests.approved' : 'requests.declined'));
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };
  const approveAll = async () => {
    setBusy('*');
    try {
      await endpoints.approveAll(id);
      after(t('requests.approved'));
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  let body;
  if (list.isPending) body = <SkeletonCard />;
  else if (list.isError)
    body = <ErrorState message={errorMessage(list.error)} onRetry={() => void list.refetch()} />;
  else if (list.data.requests.length === 0)
    body = <EmptyState icon={UserCheck} message={t('requests.empty')} />;
  else
    body = (
      <View style={styles.group}>
        {list.data.requests.map((r, i) => (
          <View key={r.user.id} style={[styles.row, i > 0 && styles.separator]}>
            <Avatar
              name={r.user.displayName}
              id={r.user.id}
              color={r.user.avatarColor}
              size={32}
              decorative
            />
            <View style={styles.texts}>
              <Text variant="bodyMedium" numberOfLines={1}>
                {r.user.displayName}
              </Text>
              <Text variant="caption" color="label2">
                {t('requests.asked', { date: formatLocalDate(r.joinedAt.slice(0, 10)) })}
              </Text>
            </View>
            <Button
              label={t('requests.decline')}
              variant="secondary"
              size="sm"
              accessibilityLabel={t('requests.declineLabel', { name: r.user.displayName })}
              disabled={busy !== null}
              onPress={() => void decide(r.user.id, false)}
            />
            <Button
              label={t('requests.approve')}
              variant="soft"
              size="sm"
              accessibilityLabel={t('requests.approveLabel', { name: r.user.displayName })}
              loading={busy === r.user.id}
              disabled={busy !== null && busy !== r.user.id}
              onPress={() => void decide(r.user.id, true)}
            />
          </View>
        ))}
      </View>
    );

  return (
    <Screen
      header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}
      footer={
        (list.data?.requests.length ?? 0) > 1 ? (
          <Button
            label={t('requests.approveAll')}
            onPress={() => void approveAll()}
            loading={busy === '*'}
          />
        ) : undefined
      }
    >
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('requests.title')}
      </Text>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  group: { backgroundColor: colors.surface, borderRadius: radius.list, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minHeight: 60 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  texts: { flex: 1, gap: 1, minWidth: 0 },
});
