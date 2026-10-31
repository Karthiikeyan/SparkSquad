import { StyleSheet, View } from 'react-native';
import { Avatar, Text } from '../../components/ui';
import { t } from '../../i18n';
import { colors, fonts } from '../../theme/tokens';

const SIZE = 300;
const RADIUS = 120;
const DOT = 40;
const INITIALS = ['DV', 'AR', 'SK', 'ME', 'RH', 'KI', 'KV', 'VG', 'NI', 'PR', 'HA', 'JO'];
const LIT = [true, true, false, true, true, true, false, true, false, true, true, false];

/** Decorative squad ring from the Welcome design: 12 avatars, 8 lit, "8/12 checked in today". */
export function WelcomeRing() {
  return (
    <View
      style={styles.wrap}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View style={styles.orbit} />
      {INITIALS.map((init, i) => {
        const a = (i / INITIALS.length) * Math.PI * 2 - Math.PI / 2;
        const left = Math.round(SIZE / 2 + Math.cos(a) * RADIUS - DOT / 2);
        const top = Math.round(SIZE / 2 + Math.sin(a) * RADIUS - DOT / 2);
        return (
          <Avatar
            key={init}
            name={init}
            label={init}
            color={i}
            size={40}
            fontSize={12}
            checked={LIT[i]}
            ringGap={colors.bg}
            ringOffset={3}
            decorative
            style={[styles.dot, { left, top }, !LIT[i] && styles.unlit]}
          />
        );
      })}
      <View style={styles.center}>
        <Text style={styles.count} tabular>
          {t('welcome.ringCount')}
          <Text style={[styles.count, styles.total]}>{t('welcome.ringTotal')}</Text>
        </Text>
        <Text variant="footnote" color="label2">
          {t('welcome.ringLabel')}
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { width: SIZE, height: SIZE, alignSelf: 'center' },
  orbit: {
    position: 'absolute',
    top: 30,
    left: 30,
    right: 30,
    bottom: 30,
    borderRadius: 120,
    borderWidth: 1,
    borderColor: colors.surface2,
  },
  dot: { position: 'absolute' },
  unlit: { opacity: 0.4 },
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center', gap: 2 },
  count: { fontFamily: fonts.display, fontSize: 56, lineHeight: 60, color: colors.accent },
  total: { color: colors.faint },
});
