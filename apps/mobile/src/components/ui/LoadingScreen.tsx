import { Image } from 'expo-image';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { useReducedMotion } from '../../lib/hooks/useReducedMotion';
import { colors } from '../../theme/tokens';
import { BrandMark } from './BrandMark';
import { Text } from './Text';

// eslint-disable-next-line @typescript-eslint/no-require-imports -- Metro asset
export const WAVES = require('../../../assets/images/brand-waves.jpg') as number;

const BAR_WIDTH = 180;
const RUNNER = 72;

/** Branded wait between the native splash and the first real screen. */
export function LoadingScreen() {
  const reduced = useReducedMotion();
  const x = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.timing(x, {
        toValue: 1,
        duration: 1200,
        easing: Easing.inOut(Easing.cubic),
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [x, reduced]);
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [-RUNNER, BAR_WIDTH] });
  return (
    <View
      style={styles.root}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={t('brand.loading')}
    >
      <Image source={WAVES} style={StyleSheet.absoluteFill} contentFit="cover" />
      <BrandMark width={180} />
      <View style={styles.track}>
        <Animated.View style={[styles.runner, { transform: [{ translateX }] }]} />
      </View>
      <Text variant="footnote" color="label2">
        {t('brand.loading')}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: '#000000' },
  track: {
    width: BAR_WIDTH,
    height: 6,
    borderRadius: 3,
    overflow: 'hidden',
    backgroundColor: colors.surface2,
    marginTop: 44,
    marginBottom: 14,
  },
  runner: { width: RUNNER, height: 6, borderRadius: 3, backgroundColor: colors.accent },
});
