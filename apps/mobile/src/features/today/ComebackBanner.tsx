import { router } from 'expo-router';
import { RotateCcw } from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from '../../components/ui';
import { t } from '../../i18n';
import { colors, iconStroke, radius } from '../../theme/tokens';
import type { TodayCard } from './model';

/** After missed days: no scolding, just a smaller way back in. */
export function ComebackBanner({ card }: { card: TodayCard }) {
  const offer = card.comeback;
  if (!offer) return null;
  const body = !offer.restores
    ? t('comeback.bodyFresh')
    : offer.missed === 1
      ? t('comeback.bodyRestoreOne')
      : t('comeback.bodyRestore', { n: offer.missed });
  return (
    <View style={styles.card} testID={`comeback-${card.challenge.id}`}>
      <View style={styles.icon}>
        <RotateCcw size={20} color={colors.accent} strokeWidth={iconStroke} />
      </View>
      <View style={styles.texts}>
        <Text variant="bodySemibold">{t('comeback.title')}</Text>
        <Text variant="footnote" color="label2">
          {body}
        </Text>
      </View>
      <Button
        label={t('comeback.action')}
        size="sm"
        accessibilityLabel={`${t('comeback.action')}, ${card.challenge.title}`}
        onPress={() =>
          router.push({
            pathname: '/checkin/[challengeId]',
            params: { challengeId: card.challenge.id },
          })
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: colors.accentSoft,
    borderRadius: radius.list,
    padding: 12,
  },
  icon: { width: 24, alignItems: 'center' },
  texts: { flex: 1, minWidth: 0, gap: 2 },
});
