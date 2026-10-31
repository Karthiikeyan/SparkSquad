import { ChevronRight } from 'lucide-react-native';
import { Children, cloneElement, isValidElement, type ReactElement, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { colors, iconStroke, radius } from '../../theme/tokens';
import { Pressable } from './Pressable';
import { Switch } from './Switch';
import { Text } from './Text';

export function SectionLabel({
  children,
  style,
}: {
  children: string;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <View style={[styles.sectionLabel, style]}>
      <Text
        variant="footnote"
        color="label2"
        style={styles.sectionLabelText}
        accessibilityRole="header"
      >
        {children}
      </Text>
    </View>
  );
}

export function GroupFooter({ children }: { children: string }) {
  return (
    <Text variant="caption" color="label2" style={styles.footer}>
      {children}
    </Text>
  );
}

interface RowInjected {
  first?: boolean;
}

/** Rounded surface with 0.5 px hairlines between rows (no boxes). */
export function GroupedList({
  children,
  style,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  let index = 0;
  return (
    <View style={[styles.group, style]}>
      {Children.map(children, (child) => {
        if (!isValidElement(child)) return child;
        const first = index === 0;
        index += 1;
        return cloneElement(child as ReactElement<RowInjected>, { first });
      })}
    </View>
  );
}

export interface ListRowProps extends RowInjected {
  title: string;
  subtitle?: string;
  value?: string;
  chevron?: boolean;
  destructive?: boolean;
  /** Renders a switch on the right. */
  toggle?: { value: boolean; onValueChange: (v: boolean) => void };
  /** Anything custom on the right (buttons, status). */
  accessory?: ReactNode;
  /** Optional element on the left (avatar, icon tile). */
  leading?: ReactNode;
  onPress?: () => void;
  accessibilityHint?: string;
  testID?: string;
}

export function ListRow({
  first,
  title,
  subtitle,
  value,
  chevron,
  destructive,
  toggle,
  accessory,
  leading,
  onPress,
  accessibilityHint,
  testID,
}: ListRowProps) {
  const content = (
    <>
      {leading}
      <View style={styles.texts}>
        <Text variant="body" color={destructive ? 'danger' : 'label'} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text variant="footnote" color="label2" numberOfLines={2}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {value ? (
        <Text variant="body" color="label2" tabular numberOfLines={1}>
          {value}
        </Text>
      ) : null}
      {accessory}
      {toggle ? (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          accessibilityLabel={title}
        />
      ) : null}
      {chevron ? (
        <ChevronRight size={18} color={colors.iconMuted} strokeWidth={iconStroke} />
      ) : null}
    </>
  );
  const rowStyle = [styles.row, !first && styles.separator, subtitle ? styles.rowTall : null];
  if (onPress && !toggle) {
    return (
      <Pressable
        testID={testID}
        noScale
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={value ? `${title}, ${value}` : title}
        accessibilityHint={accessibilityHint}
        style={({ pressed }) => [rowStyle, pressed && { opacity: 0.7 }]}
      >
        {content}
      </Pressable>
    );
  }
  return (
    <View testID={testID} style={rowStyle}>
      {content}
    </View>
  );
}

const styles = StyleSheet.create({
  sectionLabel: { marginHorizontal: 16, marginBottom: 6 },
  sectionLabelText: { fontFamily: 'Inter_500Medium' },
  footer: { marginTop: 6, marginHorizontal: 16, marginBottom: 20, lineHeight: 17 },
  group: { backgroundColor: colors.surface, borderRadius: radius.list, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 52 },
  rowTall: { minHeight: 56, paddingVertical: 8 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  texts: { flex: 1, minWidth: 0, gap: 2 },
});
