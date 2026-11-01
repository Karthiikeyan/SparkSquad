import { AlertCircle, Check, Info } from 'lucide-react-native';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { AccessibilityInfo, Animated, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../../lib/hooks/useReducedMotion';
import { colors, iconStroke, motion, radius, tabBarHeight } from '../../theme/tokens';
import { Text } from './Text';

export type ToastKind = 'success' | 'info' | 'error';

export interface ToastInput {
  message: string;
  kind?: ToastKind;
  /** Default 3000 ms (G4). */
  durationMs?: number;
}

interface ToastState extends Required<ToastInput> {
  id: number;
}

interface ToastApi {
  show: (toast: ToastInput) => void;
  /** Lift toasts above the tab bar on tab screens. */
  setAboveTabBar: (above: boolean) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}

const ICON = { success: Check, info: Info, error: AlertCircle } as const;
const ICON_COLOR = { success: colors.success, info: colors.label2, error: colors.accent } as const;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const [aboveTabBar, setAboveTabBar] = useState(false);
  const seq = useRef(0);
  const opacity = useRef(new Animated.Value(0)).current;
  const reduced = useReducedMotion();
  const insets = useSafeAreaInsets();

  const show = useCallback((input: ToastInput) => {
    seq.current += 1;
    setToast({ id: seq.current, kind: 'info', durationMs: 3000, ...input });
    AccessibilityInfo.announceForAccessibility(input.message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    Animated.timing(opacity, {
      toValue: 1,
      duration: reduced ? 0 : motion.normal,
      useNativeDriver: true,
    }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: reduced ? 0 : motion.normal,
        useNativeDriver: true,
      }).start(() => setToast((cur) => (cur?.id === toast.id ? null : cur)));
    }, toast.durationMs);
    return () => clearTimeout(timer);
  }, [toast, opacity, reduced]);

  const api = useMemo(() => ({ show, setAboveTabBar }), [show]);
  const Icon = toast ? ICON[toast.kind] : null;
  const bottom = (aboveTabBar ? tabBarHeight(insets.bottom) : insets.bottom) + 12;

  return (
    <ToastContext.Provider value={api}>
      {children}
      {toast && Icon ? (
        <Animated.View
          pointerEvents="none"
          accessibilityLiveRegion="polite"
          style={[styles.toast, { bottom, opacity }]}
        >
          <View style={styles.row}>
            <Icon size={18} color={ICON_COLOR[toast.kind]} strokeWidth={iconStroke} />
            <Text variant="body" style={styles.flex}>
              {toast.message}
            </Text>
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

const styles = StyleSheet.create({
  toast: {
    position: 'absolute',
    left: 16,
    right: 16,
    backgroundColor: colors.surface2,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    paddingVertical: 12,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 8,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  flex: { flex: 1 },
});
