import { t } from '../../i18n';
import type { WidgetView } from './snapshot';

/** The widget's top line: what's left, or why there's nothing to show. */
export function widgetHeading(view: WidgetView): string {
  if (!view.cards) return t('widget.open');
  if (view.cards.length === 0) return t('widget.nothing');
  if (view.left === 0) return t('widget.allDone');
  return view.left === 1 ? t('widget.leftOne') : t('widget.left', { n: view.left });
}
