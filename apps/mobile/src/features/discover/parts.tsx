import type { SquadPreviewDTO, TemplateSummaryDTO } from '@sparksquad/shared';
import { StyleSheet, View } from 'react-native';
import { Button, Text } from '../../components/ui';
import { t } from '../../i18n';
import { colors, radius } from '../../theme/tokens';
import { TemplateTile } from '../create/screens/TemplatesScreen';
import { openSquadPreview, openTemplate, squadMeta, squadPlanLine } from './model';

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
        const plan = squadPlanLine(s);
        return (
          <View key={s.id} style={[styles.row, i > 0 && styles.separator]}>
            <View style={styles.texts}>
              <Text variant="bodySemibold" style={styles.name} numberOfLines={1}>
                {s.name}
              </Text>
              {plan ? (
                <Text variant="footnote" color="label2" numberOfLines={1}>
                  {plan}
                </Text>
              ) : null}
              <Text variant="footnote" color="label2" numberOfLines={1}>
                {squadMeta(s, today)}
              </Text>
            </View>
            <Button
              label={t('discover.join')}
              variant="soft"
              size="sm"
              accessibilityLabel={t('discover.joinLabel', { name: s.name })}
              onPress={() => openSquadPreview(s.id)}
              testID={`discover-${s.id}`}
            />
          </View>
        );
      })}
    </View>
  );
}

export function TemplateGrid({ templates }: { templates: readonly TemplateSummaryDTO[] }) {
  return (
    <View style={styles.grid}>
      {templates.map((tpl) => (
        <View key={tpl.slug} style={styles.cell}>
          <TemplateTile tpl={tpl} onPress={() => openTemplate(tpl.slug)} />
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { backgroundColor: colors.surface, borderRadius: radius.listLarge, paddingHorizontal: 16 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
  texts: { flex: 1, minWidth: 0, gap: 3 },
  name: { fontSize: 16 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -5 },
  cell: { width: '50%', padding: 5 },
});
