import { gte } from 'drizzle-orm';
import * as Haptics from 'expo-haptics';
import { router, useLocalSearchParams } from 'expo-router';
import { Award } from 'lucide-react-native';
import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle } from 'react-native-svg';
import { Button, Text } from '../../components/ui';
import { t, tMaybe } from '../../i18n';
import { badges } from '../../lib/db/schema';
import { useOnline } from '../../lib/hooks/useOnline';
import { useReducedMotion } from '../../lib/hooks/useReducedMotion';
import { qk } from '../../lib/query/keys';
import { useLocalQuery } from '../../lib/query/useLocalQuery';
import { colors, fonts, iconStroke } from '../../theme/tokens';
import { useToday } from '../today/useToday';

const SIZE = 200;
const STROKE = 10;
const R = (SIZE - STROKE) / 2;
const CIRC = 2 * Math.PI * R;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** The squad ring filling up to include you: the one celebratory moment (design principle 6). */
function SquadRing({ checked, total }: { checked: number; total: number }) {
  const reduced = useReducedMotion();
  const to = total > 0 ? checked / total : 1;
  const from = total > 0 ? Math.max(0, checked - 1) / total : 0;
  const progress = useRef(new Animated.Value(reduced ? to : from)).current;
  useEffect(() => {
    if (reduced) {
      progress.setValue(to);
      return;
    }
    Animated.timing(progress, {
      toValue: to,
      duration: 900,
      delay: 150,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
  }, [to, reduced, progress]);
  const offset = progress.interpolate({ inputRange: [0, 1], outputRange: [CIRC, 0] });
  return (
    <View
      style={styles.ring}
      accessible
      accessibilityLabel={t('today.checkedIn', { n: checked, total })}
    >
      <Svg width={SIZE} height={SIZE}>
        <Circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={colors.surface3}
          strokeWidth={STROKE}
          fill="none"
        />
        <AnimatedCircle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={R}
          stroke={colors.accent}
          strokeWidth={STROKE}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${CIRC} ${CIRC}`}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </Svg>
      <View style={styles.ringCenter}>
        <Text style={styles.count} tabular>
          {String(checked)}
          <Text style={[styles.count, { color: colors.iconMuted }]}>{`/${total}`}</Text>
        </Text>
      </View>
    </View>
  );
}

/** B5: check-in success. */
export function CheckinSuccessScreen() {
  const params = useLocalSearchParams<{
    challengeId: string;
    date: string;
    n: string;
    status: string;
    streak: string;
    counts: string;
    since: string;
  }>();
  const insets = useSafeAreaInsets();
  const online = useOnline();
  const today = useToday();
  const earned = useLocalQuery([...qk.local, 'badges', params.since ?? ''], (db) =>
    db
      .select()
      .from(badges)
      .where(gte(badges.earnedAt, params.since ?? '9999'))
      .all(),
  );

  useEffect(() => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => undefined);
  }, []);

  const card = today.data?.cards.find((c) => c.challenge.id === params.challengeId);
  const n = Number(params.n) || 1;
  const streak = Number(params.streak) || 0;
  const honest = params.status === 'honest_miss';
  const total = card?.members.length ?? 1;
  const checked = card ? card.checkedCount : 1;

  const headline = honest
    ? t('success.honest')
    : `${t(params.status === 'done' ? 'success.done' : 'success.partial', { n })}${
        params.counts === '1' && streak > 0 ? ` ${t('success.streak', { n: streak })}` : ''
      }`;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 48, paddingBottom: insets.bottom + 16 }]}>
      <View style={styles.body}>
        <SquadRing checked={checked} total={total} />
        <Text
          style={styles.headline}
          align="center"
          accessibilityRole="header"
          accessibilityLiveRegion="polite"
        >
          {headline}
        </Text>
        {card ? (
          <Text variant="callout" color="label2" align="center">
            {t('success.squad', { n: checked, total, squad: card.squad.name })}
          </Text>
        ) : null}
        {(earned.data ?? []).map((b) => (
          <View key={b.badge} style={styles.badge}>
            <Award size={20} color={colors.accent} strokeWidth={iconStroke} />
            <Text variant="bodySemibold" color="accent">
              {t('success.badge', { badge: tMaybe(`badges.${b.badge}`) ?? b.badge })}
            </Text>
          </View>
        ))}
        {!online ? (
          <Text variant="footnote" color="label3" align="center">
            {t('success.offline')}
          </Text>
        ) : null}
      </View>
      {card ? (
        <Button
          label={t('success.share')}
          variant="secondary"
          onPress={() =>
            router.replace({ pathname: '/squad/[id]/share', params: { id: card.squad.id } })
          }
          style={styles.share}
          testID="success-share"
        />
      ) : null}
      <Button
        label={t('success.back')}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/today'))}
        testID="success-back"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, paddingHorizontal: 16 },
  share: { marginBottom: 10 },
  body: { flex: 1, alignItems: 'center', gap: 14 },
  ring: { width: SIZE, height: SIZE, marginBottom: 12 },
  ringCenter: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  count: { fontFamily: fonts.display, fontSize: 52, lineHeight: 58, color: colors.accent },
  headline: { fontFamily: fonts.display, fontSize: 28, lineHeight: 34, color: colors.label },
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: colors.accentSoft,
    borderRadius: 18,
    paddingHorizontal: 14,
    height: 36,
  },
});
