import 'expo-router/entry';
import { Platform } from 'react-native';
import type * as WidgetLib from 'react-native-android-widget';
import type * as WidgetTask from './src/features/widget/taskHandler';

// Android draws the home-screen widget through this background task.
if (Platform.OS === 'android') {
  /* eslint-disable @typescript-eslint/no-require-imports -- Android-only native module */
  const { registerWidgetTaskHandler } = require('react-native-android-widget') as typeof WidgetLib;
  const { widgetTaskHandler } = require('./src/features/widget/taskHandler') as typeof WidgetTask;
  /* eslint-enable @typescript-eslint/no-require-imports */
  registerWidgetTaskHandler(widgetTaskHandler);
}
