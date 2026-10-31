import { StyleSheet, View } from 'react-native';
import { t } from '../../i18n';
import { colors } from '../../theme/tokens';
import { Avatar } from './Avatar';
import { Text } from './Text';

export interface RingMember {
  id: string;
  name: string;
  avatarColor?: number | null;
  checked: boolean;
  /** Short label under grid avatars ("You"). */
  shortName?: string;
  initials?: string;
}

export interface AvatarRingProps {
  members: readonly RingMember[];
  variant?: 'row' | 'grid';
  /** Row variant: how many to show before collapsing into "+N". */
  max?: number;
  /** Row variant: one spoken summary for the whole group ("6 of 9 checked in"). */
  accessibilityLabel?: string;
  ringGap?: string;
}

/** The squad ring: avatars get an amber ring once they've checked in today. */
export function AvatarRing({
  members,
  variant = 'row',
  max = 9,
  accessibilityLabel,
  ringGap = colors.surface,
}: AvatarRingProps) {
  if (variant === 'grid') {
    return (
      <View style={styles.grid}>
        {members.map((m) => (
          <View
            key={m.id}
            style={styles.cell}
            accessible
            accessibilityLabel={t(m.checked ? 'avatar.checkedIn' : 'avatar.notCheckedIn', {
              name: m.shortName ?? m.name,
            })}
          >
            <Avatar
              name={m.name}
              id={m.id}
              color={m.avatarColor}
              label={m.initials}
              size={32}
              checked={m.checked}
              dimmed={!m.checked}
              ringGap={ringGap}
              decorative
            />
            <Text variant="tab" color="label2" numberOfLines={1} style={styles.cellName}>
              {m.shortName ?? m.name.split(' ')[0] ?? m.name}
            </Text>
          </View>
        ))}
      </View>
    );
  }

  const shown = members.slice(0, max);
  const extra = members.length - shown.length;
  return (
    <View style={styles.row} accessible accessibilityLabel={accessibilityLabel}>
      {shown.map((m, i) => (
        <Avatar
          key={m.id}
          name={m.name}
          id={m.id}
          color={m.avatarColor}
          label={m.initials}
          size={28}
          checked={m.checked}
          ringGap={ringGap}
          decorative
          style={[i > 0 && styles.overlap, { zIndex: shown.length - i }]}
        />
      ))}
      {extra > 0 ? (
        <View style={[styles.more, styles.overlap]}>
          <Text variant="tab" color="label2" tabular>
            {`+${extra}`}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingLeft: 4 },
  overlap: { marginLeft: -6 },
  more: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: colors.surface,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', rowGap: 12 },
  cell: { width: `${100 / 9}%`, alignItems: 'center', gap: 6, minWidth: 34 },
  cellName: { maxWidth: '100%' },
});
