import type { PlanTask } from '@sparksquad/shared';
import { formatNumber, t } from '../../i18n';

/** Meta line under a task title on Today ("1 of 2 problems, auto-checks from LeetCode"). */
export function taskMeta(task: PlanTask, value: number | boolean | undefined): string {
  let base: string;
  if (task.type === 'count') {
    const done = typeof value === 'number' ? value : value === true ? (task.target ?? 1) : 0;
    base = t('today.metaCount', {
      done: formatNumber(done),
      target: formatNumber(task.target ?? 1),
      unit: task.unit ?? '',
    }).trim();
  } else if (task.type === 'minutes') {
    base = t('today.metaMinutes', { target: formatNumber(task.target ?? 1) });
  } else {
    base = t('today.metaCheck');
  }
  if (task.verify && task.verify !== 'steps') {
    base += t('today.autoCheck', { source: t(`verifySources.${task.verify}`) });
  }
  return base;
}

/** Target line in the check-in sheet ("Target 30 minutes"). */
export function targetLabel(task: PlanTask): string {
  if (task.type === 'check') return t('checkin.checkMeta');
  const unit = task.type === 'minutes' ? t('checkin.minutes') : (task.unit ?? '');
  return t('checkin.target', { target: formatNumber(task.target ?? 1), unit }).trim();
}

/** Spoken unit for stepper buttons ("Increase minutes"). */
export function stepperUnit(task: PlanTask): string {
  return task.type === 'minutes' ? t('checkin.minutes') : task.unit || task.title;
}
