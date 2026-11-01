import { router, useLocalSearchParams } from 'expo-router';
import {
  ChevronRight,
  FileUp,
  LayoutGrid,
  KeyRound,
  MessageCircle,
  Plus,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { NavHeader, Pressable, Screen, Text } from '../../../components/ui';
import { t } from '../../../i18n';
import { colors, fonts, iconStroke, radius } from '../../../theme/tokens';
import { CreateHeader } from '../components';
import { useCreateFlow } from '../flow';

type Route =
  | '/create/templates'
  | '/create/import'
  | '/create/ai-prompt'
  | '/create/ai-build'
  | '/create/blank';

interface Option {
  key: string;
  icon: LucideIcon;
  title: string;
  body: string;
  route: Route;
  tag?: { label: string; tone: 'free' | 'plus' };
}

const OPTIONS: Option[] = [
  {
    key: 'template',
    icon: LayoutGrid,
    title: t('create.optTemplate'),
    body: t('create.optTemplateBody'),
    route: '/create/templates',
  },
  {
    key: 'import',
    icon: FileUp,
    title: t('create.optImport'),
    body: t('create.optImportBody'),
    route: '/create/import',
  },
  {
    key: 'ai-prompt',
    icon: MessageCircle,
    title: t('create.optAiPrompt'),
    body: t('create.optAiPromptBody'),
    route: '/create/ai-prompt',
    tag: { label: t('create.tagFree'), tone: 'free' },
  },
  {
    key: 'ai-build',
    icon: KeyRound,
    title: t('create.optAiBuild'),
    body: t('create.optAiBuildBody'),
    route: '/create/ai-build',
    tag: { label: t('create.tagOwnKey'), tone: 'free' },
  },
  {
    key: 'blank',
    icon: Plus,
    title: t('create.optBlank'),
    body: t('create.optBlankBody'),
    route: '/create/blank',
  },
];

/** D2: Step 2 of 3 — template, import, AI prompt (free), in-app builder (BYOK, Plus), blank. */
export function PlanSourceScreen() {
  const { squadId } = useLocalSearchParams<{ squadId?: string }>();
  const { flow, update } = useCreateFlow();

  // Opened from an existing squad without a challenge: squad basics are skipped.
  useEffect(() => {
    if (squadId && flow.squadId !== squadId) update({ squadId, existing: true });
  }, [squadId, flow.squadId, update]);

  const b = flow.basics;
  const body = b
    ? t('create.planBody', {
        name: b.name,
        privacy: t(b.privacy === 'private' ? 'create.lowercasePrivate' : 'create.lowercasePublic'),
        category: t(`categories.${b.category}`).toLowerCase(),
      })
    : t('create.planBodyExisting');
  const existing = !!squadId || flow.existing;

  return (
    <Screen
      header={
        existing ? (
          <NavHeader backLabel={t('common.back')} onBack={() => router.back()} />
        ) : (
          <CreateHeader step={2} />
        )
      }
    >
      <Text variant="title1" accessibilityRole="header">
        {t('create.planTitle')}
      </Text>
      <Text variant="body" color="label2" style={styles.body}>
        {body}
      </Text>
      <View style={styles.group}>
        {OPTIONS.map((o, i) => {
          const Icon = o.icon;
          return (
            <Pressable
              key={o.key}
              noScale
              onPress={() => router.push(o.route)}
              accessibilityRole="button"
              accessibilityLabel={o.tag ? `${o.title}, ${o.tag.label}` : o.title}
              accessibilityHint={o.body}
              style={({ pressed }) => [
                styles.row,
                i > 0 && styles.separator,
                pressed && styles.pressed,
              ]}
              testID={`source-${o.key}`}
            >
              <View style={styles.icon}>
                <Icon size={20} color={colors.accent} strokeWidth={iconStroke} />
              </View>
              <View style={styles.texts}>
                <View style={styles.titleRow}>
                  <Text style={styles.title}>{o.title}</Text>
                  {o.tag ? (
                    <Text
                      style={[styles.tag, o.tag.tone === 'free' ? styles.tagFree : styles.tagPlus]}
                    >
                      {o.tag.label}
                    </Text>
                  ) : null}
                </View>
                <Text variant="footnote" color="label2">
                  {o.body}
                </Text>
              </View>
              <ChevronRight size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
            </Pressable>
          );
        })}
      </View>
      <Text variant="footnote" color="label3" align="center" style={styles.note}>
        {t('create.formatNote')}
      </Text>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: 6, marginBottom: 18 },
  group: { backgroundColor: colors.surface, borderRadius: radius.listLarge, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  pressed: { backgroundColor: colors.surface2 },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, minWidth: 0, gap: 2 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontFamily: fonts.sansSemibold, fontSize: 16, lineHeight: 21, color: colors.label },
  tag: {
    fontFamily: fonts.sansSemibold,
    fontSize: 11,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 2,
    overflow: 'hidden',
  },
  tagFree: { color: colors.success, backgroundColor: colors.successSoft },
  tagPlus: { color: colors.accent, backgroundColor: colors.accentSoft },
  note: { marginTop: 24 },
});
