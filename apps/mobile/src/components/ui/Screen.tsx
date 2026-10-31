import type { ReactNode } from 'react';
import {
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useOnline } from '../../lib/hooks/useOnline';
import { colors, space } from '../../theme/tokens';
import { OfflineBanner } from './States';
import { Text } from './Text';

export interface ScreenProps {
  children: ReactNode;
  /** Large title for tab roots ("Today"). */
  title?: string;
  subtitle?: string;
  /** Right side of the large-title header (streak pill, bell). */
  headerRight?: ReactNode;
  /** Pushed screens put their NavHeader here. */
  header?: ReactNode;
  scroll?: boolean;
  /** Tab roots leave room for the tab bar. */
  withTabBar?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  /** Pinned at the bottom (primary action in the thumb zone). */
  footer?: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
}

/** Safe-area aware screen with the large-title header and the offline banner (G1). */
export function Screen({
  children,
  title,
  subtitle,
  headerRight,
  header,
  scroll = true,
  withTabBar,
  refreshing,
  onRefresh,
  footer,
  contentStyle,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const bottomPad = withTabBar ? space.tabBar + 16 : Math.max(insets.bottom, 16) + 16;

  const head = (
    <>
      {header}
      {title ? (
        <View style={styles.titleRow}>
          <View style={styles.titleTexts}>
            <Text variant="largeTitle" accessibilityRole="header">
              {title}
            </Text>
            {subtitle ? (
              <Text variant="body" color="label2">
                {subtitle}
              </Text>
            ) : null}
          </View>
          {headerRight}
        </View>
      ) : null}
      {!online ? <OfflineBanner /> : null}
    </>
  );

  const padTop = { paddingTop: insets.top + (header ? 8 : 16) };

  return (
    <View style={styles.root}>
      {scroll ? (
        <ScrollView
          contentContainerStyle={[
            styles.content,
            padTop,
            { paddingBottom: bottomPad },
            contentStyle,
          ]}
          keyboardShouldPersistTaps="handled"
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={!!refreshing}
                onRefresh={onRefresh}
                tintColor={colors.label2}
                colors={[colors.accent]}
                progressBackgroundColor={colors.surface}
              />
            ) : undefined
          }
        >
          {head}
          {children}
        </ScrollView>
      ) : (
        <View
          style={[styles.content, styles.fill, padTop, { paddingBottom: bottomPad }, contentStyle]}
        >
          {head}
          {children}
        </View>
      )}
      {footer ? (
        <View
          style={[
            styles.footer,
            { paddingBottom: withTabBar ? space.tabBar + 12 : insets.bottom + 12 },
          ]}
        >
          {footer}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  content: { paddingHorizontal: space.screen },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  titleTexts: { gap: 2, flexShrink: 1 },
  footer: { paddingHorizontal: space.screen, paddingTop: 8, backgroundColor: colors.bg },
});
