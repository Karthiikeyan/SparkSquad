import type { LucideIcon } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { EmptyState, ErrorState, Screen, SkeletonCard } from '../../components/ui';
import { t } from '../../i18n';
import { squads } from '../../lib/db/schema';
import { qk } from '../../lib/query/keys';
import { useLocalQuery } from '../../lib/query/useLocalQuery';
import { useRefresh } from './useRefresh';

export interface FoundationTabProps {
  title: string;
  subtitle?: string;
  headerRight?: ReactNode;
  emptyIcon: LucideIcon;
  emptyMessage: string;
}

/**
 * Tab root scaffold with loading / empty / error / offline states, reading the local store.
 * Feature phases replace the body with the real screen.
 */
export function FoundationTab({
  title,
  subtitle,
  headerRight,
  emptyIcon,
  emptyMessage,
}: FoundationTabProps) {
  const { refreshing, onRefresh } = useRefresh();
  const query = useLocalQuery(qk.squads, (db) => db.select({ id: squads.id }).from(squads).all());

  let body: ReactNode;
  if (query.isPending) body = <SkeletonCard />;
  else if (query.isError) body = <ErrorState onRetry={() => void query.refetch()} />;
  else if (query.data.length === 0) body = <EmptyState icon={emptyIcon} message={emptyMessage} />;
  else body = <EmptyState icon={emptyIcon} message={t('placeholder.comingSoon')} />;

  return (
    <Screen
      title={title}
      subtitle={subtitle}
      headerRight={headerRight}
      withTabBar
      refreshing={refreshing}
      onRefresh={onRefresh}
    >
      {body}
    </Screen>
  );
}
