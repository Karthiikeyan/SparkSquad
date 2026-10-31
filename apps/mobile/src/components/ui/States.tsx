import { AlertCircle, WifiOff, type LucideIcon } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View, type DimensionValue } from 'react-native';
import { t } from '../../i18n';
import { useReducedMotion } from '../../lib/hooks/useReducedMotion';
import { colors, iconStroke, radius } from '../../theme/tokens';
import { Button } from './Button';
import { Text } from './Text';

export interface EmptyStateProps {
  icon: LucideIcon;
  /** One sentence. */
  message: string;
  actionLabel?: string;
  onAction?: () => void;
  secondaryLabel?: string;
  onSecondary?: () => void;
}

/** Icon tile, one sentence, one CTA (design system). */
export function EmptyState({
  icon: Icon,
  message,
  actionLabel,
  onAction,
  secondaryLabel,
  onSecondary,
}: EmptyStateProps) {
  return (
    <View style={styles.empty}>
      <View style={styles.tile}>
        <Icon size={26} color={colors.accent} strokeWidth={iconStroke} />
      </View>
      <Text variant="callout" color="label2" align="center" style={styles.message}>
        {message}
      </Text>
      {actionLabel && onAction ? (
        <Button label={actionLabel} onPress={onAction} style={styles.action} />
      ) : null}
      {secondaryLabel && onSecondary ? (
        <Button
          label={secondaryLabel}
          onPress={onSecondary}
          variant="secondary"
          size="md"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

export interface ErrorStateProps {
  title?: string;
  message?: string;
  onRetry?: () => void;
}

/** What happened + retry (G3, and every screen's error state). */
export function ErrorState({ title, message, onRetry }: ErrorStateProps) {
  return (
    <View style={styles.empty} accessibilityLiveRegion="polite">
      <View style={[styles.tile, { backgroundColor: colors.surface2 }]}>
        <AlertCircle size={26} color={colors.label2} strokeWidth={iconStroke} />
      </View>
      <Text variant="title2" align="center">
        {title ?? t('errorState.title')}
      </Text>
      <Text variant="callout" color="label2" align="center" style={styles.message}>
        {message ?? t('errorState.body')}
      </Text>
      {onRetry ? (
        <Button
          label={t('common.retry')}
          onPress={onRetry}
          variant="secondary"
          size="md"
          style={styles.action}
        />
      ) : null}
    </View>
  );
}

/** "Offline. Check-ins will sync when you're back." (G1) */
export function OfflineBanner() {
  return (
    <View style={styles.banner} accessibilityRole="alert" accessibilityLiveRegion="polite">
      <WifiOff size={16} color={colors.label2} strokeWidth={iconStroke} />
      <Text variant="footnote" color="label2" style={styles.flex}>
        {t('offline.banner')}
      </Text>
    </View>
  );
}

export interface SkeletonProps {
  width?: DimensionValue;
  height?: number;
  radius?: number;
}

/** Pulsing placeholder block; static when reduced motion is on. */
export function Skeleton({ width = '100%', height = 16, radius: r = 8 }: SkeletonProps) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.5)).current;
  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 1, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.5, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity, reduced]);
  return (
    <Animated.View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{ width, height, borderRadius: r, backgroundColor: colors.surface2, opacity }}
    />
  );
}

/** A card-shaped loading placeholder used by list screens. */
export function SkeletonCard() {
  return (
    <View style={styles.skeletonCard} accessible accessibilityLabel={t('common.loading')}>
      <Skeleton width="45%" height={22} />
      <Skeleton width="30%" height={13} />
      <Skeleton height={44} radius={12} />
      <Skeleton height={44} radius={12} />
      <Skeleton height={52} radius={radius.input} />
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 40, gap: 14 },
  tile: {
    width: 56,
    height: 56,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: { maxWidth: 300 },
  action: { alignSelf: 'stretch' },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.surface2,
    borderRadius: radius.button,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginBottom: 12,
  },
  flex: { flex: 1 },
  skeletonCard: {
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    gap: 12,
  },
});
