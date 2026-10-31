import { ChevronRight, Compass, KeyRound, Plus, type LucideIcon } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Pressable, Text } from '../../src/components/ui';
import { useSession } from '../../src/features/auth/SessionProvider';
import { StepScreen } from '../../src/features/onboarding/StepScreen';
import { t } from '../../src/i18n';
import { track } from '../../src/lib/analytics';
import { colors, iconStroke, radius } from '../../src/theme/tokens';

interface Choice {
  key: 'join' | 'browse' | 'create';
  icon: LucideIcon;
  title: string;
  body: string;
  route: string;
}

const CHOICES: Choice[] = [
  {
    key: 'join',
    icon: KeyRound,
    title: t('start.join'),
    body: t('start.joinBody'),
    route: '/join',
  },
  {
    key: 'browse',
    icon: Compass,
    title: t('start.browse'),
    body: t('start.browseBody'),
    route: '/discover',
  },
  {
    key: 'create',
    icon: Plus,
    title: t('start.create'),
    body: t('start.createBody'),
    route: '/create/basics',
  },
];

/** A10: Join with a code, Browse public squads, Start a squad. */
export default function Start() {
  const { completeOnboarding } = useSession();
  return (
    <StepScreen title={t('start.title')} body={t('start.body')} footer={null}>
      <View style={styles.list}>
        {CHOICES.map(({ key, icon: Icon, title, body, route }) => (
          <Pressable
            key={key}
            testID={`start-${key}`}
            accessibilityRole="button"
            accessibilityLabel={title}
            accessibilityHint={body}
            onPress={() => {
              track('onboarding_start_choice', { choice: key });
              completeOnboarding(route);
            }}
            style={({ pressed }) => [styles.card, pressed && { backgroundColor: colors.surface2 }]}
          >
            <View style={styles.icon}>
              <Icon size={22} color={colors.accent} strokeWidth={iconStroke} />
            </View>
            <View style={styles.texts}>
              <Text variant="headline">{title}</Text>
              <Text variant="footnote" color="label2">
                {body}
              </Text>
            </View>
            <ChevronRight size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
          </Pressable>
        ))}
      </View>
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  list: { gap: 10 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.listLarge,
    padding: 16,
    minHeight: 76,
  },
  icon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  texts: { flex: 1, gap: 2 },
});
