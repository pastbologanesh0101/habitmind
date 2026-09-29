import { addDays, dayRange, maxKey, weekday, type DayKey } from "./dates";
import type { Analysis, Habit, HabitLink, HabitStats, WeekdayStat } from "./types";

export const DEFAULT_WINDOW = 56;
const MIN_WEEKDAY_SAMPLES = 2;
const MIN_LINK_SAMPLES = 5;
const MIN_LINK_LIFT = 0.25;

function round(n: number, digits = 2): number {
  const f = 10 ** digits;
  return Math.round(n * f) / f;
}

/**
 * Last day that should count towards a habit's stats. Today only counts once it's
 * done — an unchecked habit at 9am hasn't been missed yet.
 */
function evaluationEnd(done: Set<DayKey>, today: DayKey): DayKey {
  return done.has(today) ? today : addDays(today, -1);
}

export function currentStreak(done: Set<DayKey>, today: DayKey): number {
  let day = evaluationEnd(done, today);
  let streak = 0;
  while (done.has(day)) {
    streak++;
    day = addDays(day, -1);
  }
  return streak;
}

export function longestStreak(completions: DayKey[]): number {
  const sorted = [...new Set(completions)].sort();
  let best = 0;
  let run = 0;
  for (let i = 0; i < sorted.length; i++) {
    run = i > 0 && addDays(sorted[i - 1], 1) === sorted[i] ? run + 1 : 1;
    best = Math.max(best, run);
  }
  return best;
}

function rateOver(days: DayKey[], done: Set<DayKey>): number {
  if (days.length === 0) return 0;
  return days.filter((d) => done.has(d)).length / days.length;
}

function emptyWeekdays(): WeekdayStat[] {
  return Array.from({ length: 7 }, (_, i) => ({ weekday: i, done: 0, total: 0, rate: 0 }));
}

function weekdayStats(days: DayKey[], done: Set<DayKey>): WeekdayStat[] {
  const stats = emptyWeekdays();
  for (const d of days) {
    const s = stats[weekday(d)];
    s.total++;
    if (done.has(d)) s.done++;
  }
  for (const s of stats) s.rate = s.total ? round(s.done / s.total) : 0;
  return stats;
}

function extremes(stats: WeekdayStat[]): { best: WeekdayStat | null; worst: WeekdayStat | null } {
  const eligible = stats.filter((s) => s.total >= MIN_WEEKDAY_SAMPLES);
  if (eligible.length < 3) return { best: null, worst: null };
  const best = eligible.reduce((a, b) => (b.rate > a.rate ? b : a));
  const worst = eligible.reduce((a, b) => (b.rate < a.rate ? b : a));
  return { best, worst };
}

/** Days of `habit` that count towards its stats inside the analysis window. */
function evaluatedDays(habit: Habit, done: Set<DayKey>, today: DayKey, windowDays: number): DayKey[] {
  const start = maxKey(habit.createdAt, addDays(today, -(windowDays - 1)));
  return dayRange(start, evaluationEnd(done, today));
}

export function habitStats(habit: Habit, today: DayKey, windowDays = DEFAULT_WINDOW): HabitStats {
  const done = new Set(habit.completions);
  const days = evaluatedDays(habit, done, today, windowDays);

  let trend: number | null = null;
  let recentRate: number | null = null;
  if (days.length >= 28) {
    const recent = days.slice(-14);
    const prior = days.slice(-28, -14);
    recentRate = round(rateOver(recent, done));
    trend = round(recentRate - rateOver(prior, done));
  }

  const weekdays = weekdayStats(days, done);
  const { best, worst } = extremes(weekdays);
  const streak = currentStreak(done, today);
  const doneToday = done.has(today);

  return {
    id: habit.id,
    name: habit.name,
    emoji: habit.emoji,
    currentStreak: streak,
    longestStreak: longestStreak(habit.completions),
    rate: round(rateOver(days, done)),
    trackedDays: days.length,
    trend,
    recentRate,
    weekdays,
    bestWeekday: best,
    worstWeekday: worst,
    doneToday,
    streakAtRisk: !doneToday && streak >= 3,
  };
}

/**
 * For every ordered pair (A, B), compare how often B happens on days A was done vs.
 * days it wasn't. A large gap suggests the habits travel together — a candidate for
 * habit stacking. This is correlation, not causation, and the UI says so.
 */
export function habitLinks(habits: Habit[], today: DayKey, windowDays = DEFAULT_WINDOW): HabitLink[] {
  const yesterday = addDays(today, -1);
  const windowStart = addDays(today, -(windowDays - 1));
  const sets = new Map(habits.map((h) => [h.id, new Set(h.completions)]));
  const links: HabitLink[] = [];

  for (const a of habits) {
    for (const b of habits) {
      if (a.id === b.id) continue;
      const days = dayRange(maxKey(windowStart, maxKey(a.createdAt, b.createdAt)), yesterday);
      const doneA = sets.get(a.id)!;
      const doneB = sets.get(b.id)!;
      const withA = days.filter((d) => doneA.has(d));
      const withoutA = days.filter((d) => !doneA.has(d));
      if (withA.length < MIN_LINK_SAMPLES || withoutA.length < MIN_LINK_SAMPLES) continue;
      const withRate = rateOver(withA, doneB);
      const withoutRate = rateOver(withoutA, doneB);
      const lift = withRate - withoutRate;
      if (lift < MIN_LINK_LIFT) continue;
      links.push({
        from: a.id,
        to: b.id,
        withRate: round(withRate),
        withoutRate: round(withoutRate),
        lift: round(lift),
        sharedDays: days.length,
      });
    }
  }

  // Keep the stronger direction of each pair, strongest first.
  links.sort((x, y) => y.lift - x.lift);
  const seen = new Set<string>();
  return links.filter((l) => {
    const key = [l.from, l.to].sort().join("|");
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function analyze(habits: Habit[], today: DayKey, windowDays = DEFAULT_WINDOW): Analysis {
  const stats = habits.map((h) => habitStats(h, today, windowDays));
  const scored = stats.filter((s) => s.trackedDays > 0);
  const consistencyScore = scored.length
    ? Math.round((scored.reduce((sum, s) => sum + s.rate, 0) / scored.length) * 100)
    : 0;

  const totals = emptyWeekdays();
  for (const s of stats) {
    for (const w of s.weekdays) {
      totals[w.weekday].done += w.done;
      totals[w.weekday].total += w.total;
    }
  }
  for (const t of totals) t.rate = t.total ? round(t.done / t.total) : 0;

  return {
    today,
    windowDays,
    habits: stats,
    links: habitLinks(habits, today, windowDays),
    consistencyScore,
    weakestWeekday: extremes(totals).worst,
  };
}
