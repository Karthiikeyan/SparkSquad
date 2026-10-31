import { Check } from 'lucide-react-native';
import { Pressable, StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { colors, fonts } from '../../theme/tokens';
import { Text } from './Text';

export interface TaskRowProps {
  title: string;
  meta?: string;
  done: boolean;
  onToggle?: () => void;
  /** First row in a card has no top hairline. */
  first?: boolean;
  testID?: string;
}

/** Task with a 26 px tick circle inside a 44 px target; done = success fill + dark tick. */
export function TaskRow({ title, meta, done, onToggle, first, testID }: TaskRowProps) {
  return (
    <View style={[styles.row, !first && styles.separator]}>
      <Pressable
        testID={testID}
        onPress={onToggle}
        disabled={!onToggle}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: done, disabled: !onToggle }}
        accessibilityLabel={t(done ? 'taskRow.markNotDone' : 'taskRow.markDone', { title })}
        style={styles.target}
      >
        <View style={[styles.circle, done ? styles.circleDone : styles.circleOpen]}>
          {done ? <Check size={16} color={colors.onSuccess} strokeWidth={2.6} /> : null}
        </View>
      </Pressable>
      <View style={styles.texts}>
        <Text style={[styles.title, { color: done ? colors.label2 : colors.label }]}>{title}</Text>
        {meta ? (
          <Text variant="footnote" color="label2">
            {meta}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, minHeight: 56 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  target: {
    width: 44,
    height: 44,
    marginLeft: -8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circle: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleDone: { backgroundColor: colors.success },
  circleOpen: { borderWidth: 1.5, borderColor: colors.missed },
  texts: { flex: 1, minWidth: 0, gap: 2, paddingVertical: 8 },
  title: { fontFamily: fonts.sansMedium, fontSize: 15, lineHeight: 20 },
});
