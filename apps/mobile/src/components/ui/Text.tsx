import { Text as RNText, type TextProps as RNTextProps, type TextStyle } from 'react-native';
import { colors, type ColorToken, type, type TypeVariant } from '../../theme/tokens';

export interface TextProps extends RNTextProps {
  variant?: TypeVariant;
  color?: ColorToken;
  tabular?: boolean;
  align?: TextStyle['textAlign'];
}

/** Text with the design-system scale. Allows Dynamic Type up to 1.3× (design system). */
export function Text({
  variant = 'body',
  color = 'label',
  tabular,
  align,
  style,
  maxFontSizeMultiplier = 1.3,
  ...rest
}: TextProps) {
  return (
    <RNText
      maxFontSizeMultiplier={maxFontSizeMultiplier}
      style={[
        type[variant],
        { color: colors[color] },
        tabular ? { fontVariant: ['tabular-nums'] } : null,
        align ? { textAlign: align } : null,
        style,
      ]}
      {...rest}
    />
  );
}
