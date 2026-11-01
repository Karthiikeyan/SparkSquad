import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  Animated,
  Easing,
  KeyboardAvoidingView,
  Modal,
  Pressable,
  StyleSheet,
  View,
  useWindowDimensions,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  type ScrollViewProps,
} from 'react-native';
import {
  GestureDetector,
  GestureHandlerRootView,
  ScrollView,
  usePanGesture,
  type PanGesture,
} from 'react-native-gesture-handler';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { t } from '../../i18n';
import { useReducedMotion } from '../../lib/hooks/useReducedMotion';
import { colors, motion, radius } from '../../theme/tokens';

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  children: ReactNode;
  accessibilityLabel: string;
  /** Called after the close animation finishes (navigate away here). */
  onClosed?: () => void;
  /** Distance from the top of the screen (CheckIn design: 128). Omit to size to content. */
  top?: number;
}

/** Whether a finished swipe should dismiss the sheet: far enough, or flicked (px/ms). */
export function shouldDismiss(dy: number, vy: number): boolean {
  return dy > 110 || (dy > 24 && vy > 0.9);
}

interface SheetContext {
  pan: PanGesture | null;
  onScroll: (e: NativeSyntheticEvent<NativeScrollEvent>) => void;
}

const SheetContext = createContext<SheetContext>({ pan: null, onScroll: () => undefined });

/**
 * ScrollView for sheet content. A plain one takes the touch natively on Android, so the sheet would
 * never see the swipe: this one shares it. A swipe scrolls first and closes only from the top.
 */
export function SheetScrollView(props: ScrollViewProps) {
  const { pan, onScroll } = useContext(SheetContext);
  return (
    <ScrollView
      {...props}
      bounces={false}
      overScrollMode="never"
      onScroll={onScroll}
      scrollEventThrottle={16}
      {...(pan ? { simultaneousWith: pan } : {})}
    />
  );
}

/**
 * Modal sheet: scrim, 22 px top radius, 36×5 grabber. Swipe down anywhere on it, tap outside or
 * press back to close. The swipe runs in the native gesture system so it can't lose to the list.
 */
export function BottomSheet({
  visible,
  onClose,
  onClosed,
  children,
  accessibilityLabel,
  top,
}: BottomSheetProps) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(0)).current;
  const drag = useRef(new Animated.Value(0)).current;
  const [mounted, setMounted] = useState(visible);
  const closedRef = useRef(onClosed);
  closedRef.current = onClosed;
  const atTop = useRef(true);
  /** Finger travel when the content reached the top, so the sheet follows from there. */
  const dragFrom = useRef<number | null>(null);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      drag.setValue(0);
      atTop.current = true;
    }
    Animated.timing(progress, {
      toValue: visible ? 1 : 0,
      duration: reduced ? 0 : motion.normal,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (finished && !visible) {
        setMounted(false);
        closedRef.current?.();
      }
    });
  }, [visible, progress, drag, reduced]);

  const pan = usePanGesture({
    runOnJS: true,
    disableReanimated: true,
    // Only a clear downward swipe; taps, upward scrolls and sideways chips stay with the content.
    activeOffsetY: 10,
    failOffsetY: -10,
    failOffsetX: [-24, 24],
    onActivate: () => {
      dragFrom.current = null;
    },
    onUpdate: (e) => {
      if (!atTop.current) return;
      dragFrom.current ??= e.translationY;
      drag.setValue(Math.max(0, e.translationY - dragFrom.current));
    },
    onDeactivate: (e) => {
      const moved = dragFrom.current === null ? 0 : e.translationY - dragFrom.current;
      dragFrom.current = null;
      if (shouldDismiss(moved, e.velocityY / 1000)) {
        onClose();
        return;
      }
      Animated.spring(drag, {
        toValue: 0,
        speed: 24,
        bounciness: 0,
        useNativeDriver: true,
      }).start();
    },
  });

  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    atTop.current = e.nativeEvent.contentOffset.y <= 0;
  };

  if (!mounted) return null;
  const translateY = Animated.add(
    progress.interpolate({ inputRange: [0, 1], outputRange: [height, 0] }),
    drag,
  );
  const scrimOpacity = Animated.multiply(
    progress,
    drag.interpolate({ inputRange: [0, height], outputRange: [1, 0], extrapolate: 'clamp' }),
  );

  return (
    <Modal transparent visible statusBarTranslucent animationType="none" onRequestClose={onClose}>
      {/* A Modal is its own window on Android, so gestures need their own root inside it. */}
      <GestureHandlerRootView style={styles.fill}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, { opacity: scrimOpacity }]}>
          <Pressable
            style={StyleSheet.absoluteFill}
            onPress={onClose}
            accessibilityRole="button"
            accessibilityLabel={t('common.close')}
            testID="sheet-scrim"
          />
        </Animated.View>
        <KeyboardAvoidingView behavior="height" style={styles.fill} pointerEvents="box-none">
          <GestureDetector gesture={pan}>
            <Animated.View
              accessibilityViewIsModal
              accessibilityLabel={accessibilityLabel}
              style={[
                styles.sheet,
                top !== undefined ? { top } : { maxHeight: height - insets.top - 24 },
                { paddingBottom: Math.max(insets.bottom, 16) + 18, transform: [{ translateY }] },
              ]}
            >
              <View style={styles.grabberZone}>
                <View style={styles.grabber} />
              </View>
              <SheetContext.Provider value={{ pan, onScroll }}>{children}</SheetContext.Provider>
            </Animated.View>
          </GestureDetector>
        </KeyboardAvoidingView>
      </GestureHandlerRootView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { backgroundColor: colors.scrim },
  fill: { flex: 1 },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    paddingHorizontal: 16,
  },
  // Taller than the grabber, so it's an easy place to start a swipe.
  grabberZone: { paddingTop: 8, paddingBottom: 14, alignItems: 'center' },
  grabber: { width: 36, height: 5, borderRadius: 3, backgroundColor: colors.strong },
});
