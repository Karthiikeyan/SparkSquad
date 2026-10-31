import { FlashList } from '@shopify/flash-list';
import type { ReactElement, ReactNode } from 'react';
import { RefreshControl, StyleSheet, View } from 'react-native';
import { colors, radius } from '../../theme/tokens';
import { SectionLabel } from './GroupedList';

export interface ListSection<T> {
  key: string;
  title?: string;
  data: readonly T[];
}

type Item<T> =
  | { kind: 'title'; key: string; title: string }
  | { kind: 'row'; key: string; item: T; first: boolean; last: boolean };

export interface SectionedListProps<T> {
  sections: readonly ListSection<T>[];
  keyOf: (item: T) => string;
  renderRow: (item: T, pos: { first: boolean; last: boolean }) => ReactElement;
  /** Scrolls with the list (title, banners, empty/error states). */
  header?: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
}

/** Flattens sections into one list of titles and rows (exported for tests). */
export function flattenSections<T>(
  sections: readonly ListSection<T>[],
  keyOf: (item: T) => string,
): Item<T>[] {
  const out: Item<T>[] = [];
  for (const s of sections) {
    if (s.data.length === 0) continue;
    if (s.title) out.push({ kind: 'title', key: `t:${s.key}`, title: s.title });
    s.data.forEach((item, i) =>
      out.push({
        kind: 'row',
        key: `r:${s.key}:${keyOf(item)}`,
        item,
        first: i === 0,
        last: i === s.data.length - 1,
      }),
    );
  }
  return out;
}

/**
 * Virtualised grouped list (FlashList): rounded surface per section with hairlines between
 * rows, same look as GroupedList. Use inside `<Screen scroll={false}>` for long lists.
 */
export function SectionedList<T>({
  sections,
  keyOf,
  renderRow,
  header,
  refreshing,
  onRefresh,
}: SectionedListProps<T>) {
  const items = flattenSections(sections, keyOf);
  return (
    <FlashList
      data={items}
      keyExtractor={(i) => i.key}
      getItemType={(i) => i.kind}
      ListHeaderComponent={header ? <View>{header}</View> : null}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={!!refreshing}
            onRefresh={onRefresh}
            tintColor={colors.label2}
            colors={[colors.accent]}
            progressBackgroundColor={colors.surface}
          />
        ) : undefined
      }
      renderItem={({ item }) =>
        item.kind === 'title' ? (
          <SectionLabel>{item.title}</SectionLabel>
        ) : (
          <View
            style={[
              styles.row,
              item.first && styles.first,
              item.last && styles.last,
              !item.first && styles.separator,
            ]}
          >
            {renderRow(item.item, { first: item.first, last: item.last })}
          </View>
        )
      }
    />
  );
}

const styles = StyleSheet.create({
  row: { backgroundColor: colors.surface, paddingHorizontal: 16 },
  first: { borderTopLeftRadius: radius.list, borderTopRightRadius: radius.list },
  last: {
    borderBottomLeftRadius: radius.list,
    borderBottomRightRadius: radius.list,
    marginBottom: 20,
  },
  separator: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.separator },
});
