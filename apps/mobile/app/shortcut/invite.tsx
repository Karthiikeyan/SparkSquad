import { Redirect, router } from 'expo-router';
import { Users } from 'lucide-react-native';
import {
  EmptyState,
  GroupedList,
  ListRow,
  NavHeader,
  Screen,
  SkeletonCard,
  Text,
} from '../../src/components/ui';
import { useMe } from '../../src/features/auth/SessionProvider';
import { readMySquadIds, readSquadSource } from '../../src/features/squads/source';
import { t } from '../../src/i18n';
import { qk } from '../../src/lib/query/keys';
import { useLocalQuery } from '../../src/lib/query/useLocalQuery';

/** Target of the "Invite" app-icon shortcut: one squad goes straight there, several get a choice. */
export default function InviteShortcut() {
  const me = useMe();
  const squads = useLocalQuery([...qk.squads, 'invite-shortcut', me.id], async (db) => {
    const rows: { id: string; name: string }[] = [];
    for (const id of await readMySquadIds(db)) {
      const src = await readSquadSource(db, me, id);
      if (src) rows.push({ id, name: src.squad.name });
    }
    return rows;
  });
  const header = <NavHeader backLabel={t('common.back')} onBack={() => router.replace('/today')} />;

  if (squads.isPending) {
    return (
      <Screen header={header}>
        <SkeletonCard />
      </Screen>
    );
  }
  const list = squads.data ?? [];
  const only = list.length === 1 ? list[0] : undefined;
  if (only) return <Redirect href={{ pathname: '/squad/[id]/invite', params: { id: only.id } }} />;
  return (
    <Screen header={header}>
      <Text variant="title1" accessibilityRole="header">
        {t('shortcuts.inviteTitle')}
      </Text>
      {list.length === 0 ? (
        <EmptyState
          icon={Users}
          message={t('empty.squads')}
          actionLabel={t('squads.start')}
          onAction={() => router.replace('/create/basics')}
        />
      ) : (
        <GroupedList style={{ marginTop: 16 }}>
          {list.map((s) => (
            <ListRow
              key={s.id}
              title={s.name}
              chevron
              onPress={() =>
                router.replace({ pathname: '/squad/[id]/invite', params: { id: s.id } })
              }
            />
          ))}
        </GroupedList>
      )}
    </Screen>
  );
}
