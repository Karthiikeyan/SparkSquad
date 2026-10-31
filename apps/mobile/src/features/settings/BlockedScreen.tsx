import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { UserX } from 'lucide-react-native';
import { StyleSheet } from 'react-native';
import {
  Avatar,
  Button,
  EmptyState,
  ErrorState,
  GroupedList,
  ListRow,
  NavHeader,
  Screen,
  SkeletonCard,
  Text,
  useToast,
} from '../../components/ui';
import { t } from '../../i18n';
import { endpoints } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/errors';
import { useOnline } from '../../lib/hooks/useOnline';
import { syncSoon } from '../squads/actions';

const dateFmt = new Intl.DateTimeFormat('en-GB', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
});

export const blocksKey = ['blocks'] as const;

/** F12: people I've blocked, with Unblock. */
export function BlockedScreen() {
  const online = useOnline();
  const toast = useToast();
  const qc = useQueryClient();
  const list = useQuery({ queryKey: blocksKey, queryFn: endpoints.blocks, enabled: online });
  const unblock = useMutation({
    mutationFn: (u: { id: string; name: string }) => endpoints.unblock(u.id),
    onSuccess: (_r, u) => {
      toast.show({ message: t('blocked.unblocked', { name: u.name }), kind: 'success' });
      void qc.invalidateQueries({ queryKey: blocksKey });
      syncSoon();
    },
    onError: (e) => toast.show({ message: errorMessage(e), kind: 'error' }),
  });

  let body;
  if (!online && !list.data) body = <ErrorState message={t('errors.NETWORK')} />;
  else if (list.isPending) body = <SkeletonCard />;
  else if (list.isError) body = <ErrorState onRetry={() => void list.refetch()} />;
  else if (list.data.blocked.length === 0)
    body = <EmptyState icon={UserX} message={t('blocked.empty')} />;
  else
    body = (
      <GroupedList>
        {list.data.blocked.map(({ user, createdAt }) => (
          <ListRow
            key={user.id}
            leading={
              <Avatar
                name={user.displayName}
                id={user.id}
                color={user.avatarColor}
                size={32}
                decorative
              />
            }
            title={user.displayName}
            subtitle={t('blocked.since', { date: dateFmt.format(new Date(createdAt)) })}
            accessory={
              <Button
                label={t('blocked.unblock')}
                variant="secondary"
                size="sm"
                accessibilityLabel={t('blocked.unblockLabel', { name: user.displayName })}
                loading={unblock.isPending && unblock.variables?.id === user.id}
                disabled={!online}
                onPress={() => unblock.mutate({ id: user.id, name: user.displayName })}
              />
            }
          />
        ))}
      </GroupedList>
    );

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('blocked.title')}
      </Text>
      {body}
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
});
