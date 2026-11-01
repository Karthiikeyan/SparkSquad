import { router } from 'expo-router';
import * as Clipboard from 'expo-clipboard';
import { ChevronDown, ChevronUp, Mail } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  Button,
  GroupedList,
  ListRow,
  NavHeader,
  Pressable,
  Screen,
  SectionLabel,
  Text,
  useToast,
} from '../../components/ui';
import { t, type TKey } from '../../i18n';
import { env } from '../../lib/env';
import { colors, iconStroke, radius } from '../../theme/tokens';
import { useConfig } from '../system/useConfig';

const FAQ: readonly (readonly [TKey, TKey])[] = [
  ['help.q1', 'help.a1'],
  ['help.q2', 'help.a2'],
  ['help.q3', 'help.a3'],
  ['help.q4', 'help.a4'],
  ['help.q5', 'help.a5'],
];

/** Looks like the email it starts: who it goes to, what it's about, and a button to write it. */
function EmailCard({ email }: { email: string }) {
  const toast = useToast();
  const subject = t('help.emailSubject', { version: env.appVersion });
  const copy = () => {
    void Clipboard.setStringAsync(email);
    toast.show({ message: t('help.emailCopied'), kind: 'success' });
  };
  const write = () => {
    Linking.openURL(`mailto:${email}?subject=${encodeURIComponent(subject)}`).catch(copy);
  };
  return (
    <View style={styles.email} testID="help-email">
      <View style={styles.emailHead}>
        <View style={styles.emailIcon}>
          <Mail size={20} color={colors.accent} strokeWidth={iconStroke} />
        </View>
        <View style={styles.flex}>
          <Text variant="headline" accessibilityRole="header">
            {t('help.emailTitle')}
          </Text>
          <Text variant="footnote" color="label2">
            {t('help.contactBody')}
          </Text>
        </View>
      </View>
      <View style={styles.emailField}>
        <Text variant="footnote" color="label3" style={styles.emailKey}>
          {t('help.emailTo')}
        </Text>
        <Text variant="bodyMedium" color="accent" style={styles.flex} numberOfLines={1}>
          {email}
        </Text>
      </View>
      <View style={styles.emailField}>
        <Text variant="footnote" color="label3" style={styles.emailKey}>
          {t('help.emailSubjectLabel')}
        </Text>
        <Text variant="body" color="label2" style={styles.flex} numberOfLines={1}>
          {subject}
        </Text>
      </View>
      <View style={styles.emailActions}>
        <Button
          label={t('help.emailWrite')}
          size="md"
          onPress={write}
          style={styles.flex}
          testID="help-email-write"
        />
        <Button label={t('help.emailCopy')} variant="secondary" size="md" onPress={copy} />
      </View>
    </View>
  );
}

/** F15: short FAQ, contact email and the community guidelines. */
export function HelpScreen() {
  const config = useConfig();
  const [open, setOpen] = useState<number | null>(null);
  const email = config.data?.contactEmail;

  return (
    <Screen header={<NavHeader backLabel={t('common.back')} onBack={() => router.back()} />}>
      <Text variant="title1" accessibilityRole="header" style={styles.title}>
        {t('help.title')}
      </Text>

      <SectionLabel>{t('help.faq')}</SectionLabel>
      <View style={styles.group}>
        {FAQ.map(([q, a], i) => {
          const expanded = open === i;
          const Icon = expanded ? ChevronUp : ChevronDown;
          return (
            <View key={q} style={i > 0 && styles.separator}>
              <Pressable
                noScale
                onPress={() => setOpen(expanded ? null : i)}
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                style={styles.q}
              >
                <Text variant="body" style={styles.flex}>
                  {t(q)}
                </Text>
                <Icon size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
              </Pressable>
              {expanded ? (
                <Text variant="body" color="label2" style={styles.a}>
                  {t(a)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>

      <SectionLabel>{t('help.contact')}</SectionLabel>
      {email ? <EmailCard email={email} /> : null}
      <GroupedList>
        <ListRow
          title={t('help.childSafety')}
          chevron
          onPress={() =>
            router.push({ pathname: '/settings/legal/[doc]', params: { doc: 'childSafety' } })
          }
        />
        <ListRow
          title={t('help.guidelines')}
          chevron
          onPress={() =>
            router.push({ pathname: '/settings/legal/[doc]', params: { doc: 'guidelines' } })
          }
        />
      </GroupedList>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: 4, marginBottom: 16 },
  group: {
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    paddingHorizontal: 16,
    marginBottom: 20,
  },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  q: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52, paddingVertical: 10 },
  flex: { flex: 1, minWidth: 0 },
  email: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    marginBottom: 12,
  },
  emailHead: { flexDirection: 'row', gap: 12, marginBottom: 10 },
  emailIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emailField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    minHeight: 40,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.separator,
  },
  emailKey: { width: 56 },
  emailActions: { flexDirection: 'row', gap: 10, marginTop: 10 },
  a: { paddingBottom: 14, lineHeight: 22 },
});
