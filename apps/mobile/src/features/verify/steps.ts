import type { LocalDate } from '@sparksquad/shared';
import type * as HealthConnectModule from 'react-native-health-connect';
import type * as HealthKitModule from '@kingstinct/react-native-healthkit';
import { Linking, Platform } from 'react-native';
import { getPref, removePref, setPref } from '../../lib/prefs';

type HealthConnect = typeof HealthConnectModule;
type HealthKit = typeof HealthKitModule;

export type StepsStatus =
  | 'available'
  /** Android: Health Connect is missing or needs an update. */
  | 'needsInstall'
  | 'unsupported';

export type StepsResult =
  { kind: 'ok'; count: number } | { kind: 'notConnected' } | { kind: 'error' };

const HC_PACKAGE = 'com.google.android.apps.healthdata';
const STEPS_PERMISSION = { accessType: 'read', recordType: 'Steps' } as const;
const STEP_COUNT = 'HKQuantityTypeIdentifierStepCount' as const;

/* eslint-disable @typescript-eslint/no-require-imports -- native modules load lazily */
const healthConnect = () => require('react-native-health-connect') as HealthConnect;
const healthKit = () => require('@kingstinct/react-native-healthkit') as HealthKit;
/* eslint-enable @typescript-eslint/no-require-imports */

/** Device-local midnight to the next midnight (or now, for today). */
export function dayBounds(date: LocalDate, now = new Date()): { start: Date; end: Date } {
  const [y = 1970, m = 1, d = 1] = date.split('-').map(Number);
  const start = new Date(y, m - 1, d);
  const next = new Date(y, m - 1, d + 1);
  return { start, end: next < now ? next : now };
}

export async function stepsStatus(): Promise<StepsStatus> {
  try {
    if (Platform.OS === 'android') {
      const hc = healthConnect();
      const status = await hc.getSdkStatus();
      if (status === hc.SdkAvailabilityStatus.SDK_AVAILABLE) return 'available';
      // Missing or outdated Health Connect: offer the Play Store page.
      return 'needsInstall';
    }
    if (Platform.OS === 'ios')
      return healthKit().isHealthDataAvailable() ? 'available' : 'unsupported';
  } catch {
    // Native module missing (Expo Go, web, tests).
  }
  return 'unsupported';
}

export const stepsConnected = () => getPref('stepsConnected') === true;

/** Asks for read access to steps; remembers the answer for the check-in sheet. */
export async function connectSteps(): Promise<boolean> {
  try {
    let granted = false;
    if (Platform.OS === 'android') {
      const hc = healthConnect();
      await hc.initialize();
      const got = await hc.requestPermission([STEPS_PERMISSION]);
      granted = got.some((p) => 'recordType' in p && p.recordType === 'Steps');
    } else if (Platform.OS === 'ios') {
      // HealthKit never says whether reading was allowed; a denied read returns no steps.
      granted = await healthKit().requestAuthorization({ toRead: [STEP_COUNT] });
    }
    if (granted) setPref('stepsConnected', true);
    return granted;
  } catch {
    return false;
  }
}

export function disconnectSteps(): void {
  removePref('stepsConnected');
}

export function openHealthConnectInstall(): void {
  void Linking.openURL(`market://details?id=${HC_PACKAGE}`).catch(() =>
    Linking.openURL(`https://play.google.com/store/apps/details?id=${HC_PACKAGE}`),
  );
}

/** Steps walked on `date` (device-local day), read on the phone; never uploaded. */
export async function readSteps(date: LocalDate, now = new Date()): Promise<StepsResult> {
  if (!stepsConnected()) return { kind: 'notConnected' };
  const { start, end } = dayBounds(date, now);
  if (end <= start) return { kind: 'ok', count: 0 };
  try {
    if (Platform.OS === 'android') {
      const hc = healthConnect();
      await hc.initialize();
      const res = await hc.aggregateRecord({
        recordType: 'Steps',
        timeRangeFilter: {
          operator: 'between',
          startTime: start.toISOString(),
          endTime: end.toISOString(),
        },
      });
      return { kind: 'ok', count: Math.round(res.COUNT_TOTAL ?? 0) };
    }
    if (Platform.OS === 'ios') {
      const res = await healthKit().queryStatisticsForQuantity(STEP_COUNT, ['cumulativeSum'], {
        filter: { date: { startDate: start, endDate: end } },
      });
      return { kind: 'ok', count: Math.round(res.sumQuantity?.quantity ?? 0) };
    }
  } catch {
    return { kind: 'error' };
  }
  return { kind: 'notConnected' };
}
