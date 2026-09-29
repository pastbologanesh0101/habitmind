import type { Habit } from "./types";

const KEY = "habitmind:v1";

/** Browser-only persistence. Swap this module for an API client to add sync. */
export function loadHabits(): Habit[] | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveHabits(habits: Habit[]): void {
  try {
    window.localStorage.setItem(KEY, JSON.stringify(habits));
  } catch {
    // Storage full or blocked (private mode) — the session still works in memory.
  }
}

export function toggleCompletion(habit: Habit, day: string): Habit {
  const has = habit.completions.includes(day);
  const completions = has
    ? habit.completions.filter((d) => d !== day)
    : [...habit.completions, day].sort();
  return { ...habit, completions };
}
