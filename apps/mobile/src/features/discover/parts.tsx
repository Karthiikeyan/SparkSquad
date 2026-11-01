import type { SquadPreviewDTO, TemplateSummaryDTO } from '@sparksquad/shared';
import { router } from 'expo-router';
import { Plus, Users } from 'lucide-react-native';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Button, Pressable, Text } from '../../components/ui';
import { t } from '../../i18n';
import { CATEGORY_ICON } from '../../lib/categories';
import { colors, fonts, iconStroke, radius } from '../../theme/tokens';
import { TemplateTile, templateBlurb, templateMeta } from '../create/screens/TemplatesScreen';
import { joinLabel, openSquadPreview, openTemplate, squadPlanLine, squadTimeline } from './model';

function CategoryTag({ category }: { category: SquadPreviewDTO['category'] }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <View style={styles.tag}>
      <Icon size={13} color={colors.accent} strokeWidth={iconStroke} />
      <Text variant="caption" color="accent">
        {t(`categories.${category}`)}
      </Text>
    </View>
  );
}

function Spots({ s }: { s: SquadPreviewDTO }) {
  const left = s.memberLimit - s.memberCount;
  return (
    <View style={styles.spots}>
      <Users size={14} color={colors.label2} strokeWidth={iconStroke} />
      <Text variant="footnote" color="label2" numberOfLines={1}>
        {left <= 10
          ? t('discover.spotsLeft', { n: left })
          : t('discover.joinedCount', { count: s.memberCount })}
      </Text>
    </View>
  );
}

/** Large card for the horizontal "Popular now" rail. */
export function SquadCard({ s, today }: { s: SquadPreviewDTO; today: string }) {
  const plan = squadPlanLine(s);
  const timeline = squadTimeline(s, today);
  return (
    <Pressable
      onPress={() => openSquadPreview(s.id)}
      accessibilityRole="button"
      accessibilityLabel={t('discover.cardLabel', {
        name: s.name,
        category: t(`categories.${s.category}`),
        meta: `${timeline}, ${t('discover.joinedCount', { count: s.memberCount })}`,
      })}
      style={styles.card}
      testID={`discover-card-${s.id}`}
    >
      <CategoryTag category={s.category} />
      <Text style={styles.cardName} numberOfLines={2}>
        {s.name}
      </Text>
      <Text variant="footnote" color="label2" numberOfLines={1}>
        {plan ?? timeline}
      </Text>
      <View style={styles.cardFoot}>
        <View style={styles.cardMeta}>
          {plan ? (
            <Text variant="footnote" color="label" numberOfLines={1}>
              {timeline}
            </Text>
          ) : null}
          <Spots s={s} />
        </View>
        <Button
          label={joinLabel(s)}
          variant={s.myStatus ? 'secondary' : 'soft'}
          size="sm"
          accessibilityLabel={t('discover.joinLabel', { name: s.name })}
          onPress={() => openSquadPreview(s.id)}
        />
      </View>
    </Pressable>
  );
}

export function SquadRail({
  squads,
  today,
}: {
  squads: readonly SquadPreviewDTO[];
  today: string;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      style={styles.bleed}
      decelerationRate="fast"
      snapToInterval={CARD_WIDTH + 10}
    >
      {squads.map((s) => (
        <SquadCard key={s.id} s={s} today={today} />
      ))}
    </ScrollView>
  );
}

export function SquadList({
  squads,
  today,
}: {
  squads: readonly SquadPreviewDTO[];
  today: string;
}) {
  return (
    <View style={styles.group}>
      {squads.map((s, i) => {
        const Icon = CATEGORY_ICON[s.category];
        const plan = squadPlanLine(s);
        return (
          <Pressable
            key={s.id}
            noScale
            onPress={() => openSquadPreview(s.id)}
            accessibilityRole="button"
            accessibilityLabel={t('discover.cardLabel', {
              name: s.name,
              category: t(`categories.${s.category}`),
              meta: `${squadTimeline(s, today)}, ${t('discover.joinedCount', { count: s.memberCount })}`,
            })}
            style={({ pressed }) => [
              styles.row,
              i > 0 && styles.separator,
              pressed && styles.pressed,
            ]}
          >
            <View style={styles.rowIcon}>
              <Icon size={20} color={colors.accent} strokeWidth={iconStroke} />
            </View>
            <View style={styles.texts}>
              <Text variant="bodySemibold" style={styles.name} numberOfLines={1}>
                {s.name}
              </Text>
              <Text variant="footnote" color="label2" numberOfLines={1}>
                {plan ? `${plan} · ${squadTimeline(s, today)}` : squadTimeline(s, today)}
              </Text>
              <Spots s={s} />
            </View>
            <Button
              label={joinLabel(s)}
              variant={s.myStatus ? 'secondary' : 'soft'}
              size="sm"
              accessibilityLabel={t('discover.joinLabel', { name: s.name })}
              onPress={() => openSquadPreview(s.id)}
              testID={`discover-${s.id}`}
            />
          </Pressable>
        );
      })}
    </View>
  );
}

export function TemplateRail({ templates }: { templates: readonly TemplateSummaryDTO[] }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.rail}
      style={styles.bleed}
    >
      {templates.map((tpl) => {
        const Icon = CATEGORY_ICON[tpl.category];
        return (
          <Pressable
            key={tpl.slug}
            onPress={() => openTemplate(tpl.slug)}
            accessibilityRole="button"
            accessibilityLabel={`${tpl.title}, ${templateMeta(tpl)}`}
            style={styles.tplCard}
            testID={`template-${tpl.slug}`}
          >
            <Icon size={20} color={colors.accent} strokeWidth={iconStroke} />
            <Text style={styles.tplTitle} numberOfLines={2}>
              {tpl.title}
            </Text>
            {templateBlurb(tpl.slug) ? (
              <Text variant="caption" color="label2" numberOfLines={2}>
                {templateBlurb(tpl.slug)}
              </Text>
            ) : null}
            <Text variant="footnote" color="accent">
              {templateMeta(tpl)}
            </Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export function TemplateGrid({ templates }: { templates: readonly TemplateSummaryDTO[] }) {
  return (
    <View style={styles.templateList}>
      {templates.map((tpl) => (
        <TemplateTile key={tpl.slug} tpl={tpl} onPress={() => openTemplate(tpl.slug)} />
      ))}
    </View>
  );
}

/** "Can't find the right one?" prompt at the end of Discover. */
export function StartSquadCard() {
  return (
    <Pressable
      onPress={() => router.push('/create/basics')}
      accessibilityRole="button"
      accessibilityLabel={`${t('discover.createCta')} ${t('discover.startSquad')}`}
      style={styles.cta}
    >
      <View style={styles.ctaIcon}>
        <Plus size={22} color={colors.onAccent} strokeWidth={2.2} />
      </View>
      <View style={styles.texts}>
        <Text variant="bodySemibold">{t('discover.createCta')}</Text>
        <Text variant="footnote" color="label2">
          {t('discover.createCtaBody')}
        </Text>
      </View>
    </Pressable>
  );
}

const CARD_WIDTH = 272;

const styles = StyleSheet.create({
  bleed: { marginHorizontal: -16 },
  rail: { paddingHorizontal: 16, gap: 10 },
  card: {
    width: CARD_WIDTH,
    backgroundColor: colors.surface,
    borderRadius: radius.card,
    padding: 16,
    gap: 6,
  },
  cardName: {
    fontFamily: fonts.displaySemibold,
    fontSize: 20,
    lineHeight: 25,
    color: colors.label,
  },
  cardFoot: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 8,
    marginTop: 8,
  },
  cardMeta: { flex: 1, minWidth: 0, gap: 2 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    backgroundColor: colors.accentSoft,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  spots: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  group: { backgroundColor: colors.surface, borderRadius: radius.listLarge, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.accentSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  pressed: { opacity: 0.7 },
  texts: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 16 },
  tplCard: {
    width: 196,
    backgroundColor: colors.surface,
    borderRadius: radius.list,
    padding: 14,
    gap: 6,
  },
  tplTitle: {
    fontFamily: fonts.displaySemibold,
    fontSize: 18,
    lineHeight: 22,
    color: colors.label,
  },
  templateList: { gap: 10 },
  cta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: radius.listLarge,
    padding: 16,
    marginTop: 24,
  },
  ctaIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
