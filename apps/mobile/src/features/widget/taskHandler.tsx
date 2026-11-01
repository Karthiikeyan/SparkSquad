import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { SquadWidget, TICK_ACTION } from './SquadWidget';
import { buildWidgetView, readWidgetSnapshot, tickWidgetTask } from './snapshot';
import { localDateFromDevice } from './today';

/** Android calls this in the background to draw the widget and handle ticks; no network needed. */
export async function widgetTaskHandler({
  widgetAction,
  widgetInfo,
  clickAction,
  clickActionData,
  renderWidget,
}: WidgetTaskHandlerProps) {
  if (widgetAction === 'WIDGET_DELETED') return;
  const snapshot = readWidgetSnapshot();
  if (widgetAction === 'WIDGET_CLICK' && clickAction === TICK_ACTION && clickActionData) {
    tickWidgetTask(
      snapshot,
      String(clickActionData.challengeId),
      String(clickActionData.date),
      Number(clickActionData.index),
    );
  }
  renderWidget(
    <SquadWidget
      view={buildWidgetView(snapshot, localDateFromDevice())}
      width={widgetInfo.width}
      height={widgetInfo.height}
    />,
  );
}
