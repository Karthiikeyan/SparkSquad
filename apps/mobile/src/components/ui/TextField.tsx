import { AlertCircle, Search } from 'lucide-react-native';
import type { ComponentRef, Ref } from 'react';
import {
  StyleSheet,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { t } from '../../i18n';
import { colors, fonts, iconStroke, radius } from '../../theme/tokens';
import { Text } from './Text';

export interface TextFieldProps extends Omit<TextInputProps, 'style' | 'ref'> {
  ref?: Ref<ComponentRef<typeof TextInput>>;
  label?: string;
  helper?: string;
  error?: string;
  /** Shows "n / max" under the field and enforces maxLength. */
  counter?: number;
  multiline?: boolean;
  containerStyle?: StyleProp<ViewStyle>;
}

/** Text input on `surface2`; `multiline` gives the TextArea variant with a counter. */
export function TextField({
  ref,
  label,
  helper,
  error,
  counter,
  multiline,
  containerStyle,
  value,
  accessibilityLabel,
  ...rest
}: TextFieldProps) {
  const length = value?.length ?? 0;
  return (
    <View style={containerStyle}>
      {label ? (
        <Text variant="footnote" color="label2" style={styles.label} nativeID={rest.nativeID}>
          {label}
        </Text>
      ) : null}
      <TextInput
        ref={ref}
        value={value}
        accessibilityLabel={accessibilityLabel ?? label}
        placeholderTextColor={colors.label3}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        maxLength={counter}
        multiline={multiline}
        textAlignVertical={multiline ? 'top' : 'center'}
        maxFontSizeMultiplier={1.3}
        style={[styles.input, multiline ? styles.area : styles.single]}
        {...rest}
      />
      {error ? (
        <View style={styles.errorRow} accessibilityLiveRegion="polite">
          <AlertCircle size={14} color={colors.accent} strokeWidth={iconStroke} />
          <Text variant="caption" color="label" style={styles.flex}>
            {error}
          </Text>
        </View>
      ) : null}
      {helper || counter !== undefined ? (
        <View style={styles.meta}>
          <Text variant="caption" color="label3" style={styles.flex}>
            {helper ?? ''}
          </Text>
          {counter !== undefined ? (
            <Text variant="caption" color="label3" tabular>
              {t('common.characterCount', { count: length, max: counter })}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

export interface SearchFieldProps extends Omit<TextInputProps, 'style'> {
  accessibilityLabel: string;
  containerStyle?: StyleProp<ViewStyle>;
}

export function SearchField({ containerStyle, accessibilityLabel, ...rest }: SearchFieldProps) {
  return (
    <View style={[styles.searchWrap, containerStyle]}>
      <Search
        size={18}
        color={colors.label3}
        strokeWidth={iconStroke}
        style={styles.searchIcon}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
      <TextInput
        accessibilityLabel={accessibilityLabel}
        placeholderTextColor={colors.label3}
        selectionColor={colors.accent}
        cursorColor={colors.accent}
        returnKeyType="search"
        clearButtonMode="while-editing"
        maxFontSizeMultiplier={1.3}
        style={styles.search}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginBottom: 6 },
  input: {
    backgroundColor: colors.surface2,
    color: colors.label,
    borderRadius: radius.input,
    paddingHorizontal: 14,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
  single: { height: 48 },
  area: { minHeight: 88, paddingTop: 12, paddingBottom: 12, lineHeight: 21 },
  meta: { flexDirection: 'row', marginTop: 4, gap: 8 },
  errorRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 },
  flex: { flex: 1 },
  searchWrap: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  search: {
    height: 40,
    borderRadius: radius.button,
    backgroundColor: colors.control,
    color: colors.label,
    paddingLeft: 38,
    paddingRight: 12,
    fontFamily: fonts.sans,
    fontSize: 15,
  },
});
