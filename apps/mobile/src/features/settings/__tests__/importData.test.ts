import type { MeDTO } from '@sparksquad/shared';
import { diffImport, isEmptyImport, parseExportFile } from '../importData';

const file = (extra: Record<string, unknown> = {}) =>
  JSON.stringify({
    exportedAt: '2026-10-01T00:00:00.000Z',
    profile: {
      displayName: 'Kiran',
      username: 'someone_else',
      timezone: 'Asia/Kolkata',
      avatarColor: 3,
      interests: ['coding'],
      reminderTime: '07:30',
      notifyNudges: false,
      plan: 'plus',
    },
    streaks: [{ current: 999 }],
    badges: [{ id: 'x' }],
    integrations: [
      { userId: 'U1', provider: 'github', handle: 'kiran' },
      { userId: 'U1', provider: 'myspace', handle: 'nope' },
    ],
    ...extra,
  });

describe('import from an export file', () => {
  it('restores settings and handles only', () => {
    const plan = parseExportFile(file())!;
    expect(plan.profile).toEqual({
      displayName: 'Kiran',
      avatarColor: 3,
      interests: ['coding'],
      reminderTime: '07:30',
      notifyNudges: false,
    });
    expect(plan.integrations).toEqual([{ provider: 'github', handle: 'kiran' }]);
  });

  it('never restores a username, timezone, plan, streak or badge', () => {
    const text = JSON.stringify(parseExportFile(file()));
    for (const banned of ['someone_else', 'Kolkata', 'plus', '999']) {
      expect(text).not.toContain(banned);
    }
  });

  it('skips fields that fail validation instead of rejecting the file', () => {
    const plan = parseExportFile(
      JSON.stringify({
        exportedAt: 'x',
        profile: { reminderTime: 'late', notifyNudges: 'yes', displayName: 'Kiran' },
      }),
    )!;
    expect(plan.profile).toEqual({ displayName: 'Kiran' });
  });

  it('rejects anything that is not an export', () => {
    expect(parseExportFile('not json')).toBeNull();
    expect(parseExportFile('[]')).toBeNull();
    expect(parseExportFile('{"sparksquad_plan":1}')).toBeNull();
  });

  it('keeps only what differs from this account', () => {
    const me = {
      displayName: 'Kiran',
      avatarColor: 3,
      interests: ['coding'],
      reminderTime: '20:00',
      notifyNudges: false,
    } as unknown as MeDTO;
    const plan = diffImport(parseExportFile(file())!, me, { github: 'kiran' });
    expect(plan.profile).toEqual({ reminderTime: '07:30' });
    expect(plan.integrations).toEqual([]);
    expect(isEmptyImport(plan)).toBe(false);
    expect(isEmptyImport({ profile: {}, integrations: [] })).toBe(true);
  });
});
