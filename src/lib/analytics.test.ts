import { describe, expect, it } from "vitest";
import { analyze, currentStreak, habitLinks, habitStats, longestStreak } from "./analytics";
import { addDays, dayRange, daysBetween, weekday } from "./dates";
import { demoHabits } from "./demo";
import { ruleInsights } from "./rules";
import { rateLimit } from "./rate-limit";
import { CoachRequestSchema, toCoachRequest } from "./coach";
import type { Habit } from "./types";

// 2026-09-28 is a Monday.
const TODAY = "2026-09-28";

function habit(id: string, completions: string[], createdAt = addDays(TODAY, -55)): Habit {
  return { id, name: id, emoji: "✅", createdAt, completions: [...completions].sort() };
}

function lastNDays(n: number, offset = 0): string[] {
  return Array.from({ length: n }, (_, i) => addDays(TODAY, -(i + offset)));
}

describe("dates", () => {
  it("adds days across month and year boundaries", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2024-03-01", -1)).toBe("2024-02-29");
  });

  it("counts days and weekdays", () => {
    expect(daysBetween("2026-09-01", "2026-09-28")).toBe(27);
    expect(weekday(TODAY)).toBe(1);
    expect(dayRange("2026-09-26", "2026-09-28")).toEqual(["2026-09-26", "2026-09-27", "2026-09-28"]);
    expect(dayRange("2026-09-28", "2026-09-26")).toEqual([]);
  });
});

describe("streaks", () => {
  it("counts a streak ending today", () => {
    expect(currentStreak(new Set(lastNDays(4)), TODAY)).toBe(4);
  });

  it("keeps yesterday's streak alive while today is unchecked", () => {
    expect(currentStreak(new Set(lastNDays(3, 1)), TODAY)).toBe(3);
  });

  it("resets after a missed day", () => {
    expect(currentStreak(new Set(lastNDays(3, 2)), TODAY)).toBe(0);
  });

  it("finds the longest run regardless of order or duplicates", () => {
    expect(longestStreak(["2026-01-05", "2026-01-03", "2026-01-04", "2026-01-04", "2026-01-10"])).toBe(3);
    expect(longestStreak([])).toBe(0);
  });
});

describe("habitStats", () => {
  it("doesn't count an unchecked today as a miss", () => {
    const s = habitStats(habit("a", lastNDays(10, 1), addDays(TODAY, -10)), TODAY);
    expect(s.trackedDays).toBe(10);
    expect(s.rate).toBe(1);
    expect(s.doneToday).toBe(false);
  });

  it("ignores days before the habit existed", () => {
    const s = habitStats(habit("a", [TODAY], TODAY), TODAY);
    expect(s.trackedDays).toBe(1);
    expect(s.rate).toBe(1);
  });

  it("flags a 3+ day streak that isn't done today as at risk", () => {
    expect(habitStats(habit("a", lastNDays(3, 1)), TODAY).streakAtRisk).toBe(true);
    expect(habitStats(habit("a", lastNDays(2, 1)), TODAY).streakAtRisk).toBe(false);
    expect(habitStats(habit("a", lastNDays(4)), TODAY).streakAtRisk).toBe(false);
  });

  it("computes a two-week trend", () => {
    // Done every day for the older 14 days, never in the last 14.
    const s = habitStats(habit("a", lastNDays(14, 15)), TODAY);
    expect(s.recentRate).toBe(0);
    expect(s.trend).toBe(-1);
  });

  it("returns null trend with under four weeks of history", () => {
    expect(habitStats(habit("a", lastNDays(5), addDays(TODAY, -10)), TODAY).trend).toBeNull();
  });

  it("finds best and worst weekdays", () => {
    const weekdaysOnly = lastNDays(56, 1).filter((d) => weekday(d) !== 0 && weekday(d) !== 6);
    const s = habitStats(habit("a", weekdaysOnly), TODAY);
    expect([0, 6]).toContain(s.worstWeekday!.weekday);
    expect(s.worstWeekday!.rate).toBe(0);
    expect(s.bestWeekday!.rate).toBe(1);
  });
});

describe("habitLinks", () => {
  it("detects a habit that travels with another", () => {
    const days = lastNDays(40, 1);
    const aDays = days.filter((_, i) => i % 2 === 0);
    const bDays = [...aDays, days[1], days[3]];
    const links = habitLinks([habit("a", aDays), habit("b", bDays)], TODAY);
    expect(links).toHaveLength(1);
    expect(links[0].lift).toBeGreaterThan(0.8);
  });

  it("ignores independent habits and thin data", () => {
    const days = lastNDays(40, 1);
    const a = days.filter((_, i) => i % 2 === 0);
    const b = days.filter((_, i) => i % 4 < 2);
    expect(habitLinks([habit("a", a), habit("b", b)], TODAY)).toEqual([]);
    expect(habitLinks([habit("a", lastNDays(3)), habit("b", lastNDays(3))], TODAY)).toEqual([]);
  });
});

describe("analyze + rule insights on demo data", () => {
  const analysis = analyze(demoHabits(TODAY), TODAY);
  const insights = ruleInsights(analysis);
  const kinds = new Set(insights.map((i) => i.kind));

  it("finds every planted pattern", () => {
    expect(kinds).toContain("streak-risk");
    expect(kinds).toContain("weekday-dip");
    expect(kinds).toContain("declining");
    expect(kinds).toContain("habit-link");
  });

  it("puts streak risk first", () => {
    expect(insights[0].kind).toBe("streak-risk");
    expect(insights[0].habitId).toBe("demo-meditate");
  });

  it("links reading with the phone curfew", () => {
    const pair = analysis.links.map((l) => [l.from, l.to].sort().join("|"));
    expect(pair).toContain("demo-nophone|demo-reading");
  });

  it("produces a consistency score in range", () => {
    expect(analysis.consistencyScore).toBeGreaterThan(40);
    expect(analysis.consistencyScore).toBeLessThanOrEqual(100);
  });

  it("builds a coach payload that passes server validation", () => {
    const req = toCoachRequest(analysis);
    expect(CoachRequestSchema.safeParse(req).success).toBe(true);
    expect(JSON.stringify(req)).not.toContain("2026-"); // no raw day log leaves the browser
  });
});

describe("ruleInsights", () => {
  it("asks new users to keep checking in", () => {
    expect(ruleInsights(analyze([], TODAY))[0].kind).toBe("getting-started");
  });
});

describe("rateLimit", () => {
  it("allows a burst up to the limit then blocks until the window resets", () => {
    const key = `test-${Math.random()}`;
    const results = Array.from({ length: 6 }, () => rateLimit(key, 1000));
    expect(results).toEqual([true, true, true, true, true, false]);
    expect(rateLimit(key, 1000 + 60_000)).toBe(true);
  });
});
