import type { BadgeId } from '@sparksquad/shared';
import {
  CheckCheck,
  Flag,
  Flame,
  Footprints,
  HeartHandshake,
  Megaphone,
  Mountain,
  RotateCcw,
  Sparkle,
  Sunrise,
  Trophy,
  Users,
  type LucideIcon,
} from 'lucide-react-native';
import { StyleSheet, View } from 'react-native';
import Svg, { Polygon } from 'react-native-svg';
import { Text } from '../../components/ui';
import { colors, fonts } from '../../theme/tokens';

/** Facet tones, light to dark, cut like the logo. Each family has its own mineral. */
const AMBER = ['#FFD36B', '#FFB224', '#E8940F', '#C97C06'];
const SKY = ['#BFE3FF', '#8CCBFF', '#5FAEEF', '#4593D6'];
const ORCHID = ['#E2C8FF', '#C9A2FF', '#AC7FF0', '#9163DB'];
const LOCKED = ['#2F2F34', '#2A2A2E', '#252529', '#202024'];

/**
 * The look of each badge. The flame grows a facet with every form, from a 3-sided Ember to a
 * 12-sided Sunrise, so progress shows in the shape itself instead of a number on a disc.
 */
const EMBLEM: Record<BadgeId, { sides: number; icon: LucideIcon; tones: readonly string[] }> = {
  streak_3: { sides: 3, icon: Flame, tones: AMBER },
  streak_7: { sides: 4, icon: Flame, tones: AMBER },
  streak_14: { sides: 5, icon: Flame, tones: AMBER },
  streak_21: { sides: 6, icon: Flame, tones: AMBER },
  streak_30: { sides: 7, icon: Flame, tones: AMBER },
  streak_60: { sides: 8, icon: Flame, tones: AMBER },
  streak_100: { sides: 12, icon: Sunrise, tones: AMBER },
  checkins_10: { sides: 6, icon: Footprints, tones: SKY },
  checkins_50: { sides: 6, icon: Flag, tones: SKY },
  checkins_100: { sides: 6, icon: Mountain, tones: SKY },
  first_checkin: { sides: 8, icon: Sparkle, tones: ORCHID },
  challenge_complete: { sides: 8, icon: Trophy, tones: ORCHID },
  early_bird: { sides: 8, icon: Sunrise, tones: ORCHID },
  truth_teller: { sides: 8, icon: HeartHandshake, tones: ORCHID },
  full_house: { sides: 8, icon: Users, tones: ORCHID },
  comeback: { sides: 8, icon: RotateCcw, tones: ORCHID },
  cheerleader: { sides: 8, icon: Megaphone, tones: ORCHID },
};

/** Points of a regular polygon around (c, c), first point straight up. */
export function polygonPoints(sides: number, c: number, r: number): [number, number][] {
  return Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2 - Math.PI / 2;
    return [c + Math.cos(a) * r, c + Math.sin(a) * r];
  });
}

export function BadgeEmblem({
  badge,
  earned,
  secret = false,
  size = 56,
}: {
  badge: BadgeId;
  earned: boolean;
  secret?: boolean;
  size?: number;
}) {
  const {
    sides,
    icon: Icon,
    tones,
  } = EMBLEM[badge] ?? { sides: 6, icon: CheckCheck, tones: AMBER };
  const c = size / 2;
  const points = polygonPoints(sides, c, c - 1);
  const palette = earned ? tones : LOCKED;
  const glyph = earned ? '#1A1200' : colors.label3;
  return (
    <View
      style={{ width: size, height: size }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Svg width={size} height={size}>
        {points.map((p, i) => {
          const q = points[(i + 1) % sides]!;
          return (
            <Polygon
              key={i}
              points={`${c},${c} ${p[0]},${p[1]} ${q[0]},${q[1]}`}
              // Lit from the top-left, like the logo's facets.
              fill={palette[(i + (sides > 4 ? 1 : 0)) % palette.length]}
              stroke={palette[(i + (sides > 4 ? 1 : 0)) % palette.length]}
              strokeWidth={0.5}
            />
          );
        })}
      </Svg>
      <View style={styles.center}>
        {secret ? (
          <Text style={[styles.secret, { fontSize: size * 0.4, lineHeight: size * 0.5 }]}>?</Text>
        ) : (
          <Icon size={size * 0.38} color={glyph} strokeWidth={2} />
        )}
      </View>
    </View>
  );
}

/** Emblem and a short line, for the profile strip and other people's profiles. */
export function BadgeTile({
  badge,
  label,
  earned,
  secret,
}: {
  badge: BadgeId;
  label: string;
  earned: boolean;
  secret?: boolean;
}) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={label}>
      <BadgeEmblem badge={badge} earned={earned} secret={secret} size={48} />
      <Text
        variant="caption"
        align="center"
        style={{ color: earned ? colors.onControl : colors.label2 }}
        numberOfLines={2}
      >
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  secret: { fontFamily: fonts.display, color: colors.label3 },
  tile: { flex: 1, alignItems: 'center', gap: 6 },
});
