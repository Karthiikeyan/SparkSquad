import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import {
  Button,
  GroupedList,
  GroupFooter,
  ListRow,
  NavHeader,
  Screen,
  SectionLabel,
  SegmentedControl,
  Text,
} from '../../components/ui';
import { t, type TKey } from '../../i18n';
import { getAiKey, type AiProvider } from '../../lib/aiKeys';
import { analyticsOptedOut, setAnalyticsOptOut } from '../../lib/analytics';
import { env } from '../../lib/env';
import { getPref, type Prefs } from '../../lib/prefs';
import { getRuntime } from '../../lib/runtime';
import { useMe, useSession } from '../auth/SessionProvider';
import { formatReminder } from '../onboarding/time';
import { colors, lightThemeEnabled, radius } from '../../theme/tokens';
import { changeTheme } from './theme';
import { useMePatch } from './useMePatch';

const PROVIDER_LABEL: Record<AiProvider, TKey> = {
  gemini: 'aiSettings.gemini',
  openai: 'aiSettings.openai',
  anthropic: 'aiSettings.anthropic',
};

const LEGAL = [
  ['terms', 'settingsMain.terms'],
  ['privacy', 'settingsMain.privacy'],
  ['licences', 'settingsMain.licences'],
  ['guidelines', 'settingsMain.guidelines'],
] as const;

/** F5: every setting in one grouped list (Settings design). */
export function SettingsScreen() {
  const me = useMe();
  const { signOut } = useSession();
  const patch = useMePatch();
  const [aiProvider, setAiProvider] = useState<AiProvider | null>(null);
  const [theme, setTheme] = useState<Prefs['theme']>(getPref('theme') ?? 'dark');
  const [shareUsage, setShareUsage] = useState(!analyticsOptedOut());

  useEffect(() => {
    let alive = true;
    const p = getPref('aiProvider') ?? 'gemini';
    getAiKey(p).then((k) => {
      if (alive) setAiProvider(k ? p : null);
    });
    return () => {
      alive = false;
    };
  }, []);

  const confirmSignOut = async () => {
    const pending = await getRuntime()
      .outbox.pendingCount()
      .catch(() => 0);
    Alert.alert(
      t('settingsMain.signOutConfirm'),
      pending > 0 ? t('settingsMain.signOutBody') : undefined,
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('settingsMain.signOut'),
          style: 'destructive',
          onPress: () => void signOut(),
        },
      ],
    );
  };

  return (
    <Screen header={<NavHeader backLabel={t('settingsMain.back')} onBack={() => router.back()} />}>
      <Text variant="largeTitle" accessibilityRole="header" style={styles.title}>
        {t('settingsMain.title')}
      </Text>

      <SectionLabel>{t('settingsMain.ai')}</SectionLabel>
      <GroupedList style={styles.group}>
        <ListRow
          title={t('settingsMain.aiRow')}
          value={
            aiProvider
              ? t('settingsMain.aiSet', { provider: t(PROVIDER_LABEL[aiProvider]) })
              : t('settingsMain.aiNone')
          }
          chevron
          onPress={() => router.push('/settings/ai')}
        />
      </GroupedList>

      <SectionLabel>{t('settingsMain.reminders')}</SectionLabel>
      <GroupedList style={styles.group}>
        <ListRow
          title={t('settingsMain.dailyReminder')}
          value={formatReminder(me.reminderTime)}
          chevron
          onPress={() => router.push('/settings/notifications')}
        />
        <ListRow
          title={t('settingsMain.squadUpdates')}
          toggle={{
            value: me.notifySquadUpdates,
            onValueChange: (v) => void patch({ notifySquadUpdates: v }),
          }}
        />
        <ListRow
          title={t('settingsMain.notifications')}
          chevron
          onPress={() => router.push('/settings/notifications')}
        />
      </GroupedList>

      {lightThemeEnabled ? (
        <>
          <SectionLabel>{t('settingsMain.appearance')}</SectionLabel>
          <View style={styles.segment}>
            <SegmentedControl
              role="radiogroup"
              tone="surface"
              accessibilityLabel={t('settingsMain.appearance')}
              value={theme}
              onChange={(v) => {
                setTheme(v);
                changeTheme(v);
              }}
              options={[
                { value: 'dark', label: t('settingsMain.themeDark') },
                { value: 'light', label: t('settingsMain.themeLight') },
                { value: 'system', label: t('settingsMain.themeSystem') },
              ]}
            />
          </View>
        </>
      ) : null}

      <SectionLabel>{t('settingsMain.integrations')}</SectionLabel>
      <GroupedList style={styles.group}>
        <ListRow
          title={t('settingsMain.connections')}
          chevron
          onPress={() => router.push('/settings/integrations')}
        />
      </GroupedList>

      <SectionLabel>{t('settingsMain.billing')}</SectionLabel>
      <GroupedList style={styles.group}>
        <ListRow
          title={t('settingsMain.plan')}
          value={me.plan === 'plus' ? t('billing.plus') : t('billing.free')}
          chevron
          onPress={() => router.push('/settings/billing')}
        />
      </GroupedList>

      <SectionLabel>{t('settingsMain.yourData')}</SectionLabel>
      <GroupedList style={styles.group}>
        <ListRow
          title={t('settingsMain.blocked')}
          chevron
          onPress={() => router.push('/settings/blocked')}
        />
        <ListRow
          title={t('settingsMain.export')}
          chevron
          onPress={() => router.push('/settings/export')}
        />
        <ListRow
          title={t('settingsMain.usageData')}
          subtitle={t('settingsMain.usageDataBody')}
          toggle={{
            value: shareUsage,
            onValueChange: (v) => {
              setShareUsage(v);
              setAnalyticsOptOut(!v);
            },
          }}
        />
        <ListRow
          title={t('settingsMain.delete')}
          destructive
          onPress={() => router.push('/settings/delete')}
          testID="settings-delete"
        />
      </GroupedList>

      <SectionLabel>{t('settingsMain.help')}</SectionLabel>
      <GroupedList style={styles.group}>
        <ListRow
          title={t('settingsMain.helpRow')}
          chevron
          onPress={() => router.push('/settings/help')}
        />
      </GroupedList>

      <SectionLabel>{t('settingsMain.about')}</SectionLabel>
      <GroupedList>
        {LEGAL.map(([doc, label]) => (
          <ListRow
            key={doc}
            title={t(label)}
            chevron
            onPress={() => router.push({ pathname: '/settings/legal/[doc]', params: { doc } })}
          />
        ))}
        <ListRow title={t('settingsMain.version')} value={env.appVersion} />
      </GroupedList>
      <GroupFooter>{me.email}</GroupFooter>

      <Button
        label={t('settingsMain.signOut')}
        variant="destructive"
        onPress={() => void confirmSignOut()}
        testID="sign-out"
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  group: { marginBottom: 20 },
  segment: {
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    padding: 12,
    marginBottom: 20,
  },
});
