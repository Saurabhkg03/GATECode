// src/utils/contestSchedule.ts

// Weekly contests: Every Sunday at 10:00 AM IST.
// Biweekly contests: Every other Saturday at 8:00 PM IST.
// Epoch based on platform launch (Jan 2025) so numbering starts from 1.

// Epochs set to the very first contest so numbering starts at 1 and increments each cycle.
// Weekly: every Sunday 10:00 AM IST — first contest: 2026-03-01
// Biweekly: every other Saturday 8:00 PM IST — first contest: 2026-02-28
const WEEKLY_EPOCH = new Date("2026-03-01T10:00:00+05:30").getTime();
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

const BIWEEKLY_EPOCH = new Date("2026-02-28T20:00:00+05:30").getTime();
const BIWEEK_MS = 14 * 24 * 60 * 60 * 1000;

const DEFAULT_WEEKLY_DURATION_MINUTES = 90;
const DEFAULT_BIWEEKLY_DURATION_MINUTES = 120;

export interface UpcomingContestInfo {
  id: string;
  number: number;
  startTime: Date;
  endTime: Date;
  type: "weekly" | "biweekly";
  durationMinutes: number;
}

export const getNextWeeklyContest = (now = new Date()): UpcomingContestInfo => {
  const nowMs = now.getTime();
  const weeksPassed = Math.floor((nowMs - WEEKLY_EPOCH) / WEEK_MS);
  // If we're past epoch, next = weeksPassed + 1; if before epoch, next = 1.
  const nextNumber = Math.max(1, weeksPassed + 1);
  const nextStartMs = WEEKLY_EPOCH + nextNumber * WEEK_MS;
  const startTime = new Date(nextStartMs);
  const endTime = new Date(nextStartMs + DEFAULT_WEEKLY_DURATION_MINUTES * 60 * 1000);

  return {
    id: `weekly-${nextNumber}`,
    number: nextNumber,
    startTime,
    endTime,
    type: "weekly",
    durationMinutes: DEFAULT_WEEKLY_DURATION_MINUTES,
  };
};

export const getNextBiweeklyContest = (now = new Date()): UpcomingContestInfo => {
  const nowMs = now.getTime();
  const biweeksPassed = Math.floor((nowMs - BIWEEKLY_EPOCH) / BIWEEK_MS);
  const nextNumber = Math.max(1, biweeksPassed + 1);
  const nextStartMs = BIWEEKLY_EPOCH + nextNumber * BIWEEK_MS;
  const startTime = new Date(nextStartMs);
  const endTime = new Date(nextStartMs + DEFAULT_BIWEEKLY_DURATION_MINUTES * 60 * 1000);

  return {
    id: `biweekly-${nextNumber}`,
    number: nextNumber,
    startTime,
    endTime,
    type: "biweekly",
    durationMinutes: DEFAULT_BIWEEKLY_DURATION_MINUTES,
  };
};
