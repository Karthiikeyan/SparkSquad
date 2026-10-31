import { integrationSchema, TEXT_LIMITS } from '@sparksquad/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, View } from 'react-native';
import {
  Button,
  GroupedList,
  GroupFooter,
  ListRow,
  NavHeader,
  Screen,
  SectionLabel,
  Text,
  TextField,
  useToast,
} from '../../components/ui';
import { t, type TKey } from '../../i18n';
import { endpoints, type IntegrationProvider } from '../../lib/api/endpoints';
import { errorMessage } from '../../lib/api/errors';
import { useOnline } from '../../lib/hooks/useOnline';
import { getPref, setPref } from '../../lib/prefs';
import { colors, radius } from '../../theme/tokens';
import { useMe } from '../auth/SessionProvider';
import { clearVerifyCache } from '../verify/prefill';
import {
  connectSteps,
  disconnectSteps,
  openHealthConnectInstall,
  openHealthSettings,
  stepsConnected,
  stepsStatus,
  type StepsStatus,
} from '../verify/steps';
import { checkHandle } from '../verify/verifiers';

const PROVIDERS: readonly { id: IntegrationProvider; label: TKey; site: TKey }[] = [
  { id: 'github', label: 'integrations.github', site: 'integrations.name_github' },
  { id: 'leetcode', label: 'integrations.leetcode', site: 'integrations.name_leetcode' },
  { id: 'codeforces', label: 'integrations.codeforces', site: 'integrations.name_codeforces' },
];

export const integrationsKey = ['integrations'] as const;

/** Same rule the server applies (public usernames only). */
export const normaliseHandle = (raw: string) => raw.trim().replace(/^@/, '');
export const looksLikeHandle = (h: string) => integrationSchema.safeParse({ handle: h }).success;

/** F7: GitHub / LeetCode / Codeforces handles (validated by a test fetch) and the steps note. */
export function IntegrationsScreen() {
  const online = useOnline();
  const list = useQuery({
    queryKey: integrationsKey,
    queryFn: endpoints.integrations,
    enabled: online,
  });
  const [saved, setSaved] = useState(() => getPref('integrations') ?? {});

  // The server is the source of truth; mirror it so verification works offline.
  useEffect(() => {
    if (!list.data) return;
    const next: Partial<Record<IntegrationProvider, string>> = {};
    for (const i of list.data.integrations) next[i.provider] = i.handle;
    setPref('integrations', next);
    setSaved(next);
  }, [list.data]);

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('integrations.title')}
      </Text>
      <Text variant="body" color="label2" style={styles.body}>
        {t('integrations.body')}
      </Text>
      {list.isError ? (
        <View style={styles.loadError} accessibilityLiveRegion="polite">
          <Text variant="footnote" color="label2" style={styles.flex}>
            {errorMessage(list.error)}
          </Text>
          <Button
            label={t('common.retry')}
            variant="secondary"
            size="sm"
            onPress={() => void list.refetch()}
          />
        </View>
      ) : null}
      {PROVIDERS.map((p) => (
        <HandleCard
          key={p.id}
          provider={p.id}
          label={t(p.label)}
          site={t(p.site)}
          current={saved[p.id] ?? null}
          online={online}
          onSaved={(handle) => {
            const next = { ...saved };
            if (handle) next[p.id] = handle;
            else delete next[p.id];
            setPref('integrations', next);
            setSaved(next);
          }}
        />
      ))}
      <SectionLabel>{t('integrations.steps')}</SectionLabel>
      <StepsRow />
    </Screen>
  );
}

/** Health Connect (Android) / Apple Health (iOS) steps: connect, open install page, or explain. */
function StepsRow() {
  const toast = useToast();
  const [status, setStatus] = useState<StepsStatus | null>(null);
  const [connected, setConnected] = useState(stepsConnected());
  const [busy, setBusy] = useState(false);
  const source = t(
    Platform.OS === 'ios' ? 'integrations.name_appleHealth' : 'integrations.name_healthConnect',
  );

  useEffect(() => {
    let alive = true;
    stepsStatus().then((s) => {
      if (alive) setStatus(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  const connect = async () => {
    setBusy(true);
    const ok = await connectSteps();
    setBusy(false);
    setConnected(ok);
    if (ok) {
      toast.show({ message: t('integrations.stepsConnected', { source }), kind: 'success' });
      return;
    }
    // G5: explain and offer the place to change it.
    Alert.alert(t('integrations.stepsDenied'), undefined, [
      { text: t('common.notNow'), style: 'cancel' },
      { text: t('notificationsSettings.openSettings'), onPress: openHealthSettings },
    ]);
  };

  let accessory = null;
  let footer = t('integrations.stepsBody', { source });
  if (status === 'available') {
    accessory = connected ? (
      <Button
        label={t('integrations.remove')}
        variant="destructive"
        size="sm"
        onPress={() => {
          disconnectSteps();
          setConnected(false);
        }}
      />
    ) : (
      <Button
        label={t('integrations.connect')}
        size="sm"
        loading={busy}
        onPress={() => void connect()}
        testID="steps-connect"
      />
    );
  } else if (status === 'needsInstall') {
    footer = t('integrations.stepsInstall');
    accessory = (
      <Button
        label={t('integrations.install')}
        variant="secondary"
        size="sm"
        onPress={openHealthConnectInstall}
      />
    );
  } else if (status === 'unsupported') {
    footer = t('integrations.stepsUnsupported');
  }

  return (
    <>
      <GroupedList>
        <ListRow
          title={source}
          subtitle={connected && status === 'available' ? t('integrations.stepsOn') : undefined}
          accessory={accessory}
        />
      </GroupedList>
      <GroupFooter>{footer}</GroupFooter>
    </>
  );
}

function HandleCard({
  provider,
  label,
  site,
  current,
  online,
  onSaved,
}: {
  provider: IntegrationProvider;
  label: string;
  site: string;
  current: string | null;
  online: boolean;
  onSaved: (handle: string | null) => void;
}) {
  const me = useMe();
  const toast = useToast();
  const qc = useQueryClient();
  const [value, setValue] = useState(current ?? '');
  const [error, setError] = useState<string | undefined>();
  const [busy, setBusy] = useState<'save' | 'remove' | null>(null);

  useEffect(() => setValue(current ?? ''), [current]);

  const handle = normaliseHandle(value);
  const dirty = handle !== (current ?? '');

  const save = async () => {
    if (!looksLikeHandle(handle)) {
      setError(t('integrations.notFound'));
      return;
    }
    setBusy('save');
    setError(undefined);
    try {
      const check = await checkHandle(provider, handle, me.timezone);
      if (check.kind === 'notFound') {
        setError(t('integrations.notFound'));
        return;
      }
      await endpoints.setIntegration(provider, handle);
      onSaved(handle);
      clearVerifyCache();
      void qc.invalidateQueries({ queryKey: integrationsKey });
      toast.show({
        message:
          check.kind === 'error'
            ? t('integrations.unreachable', { site })
            : t('integrations.saved'),
        kind: 'success',
      });
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  const remove = async () => {
    setBusy('remove');
    try {
      await endpoints.removeIntegration(provider);
      onSaved(null);
      clearVerifyCache();
      void qc.invalidateQueries({ queryKey: integrationsKey });
      toast.show({ message: t('integrations.removed'), kind: 'success' });
    } catch (e) {
      toast.show({ message: errorMessage(e), kind: 'error' });
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.card}>
      <TextField
        label={label}
        placeholder={t('integrations.placeholder')}
        value={value}
        onChangeText={(v) => {
          setValue(v);
          if (error) setError(undefined);
        }}
        error={error}
        autoCapitalize="none"
        autoCorrect={false}
        maxLength={TEXT_LIMITS.handle}
        testID={`handle-${provider}`}
      />
      <View style={styles.actions}>
        {current ? (
          <Button
            label={t('integrations.remove')}
            variant="destructive"
            size="sm"
            onPress={() => void remove()}
            loading={busy === 'remove'}
            disabled={!online || busy !== null}
          />
        ) : null}
        <Button
          label={busy === 'save' ? t('integrations.checking') : t('integrations.save')}
          size="sm"
          onPress={() => void save()}
          loading={busy === 'save'}
          disabled={!online || !dirty || !handle || busy !== null}
          testID={`save-${provider}`}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 8 },
  body: { marginBottom: 20, lineHeight: 22 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    padding: 16,
    gap: 12,
    marginBottom: 12,
  },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: 10 },
  flex: { flex: 1 },
  loadError: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 12 },
});
