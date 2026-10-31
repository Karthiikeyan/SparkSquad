import {
  CATEGORIES,
  chatUrlSchema,
  TEXT_LIMITS,
  type Category,
  type Privacy,
  type SquadDTO,
  type UpdateSquadInput,
} from '@sparksquad/shared';
import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  BottomSheet,
  Button,
  ChipToggle,
  ErrorState,
  GroupedList,
  GroupFooter,
  ListRow,
  NavHeader,
  Screen,
  SectionLabel,
  SegmentedControl,
  SkeletonCard,
  Switch,
  Text,
  TextField,
  useToast,
} from '../../../components/ui';
import { t } from '../../../i18n';
import { endpoints } from '../../../lib/api/endpoints';
import { errorMessage, isApiError } from '../../../lib/api/errors';
import { formatLocalDate } from '../../../lib/format';
import { refresh } from '../../../lib/runtime';
import { colors } from '../../../theme/tokens';
import { ReportSheet, type ReportTarget } from '../../safety/ReportSheet';
import { syncSoon } from '../actions';
import { canManage } from '../model';
import { useSquad } from '../useSquad';

/** Only the fields that changed (PATCH). */
export function squadChanges(before: SquadDTO, after: UpdateSquadInput): UpdateSquadInput {
  const out: UpdateSquadInput = {};
  for (const [k, v] of Object.entries(after) as [keyof UpdateSquadInput, unknown][]) {
    if (v !== undefined && v !== before[k as keyof SquadDTO])
      (out as Record<string, unknown>)[k] = v;
  }
  return out;
}

function DetailsForm({ squad, onSaved }: { squad: SquadDTO; onSaved: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(squad.name);
  const [description, setDescription] = useState(squad.description);
  const [rules, setRules] = useState(squad.rules);
  const [category, setCategory] = useState<Category>(squad.category);
  const [privacy, setPrivacy] = useState<Privacy>(squad.privacy);
  const [chatUrl, setChatUrl] = useState(squad.chatUrl ?? '');
  const [targets, setTargets] = useState(squad.allowPersonalTargets);
  const [partial, setPartial] = useState(squad.partialCounts);
  const [chatError, setChatError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const save = async () => {
    const url = chatUrl.trim();
    if (url && !chatUrlSchema.safeParse(url).success) {
      setChatError(t('errors.VALIDATION_FAILED'));
      return;
    }
    const changes = squadChanges(squad, {
      name: name.trim(),
      description: description.trim(),
      rules: rules.trim(),
      category,
      privacy,
      chatUrl: url || null,
      allowPersonalTargets: targets,
      partialCounts: partial,
    });
    if (Object.keys(changes).length === 0) return;
    setSaving(true);
    try {
      await endpoints.updateSquad(squad.id, changes);
      toast.show({ message: t('settings.saved'), kind: 'success' });
      onSaved();
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.form}>
      <TextField
        label={t('settings.name')}
        value={name}
        onChangeText={setName}
        maxLength={TEXT_LIMITS.squadName}
      />
      <TextField
        label={t('settings.description')}
        value={description}
        onChangeText={setDescription}
        multiline
        counter={TEXT_LIMITS.squadDescription}
      />
      <TextField
        label={t('settings.rules')}
        value={rules}
        onChangeText={setRules}
        multiline
        counter={TEXT_LIMITS.squadRules}
      />
      <View>
        <Text variant="footnote" color="label2" style={styles.label}>
          {t('settings.category')}
        </Text>
        <View
          style={styles.chips}
          accessibilityRole="radiogroup"
          accessibilityLabel={t('settings.category')}
        >
          {CATEGORIES.map((c) => (
            <ChipToggle
              key={c}
              label={t(`categories.${c}`)}
              role="radio"
              selected={category === c}
              onPress={() => setCategory(c)}
            />
          ))}
        </View>
      </View>
      <View>
        <Text variant="footnote" color="label2" style={styles.label}>
          {t('settings.privacy')}
        </Text>
        <SegmentedControl
          role="radiogroup"
          accessibilityLabel={t('settings.privacy')}
          value={privacy}
          onChange={setPrivacy}
          options={[
            { value: 'private', label: t('settings.private') },
            { value: 'public', label: t('settings.public') },
          ]}
        />
        <Text variant="caption" color="label3" style={styles.help}>
          {t('settings.privacyHelp')}
        </Text>
      </View>
      <TextField
        label={t('settings.chatUrl')}
        placeholder={t('settings.chatPlaceholder')}
        value={chatUrl}
        onChangeText={(v) => {
          setChatUrl(v);
          setChatError(undefined);
        }}
        error={chatError}
        autoCapitalize="none"
        keyboardType="url"
      />
      <View style={styles.switchRow}>
        <Text variant="body" style={styles.flex}>
          {t('settings.personalTargets')}
        </Text>
        <Switch
          value={targets}
          onValueChange={setTargets}
          accessibilityLabel={t('settings.personalTargets')}
        />
      </View>
      <View style={styles.switchRow}>
        <Text variant="body" style={styles.flex}>
          {t('settings.partialCounts')}
        </Text>
        <Switch
          value={partial}
          onValueChange={setPartial}
          accessibilityLabel={t('settings.partialCounts')}
        />
      </View>
      <Button label={t('settings.save')} onPress={() => void save()} loading={saving} />
    </View>
  );
}

/** C12: pin or unpin the announcement (≤500). */
function AnnouncementSheet({
  squadId,
  current,
  visible,
  onClose,
}: {
  squadId: string;
  current: string | null;
  visible: boolean;
  onClose: () => void;
}) {
  const toast = useToast();
  const [body, setBody] = useState(current ?? '');
  const [busy, setBusy] = useState(false);
  const submit = async (value: string | null) => {
    setBusy(true);
    try {
      await endpoints.setAnnouncement(squadId, value);
      syncSoon();
      toast.show({
        message: t(value ? 'announcementSheet.pinned' : 'announcementSheet.unpinned'),
        kind: 'success',
      });
      onClose();
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet
      visible={visible}
      onClose={onClose}
      accessibilityLabel={t('announcementSheet.title')}
    >
      <View style={styles.sheet}>
        <Text variant="title2" accessibilityRole="header">
          {t('announcementSheet.title')}
        </Text>
        <TextField
          placeholder={t('announcementSheet.placeholder')}
          accessibilityLabel={t('announcementSheet.title')}
          value={body}
          onChangeText={setBody}
          multiline
          counter={TEXT_LIMITS.announcement}
        />
        <Button
          label={t('announcementSheet.pin')}
          onPress={() => void submit(body.trim())}
          disabled={!body.trim()}
          loading={busy}
        />
        {current ? (
          <Button
            label={t('announcementSheet.unpin')}
            variant="destructive"
            onPress={() => void submit(null)}
            disabled={busy}
          />
        ) : null}
      </View>
    </BottomSheet>
  );
}

function confirm(title: string, body: string, action: string, onOk: () => void) {
  Alert.alert(title, body, [
    { text: t('common.cancel'), style: 'cancel' },
    { text: action, style: 'destructive', onPress: onOk },
  ]);
}

/** C11: details (owner), manage rows, past challenges, transfer / end / delete / leave / report. */
export function SquadSettingsScreen() {
  const { id = '' } = useLocalSearchParams<{ id: string }>();
  const toast = useToast();
  const squad = useSquad(id);
  const history = useQuery({
    queryKey: ['history', id],
    queryFn: () => endpoints.squadHistory(id),
  });
  const [announce, setAnnounce] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [report, setReport] = useState<ReportTarget | null>(null);
  const header = <NavHeader backLabel={t('common.back')} onBack={() => router.back()} />;

  if (squad.isPending)
    return (
      <Screen header={header}>
        <SkeletonCard />
      </Screen>
    );
  if (!squad.data)
    return (
      <Screen header={header}>
        <ErrorState message={t('squad.notFound')} />
      </Screen>
    );
  const src = squad.data;
  const sq = src.squad;
  const owner = src.myRole === 'owner';
  const manager = canManage(src.myRole);
  const fail = (e: unknown) => toast.show({ message: errorMessage(e), kind: 'error' });
  const goHome = (message: string) => {
    toast.show({ message, kind: 'success' });
    refresh().catch(() => undefined);
    router.dismissTo('/squads');
  };
  const push = (pathname: '/squad/[id]/members' | '/squad/[id]/requests' | '/squad/[id]/invite') =>
    router.push({ pathname, params: { id } });

  const others = src.members.filter((m) => m.userId !== src.me.id);

  return (
    <Screen header={header}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('settings.title')}
      </Text>

      {owner ? (
        <>
          <SectionLabel>{t('settings.details')}</SectionLabel>
          <DetailsForm squad={sq} onSaved={syncSoon} />
        </>
      ) : null}

      <SectionLabel>{t('settings.manage')}</SectionLabel>
      <GroupedList style={styles.group}>
        {manager ? (
          <ListRow
            title={t('settings.announcement')}
            value={src.announcement ? undefined : t('settings.announcementNone')}
            subtitle={src.announcement?.body}
            chevron
            onPress={() => setAnnounce(true)}
          />
        ) : null}
        <ListRow
          title={t('settings.members')}
          value={String(src.members.length)}
          chevron
          onPress={() => push('/squad/[id]/members')}
        />
        {manager && sq.privacy === 'private' ? (
          <ListRow
            title={t('settings.requests')}
            chevron
            onPress={() => push('/squad/[id]/requests')}
          />
        ) : null}
        <ListRow title={t('settings.invite')} chevron onPress={() => push('/squad/[id]/invite')} />
      </GroupedList>

      <SectionLabel>{t('settings.history')}</SectionLabel>
      {history.isPending ? (
        <SkeletonCard />
      ) : history.isError || history.data.challenges.length === 0 ? (
        <GroupFooter>{t('settings.historyEmpty')}</GroupFooter>
      ) : (
        <GroupedList style={styles.group}>
          {history.data.challenges.map((c) => (
            <ListRow
              key={c.id}
              title={c.title}
              subtitle={
                c.endedAt
                  ? t('history.ended', { date: formatLocalDate(c.endedAt.slice(0, 10)) })
                  : undefined
              }
              chevron
              onPress={() =>
                router.push({
                  pathname: '/squad/[id]/history/[challengeId]',
                  params: { id, challengeId: c.id },
                })
              }
            />
          ))}
        </GroupedList>
      )}

      <SectionLabel>{t('settings.danger')}</SectionLabel>
      <GroupedList style={styles.group}>
        {owner && others.length > 0 ? (
          <ListRow title={t('settings.transfer')} chevron onPress={() => setTransfer(true)} />
        ) : null}
        {owner && src.challenge ? (
          <ListRow
            title={t('settings.endChallenge')}
            destructive
            onPress={() =>
              confirm(
                t('settings.endConfirm', { title: src.challenge!.title }),
                t('settings.endBody'),
                t('settings.endChallenge'),
                () => {
                  endpoints
                    .endChallenge(src.challenge!.id)
                    .then(() => {
                      syncSoon();
                      toast.show({ message: t('settings.ended'), kind: 'success' });
                    })
                    .catch(fail);
                },
              )
            }
          />
        ) : null}
        {!owner ? (
          <ListRow
            title={t('settings.report')}
            onPress={() => setReport({ targetType: 'squad', targetId: id })}
          />
        ) : null}
        {!owner ? (
          <ListRow
            title={t('settings.leave')}
            destructive
            onPress={() =>
              confirm(
                t('settings.leaveConfirm', { squad: sq.name }),
                t('settings.leaveBody'),
                t('settings.leave'),
                () => {
                  endpoints
                    .leaveSquad(id)
                    .then(() => goHome(t('settings.left', { squad: sq.name })))
                    .catch((e: unknown) => {
                      if (isApiError(e) && e.code === 'OWNER_MUST_TRANSFER')
                        toast.show({ message: t('settings.ownerMustTransfer'), kind: 'error' });
                      else fail(e);
                    });
                },
              )
            }
          />
        ) : null}
        {owner ? (
          <ListRow
            title={t('settings.delete')}
            destructive
            onPress={() =>
              confirm(
                t('settings.deleteConfirm', { squad: sq.name }),
                t('settings.deleteBody'),
                t('settings.delete'),
                () => {
                  endpoints
                    .deleteSquad(id)
                    .then(() => goHome(t('settings.deleted')))
                    .catch(fail);
                },
              )
            }
          />
        ) : null}
      </GroupedList>

      <AnnouncementSheet
        squadId={id}
        current={src.announcement?.body ?? null}
        visible={announce}
        onClose={() => setAnnounce(false)}
      />
      <BottomSheet
        visible={transfer}
        onClose={() => setTransfer(false)}
        accessibilityLabel={t('settings.transfer')}
      >
        <View style={styles.sheet}>
          <Text variant="title2">{t('settings.transferPick', { squad: sq.name })}</Text>
          <GroupedList style={styles.sheetList}>
            {others.map((m) => (
              <ListRow
                key={m.userId}
                title={m.name}
                onPress={() => {
                  setTransfer(false);
                  confirm(
                    t('settings.transferConfirm', { name: m.name }),
                    t('settings.transferBody'),
                    t('settings.transfer'),
                    () => {
                      endpoints
                        .transferOwnership(id, m.userId)
                        .then(() => {
                          syncSoon();
                          toast.show({
                            message: t('settings.transferred', { name: m.name }),
                            kind: 'success',
                          });
                        })
                        .catch(fail);
                    },
                  );
                }}
              />
            ))}
          </GroupedList>
        </View>
      </BottomSheet>
      <ReportSheet target={report} onClose={() => setReport(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  form: { gap: 16, marginBottom: 24 },
  label: { marginBottom: 6 },
  help: { marginTop: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  flex: { flex: 1 },
  group: { marginBottom: 24 },
  sheet: { gap: 12, paddingBottom: 8 },
  sheetList: { backgroundColor: colors.surface2 },
});
