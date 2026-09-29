import type { DayKey } from "./dates";

export interface Habit {
  id: string;
  name: string;
  emoji: string;
  /** Day the habit was created; days before this don't count against it. */
  createdAt: DayKey;
  /** Sorted, de-duplicated list of days the habit was completed. */
  completions: DayKey[];
}

export interface WeekdayStat {
  weekday: number;
  done: number;
  total: number;
  rate: number;
}

export interface HabitStats {
  id: string;
  name: string;
  emoji: string;
  currentStreak: number;
  longestStreak: number;
  /** Completion rate over the analysis window (0-1). */
  rate: number;
  /** Days of history inside the analysis window. */
  trackedDays: number;
  /** Rate over the most recent 14 days minus the 14 before (null if not enough data). */
  trend: number | null;
  recentRate: number | null;
  weekdays: WeekdayStat[];
  bestWeekday: WeekdayStat | null;
  worstWeekday: WeekdayStat | null;
  doneToday: boolean;
  /** Streak of 3+ that breaks if today is skipped. */
  streakAtRisk: boolean;
}

export interface HabitLink {
  /** When `from` is done, `to` happens this much more often (absolute rate difference). */
  from: string;
  to: string;
  withRate: number;
  withoutRate: number;
  lift: number;
  sharedDays: number;
}

export interface Analysis {
  today: DayKey;
  windowDays: number;
  habits: HabitStats[];
  links: HabitLink[];
  /** Mean completion rate across habits, 0-100. */
  consistencyScore: number;
  /** Weekday with the lowest completion across all habits. */
  weakestWeekday: WeekdayStat | null;
}

export type InsightKind =
  | "streak-risk"
  | "weekday-dip"
  | "declining"
  | "improving"
  | "habit-link"
  | "struggling"
  | "strong"
  | "getting-started";

export interface Insight {
  kind: InsightKind;
  habitId?: string;
  title: string;
  detail: string;
  action: string;
  /** Higher sorts first. */
  priority: number;
}
