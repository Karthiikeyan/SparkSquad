import { endDate } from '@sparksquad/shared';
import { eq, and } from 'drizzle-orm';
import type { Db } from '../db/client';
import { challenges, memberSummary, streaks } from '../db/schema';
import type { Bindings } from '../env';
import { challengeMembers, rangeStats } from '../services/leaderboard';
import { addNotification } from '../services/notify';
import { awardBadges } from '../services/streaks';

type ChallengeRow = typeof challenges.$inferSelect;

/** Members at or above this consistency earn "Challenge complete". */
export const CHALLENGE_COMPLETE_THRESHOLD = 0.8;

/** Ends a challenge: writes member roll-ups, awards badges, notifies the squad. Idempotent. */
export async function finishChallenge(_env: Bindings, db: Db, ch: ChallengeRow): Promise<void> {
  const ts = new Date().toISOString();
  const last = endDate(ch.startDate, ch.durationDays);
  const members = await challengeMembers(db, ch.squadId);
  // Use a far-future "today" so the full range counts for everyone, but never past the end date.
  const stats = await rangeStats(
    db,
    ch,
    members.map((m) => ({ ...m, user: { ...m.user, timezone: 'Pacific/Kiritimati' } })),
    { from: ch.startDate, to: last },
  );
  for (const s of stats) {
    const streak = await db
      .select({ best: streaks.best })
      .from(streaks)
      .where(and(eq(streaks.userId, s.userId), eq(streaks.scope, ch.id)))
      .get();
    await db
      .insert(memberSummary)
      .values({
        challengeId: ch.id,
        userId: s.userId,
        daysDone: s.daysDone,
        daysElapsed: s.daysElapsed,
        tasksDone: s.tasksDone,
        bestStreak: streak?.best ?? 0,
        updatedAt: ts,
      })
      .onConflictDoUpdate({
        target: [memberSummary.challengeId, memberSummary.userId],
        set: {
          daysDone: s.daysDone,
          daysElapsed: s.daysElapsed,
          tasksDone: s.tasksDone,
          bestStreak: streak?.best ?? 0,
          updatedAt: ts,
        },
      })
      .run();
    const completed =
      s.daysElapsed > 0 && s.daysDone / s.daysElapsed >= CHALLENGE_COMPLETE_THRESHOLD;
    if (completed) await awardBadges(db, s.userId, { currentStreak: 0, challengeCompleted: true });
    await addNotification(db, s.userId, 'challenge_ended', {
      challengeId: ch.id,
      squadId: ch.squadId,
      title: ch.title,
      daysDone: s.daysDone,
      daysElapsed: s.daysElapsed,
    });
  }
  await db
    .update(challenges)
    .set({ status: 'ended', endedAt: ts, updatedAt: ts })
    .where(eq(challenges.id, ch.id))
    .run();
}
