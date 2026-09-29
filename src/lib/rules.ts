import { WEEKDAY_NAMES } from "./dates";
import type { Analysis, HabitStats, Insight } from "./types";

const pct = (n: number) => `${Math.round(n * 100)}%`;
const label = (h: HabitStats) => `${h.emoji} ${h.name}`;

/**
 * Deterministic insights computed on-device. They're always available, work offline,
 * and are what the AI coach falls back to when no API key is configured.
 */
export function ruleInsights(analysis: Analysis): Insight[] {
  const out: Insight[] = [];
  const byId = new Map(analysis.habits.map((h) => [h.id, h]));

  if (analysis.habits.length === 0 || analysis.habits.every((h) => h.trackedDays < 7)) {
    out.push({
      kind: "getting-started",
      title: "Insights unlock after a week of data",
      detail:
        "Patterns like weak weekdays and habits that travel together need at least 7 days of check-ins.",
      action: "Check in every day this week — even misses teach the model something.",
      priority: 10,
    });
  }

  for (const h of analysis.habits) {
    if (h.streakAtRisk) {
      out.push({
        kind: "streak-risk",
        habitId: h.id,
        title: `Your ${h.currentStreak}-day ${label(h)} streak ends tonight`,
        detail: "You haven't checked it off today yet.",
        action: "Do the smallest possible version before bed — two minutes still counts.",
        priority: 100 + h.currentStreak,
      });
    }

    if (h.trend !== null && h.trend <= -0.2) {
      out.push({
        kind: "declining",
        habitId: h.id,
        title: `${label(h)} is slipping`,
        detail: `Down to ${pct(h.recentRate!)} over the last two weeks, ${pct(-h.trend)} lower than the two weeks before.`,
        action: "Figure out what changed two weeks ago — new schedule, travel, exams — and adjust the cue, not your willpower.",
        priority: 80 + Math.round(-h.trend * 10),
      });
    } else if (h.trend !== null && h.trend >= 0.2) {
      out.push({
        kind: "improving",
        habitId: h.id,
        title: `${label(h)} is picking up`,
        detail: `Up ${pct(h.trend)} compared with the previous two weeks.`,
        action: "Note what's working right now so you can repeat it when motivation dips.",
        priority: 40,
      });
    }

    if (h.bestWeekday && h.worstWeekday && h.bestWeekday.rate - h.worstWeekday.rate >= 0.4) {
      const worst = WEEKDAY_NAMES[h.worstWeekday.weekday];
      out.push({
        kind: "weekday-dip",
        habitId: h.id,
        title: `${label(h)} drops off on ${worst}s`,
        detail: `${pct(h.worstWeekday.rate)} on ${worst}s vs ${pct(h.bestWeekday.rate)} on ${WEEKDAY_NAMES[h.bestWeekday.weekday]}s.`,
        action: `Plan a lighter ${worst} version and set a reminder for it the night before.`,
        priority: 70,
      });
    }

    if (h.trackedDays >= 7 && h.rate < 0.4) {
      out.push({
        kind: "struggling",
        habitId: h.id,
        title: `${label(h)} might be too big right now`,
        detail: `Completed on ${pct(h.rate)} of days so far.`,
        action: "Shrink it until it feels almost too easy, then grow it once it sticks.",
        priority: 65,
      });
    } else if (h.trackedDays >= 14 && h.rate >= 0.85) {
      out.push({
        kind: "strong",
        habitId: h.id,
        title: `${label(h)} is locked in`,
        detail: `${pct(h.rate)} completion, best streak ${h.longestStreak} days.`,
        action: "Consider levelling it up slightly, or use it as an anchor to stack a new habit onto.",
        priority: 30,
      });
    }
  }

  for (const link of analysis.links.slice(0, 2)) {
    const from = byId.get(link.from);
    const to = byId.get(link.to);
    if (!from || !to) continue;
    out.push({
      kind: "habit-link",
      title: `${label(from)} seems to pull ${label(to)} along`,
      detail: `On days you do ${from.name}, ${to.name} happens ${pct(link.withRate)} of the time vs ${pct(link.withoutRate)} otherwise.`,
      action: `Stack them: do ${to.name} right after ${from.name}.`,
      priority: 60,
    });
  }

  return out.sort((a, b) => b.priority - a.priority);
}
