import { Image } from 'expo-image';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { t } from '../../i18n';
import { colors, fonts } from '../../theme/tokens';
import { Text } from './Text';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset
const MARK = require('../../../assets/images/logo-mark.png') as number;
/** Width / height of the artwork. */
const MARK_RATIO = 512 / 319;

/** The clasped-hands logo. Decorative unless given a label. */
export function BrandMark({
  width = 64,
  accessibilityLabel,
  style,
}: {
  width?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View
      style={style}
      accessible={!!accessibilityLabel}
      accessibilityRole={accessibilityLabel ? 'image' : undefined}
      accessibilityLabel={accessibilityLabel}
    >
      <Image
        source={MARK}
        style={{ width, height: width / MARK_RATIO }}
        contentFit="contain"
        accessibilityIgnoresInvertColors
      />
    </View>
  );
}

/** Mark and name side by side (headers, share cards). */
export function BrandLockup({ width = 28 }: { width?: number }) {
  return (
    <View style={styles.lockup} accessible accessibilityLabel={t('brand.name')}>
      <BrandMark width={width} />
      <Text style={[styles.name, { fontSize: Math.round(width * 0.62) }]}>{t('brand.name')}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  lockup: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  name: { fontFamily: fonts.display, color: colors.label },
});
