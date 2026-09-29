import { addDays, weekday, type DayKey } from "./dates";
import type { Habit } from "./types";

/** Small deterministic PRNG so the demo looks the same on every load. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Eight weeks of believable history with patterns baked in, so every insight type
 * has something to find: a weekend dip, a declining habit, two linked habits and a
 * live streak that's at risk today.
 */
export function demoHabits(today: DayKey): Habit[] {
  const rand = mulberry32(42);
  const days = 56;
  const start = addDays(today, -(days - 1));

  const workout: DayKey[] = [];
  const reading: DayKey[] = [];
  const noPhone: DayKey[] = [];
  const meditate: DayKey[] = [];
  const water: DayKey[] = [];

  for (let i = 0; i < days - 1; i++) {
    const d = addDays(start, i);
    const wd = weekday(d);
    const weekend = wd === 0 || wd === 6;
    const late = i >= days - 15;

    if (rand() < (weekend ? 0.2 : 0.9)) workout.push(d);

    const phoneFree = rand() < 0.55;
    if (phoneFree) noPhone.push(d);
    if (rand() < (phoneFree ? 0.9 : 0.25)) reading.push(d);

    if (rand() < (late ? 0.3 : 0.85)) meditate.push(d);
    if (rand() < 0.93) water.push(d);
  }

  // A live 5-day meditation streak, not yet done today.
  for (let k = 1; k <= 5; k++) meditate.push(addDays(today, -k));
  // Water and workout already done today.
  water.push(today);
  if (weekday(today) !== 0 && weekday(today) !== 6) workout.push(today);

  const uniq = (xs: DayKey[]) => [...new Set(xs)].sort();
  return [
    { id: "demo-workout", name: "Workout", emoji: "🏋️", createdAt: start, completions: uniq(workout) },
    { id: "demo-reading", name: "Read 20 pages", emoji: "📚", createdAt: start, completions: uniq(reading) },
    { id: "demo-nophone", name: "No phone after 10pm", emoji: "📵", createdAt: start, completions: uniq(noPhone) },
    { id: "demo-meditate", name: "Meditate", emoji: "🧘", createdAt: start, completions: uniq(meditate) },
    { id: "demo-water", name: "Drink 3L water", emoji: "💧", createdAt: start, completions: uniq(water) },
  ];
}
