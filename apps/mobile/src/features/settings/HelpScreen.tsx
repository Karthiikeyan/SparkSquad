import { router } from 'expo-router';
import { ChevronDown, ChevronUp } from 'lucide-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, View } from 'react-native';
import {
  Button,
  GroupedList,
  GroupFooter,
  ListRow,
  NavHeader,
  Pressable,
  Screen,
  SectionLabel,
  Text,
} from '../../components/ui';
import { t, type TKey } from '../../i18n';
import { colors, iconStroke, radius } from '../../theme/tokens';
import { useConfig } from '../system/useConfig';

const FAQ: readonly (readonly [TKey, TKey])[] = [
  ['help.q1', 'help.a1'],
  ['help.q2', 'help.a2'],
  ['help.q3', 'help.a3'],
  ['help.q4', 'help.a4'],
  ['help.q5', 'help.a5'],
];

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
      <GroupedList>
        <ListRow
          title={t('help.guidelines')}
          chevron
          onPress={() =>
            router.push({ pathname: '/settings/legal/[doc]', params: { doc: 'guidelines' } })
          }
        />
      </GroupedList>
      <GroupFooter>{t('help.contactBody')}</GroupFooter>
      {email ? (
        <Button
          label={t('help.email', { email })}
          variant="secondary"
          onPress={() => void Linking.openURL(`mailto:${email}`)}
        />
      ) : null}
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
  flex: { flex: 1 },
  a: { paddingBottom: 14, lineHeight: 22 },
});
