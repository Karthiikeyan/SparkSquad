import { Platform } from 'react-native';
import type * as WidgetLib from 'react-native-android-widget';
import { removePref } from '../../lib/prefs';
import type { TodayCard, TodaySource } from '../today/model';
import type * as WidgetView from './SquadWidget';
import {
  buildWidgetSnapshot,
  buildWidgetView,
  readWidgetSnapshot,
  saveWidgetSnapshot,
} from './snapshot';
import { localDateFromDevice } from './today';

/** Redraws every placed widget at its own size. Android only. */
function redraw(): void {
  if (Platform.OS !== 'android') return;
  /* eslint-disable @typescript-eslint/no-require-imports -- lazy native module */
  const { requestWidgetUpdate } = require('react-native-android-widget') as typeof WidgetLib;
  const { SquadWidget, WIDGET_NAME } = require('./SquadWidget') as typeof WidgetView;
  /* eslint-enable @typescript-eslint/no-require-imports */
  const view = buildWidgetView(readWidgetSnapshot(), localDateFromDevice());
  requestWidgetUpdate({
    widgetName: WIDGET_NAME,
    renderWidget: (info) => <SquadWidget view={view} width={info.width} height={info.height} />,
  }).catch(() => undefined);
}

/** Saves what's due for the widget and redraws it when something changed. */
export function syncWidget(cards: readonly TodayCard[], source: TodaySource): void {
  if (Platform.OS !== 'android') return;
  if (saveWidgetSnapshot(buildWidgetSnapshot(cards, source, localDateFromDevice()))) redraw();
}

/** A task was ticked in the app. */
export function refreshWidget(): void {
  redraw();
}

/** Sign-out: nothing about the old account stays on the home screen. */
export function clearWidget(): void {
  removePref('widgetSnapshot');
  redraw();
}
