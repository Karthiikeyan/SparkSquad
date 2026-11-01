import type { Category } from '@sparksquad/shared';
import { LayoutGrid, SlidersHorizontal, type LucideIcon } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { BottomSheet, Button, Pressable, Text } from '../../components/ui';
import { t } from '../../i18n';
import { CATEGORY_ICON } from '../../lib/categories';
import { colors, iconStroke, radius } from '../../theme/tokens';

export type CategoryValue = Category | 'all';

/** How many categories sit on the screen next to "All". */
export const VISIBLE_CATEGORIES = 3;

/** The row's categories: the first few, with the current choice always on show in the last slot. */
export function visibleCategories(
  categories: readonly Category[],
  value: CategoryValue,
  count: number = VISIBLE_CATEGORIES,
): Category[] {
  const shown = categories.slice(0, count);
  if (value === 'all' || shown.includes(value) || !categories.includes(value)) return shown;
  return [...shown.slice(0, count - 1), value];
}

function Tile({
  label,
  icon: Icon,
  selected,
  onPress,
  testID,
}: {
  label: string;
  icon: LucideIcon;
  selected: boolean;
  onPress: () => void;
  testID?: string;
}) {
  const fg = selected ? colors.onAccent : colors.chipLabel;
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={label}
      style={[styles.tile, selected ? styles.tileOn : styles.tileOff]}
      testID={testID}
    >
      <Icon size={18} color={fg} strokeWidth={iconStroke} />
      <Text
        numberOfLines={1}
        adjustsFontSizeToFit
        minimumFontScale={0.8}
        variant="caption"
        style={{ color: fg }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * Everything fits one row: All, three categories (the user's interests first) and a filter button
 * that opens the full list. `extra` adds more controls to the sheet (Discover's sort).
 */
export function CategoryFilter({
  categories,
  value,
  onChange,
  extra,
  active,
}: {
  categories: readonly Category[];
  value: CategoryValue;
  onChange: (value: CategoryValue) => void;
  extra?: ReactNode;
  /** Show the dot on the filter button (a non-default choice hidden in the sheet). */
  active?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const allLabel = t('categories.all');
  return (
    <>
      <View
        style={styles.row}
        accessibilityRole="radiogroup"
        accessibilityLabel={t('discover.categories')}
      >
        <Tile
          label={allLabel}
          icon={LayoutGrid}
          selected={value === 'all'}
          onPress={() => onChange('all')}
          testID="discover-all"
        />
        {visibleCategories(categories, value).map((c) => (
          <Tile
            key={c}
            label={t(`categories.${c}`)}
            icon={CATEGORY_ICON[c]}
            selected={value === c}
            onPress={() => onChange(c)}
            testID={`discover-cat-${c}`}
          />
        ))}
        <Pressable
          onPress={() => setOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={t('discover.filter')}
          style={[styles.tile, styles.tileOff, styles.more]}
          testID="discover-filter"
        >
          <SlidersHorizontal size={18} color={colors.chipLabel} strokeWidth={iconStroke} />
          {active ? <View style={styles.dot} /> : null}
        </Pressable>
      </View>
      <BottomSheet
        visible={open}
        onClose={() => setOpen(false)}
        accessibilityLabel={t('discover.filter')}
      >
        <Text variant="title2" accessibilityRole="header">
          {t('discover.filter')}
        </Text>
        <Text variant="footnote" color="label2" style={styles.label}>
          {t('discover.categories')}
        </Text>
        <View style={styles.grid} accessibilityRole="radiogroup">
          {(['all', ...categories] as const).map((c) => (
            <View key={c} style={styles.cell}>
              <Tile
                label={c === 'all' ? allLabel : t(`categories.${c}`)}
                icon={c === 'all' ? LayoutGrid : CATEGORY_ICON[c]}
                selected={value === c}
                onPress={() => onChange(c)}
                testID={`filter-cat-${c}`}
              />
            </View>
          ))}
        </View>
        {extra}
        <Button
          label={t('common.done')}
          onPress={() => setOpen(false)}
          style={styles.done}
          testID="filter-done"
        />
      </BottomSheet>
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 8 },
  tile: {
    flex: 1,
    height: 58,
    borderRadius: radius.input,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: 4,
  },
  tileOff: { backgroundColor: colors.control },
  tileOn: { backgroundColor: colors.accent },
  more: { flex: 0, width: 46 },
  dot: {
    position: 'absolute',
    top: 10,
    right: 10,
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: colors.accent,
  },
  label: { marginTop: 14, marginBottom: 8 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -4 },
  cell: { width: '33.33%', padding: 4 },
  done: { marginTop: 16 },
});
