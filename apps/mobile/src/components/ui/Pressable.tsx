import { useRef } from 'react';
import {
  Animated,
  Easing,
  Pressable as RNPressable,
  type PressableProps as RNPressableProps,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { motion } from '../../theme/tokens';
import { useReducedMotion } from '../../lib/hooks/useReducedMotion';

export interface PressableProps extends Omit<RNPressableProps, 'style'> {
  style?: StyleProp<ViewStyle> | ((state: { pressed: boolean }) => StyleProp<ViewStyle>);
  /** Disable the subtle press scale (e.g. for full-width rows). */
  noScale?: boolean;
}

/** Pressable with the design-system press feedback (scale ~0.98, 140 ms ease-out). */
export function Pressable({ style, noScale, onPressIn, onPressOut, ...rest }: PressableProps) {
  const scale = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();
  const animate = (to: number) => {
    if (noScale || reduced) return;
    Animated.timing(scale, {
      toValue: to,
      duration: motion.fast,
      easing: Easing.out(Easing.quad),
      useNativeDriver: true,
    }).start();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <RNPressable
        {...rest}
        style={style}
        onPressIn={(e) => {
          animate(motion.pressScale);
          onPressIn?.(e);
        }}
        onPressOut={(e) => {
          animate(1);
          onPressOut?.(e);
        }}
      />
    </Animated.View>
  );
}
