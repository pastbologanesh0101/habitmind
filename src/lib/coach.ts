import { z } from "zod";
import { WEEKDAY_NAMES } from "./dates";
import type { Analysis, Insight } from "./types";

/**
 * What the browser sends to the AI coach: aggregated stats only, never the raw
 * day-by-day log. Validated server-side so the route can't be used as a free proxy.
 */
export const CoachRequestSchema = z.object({
  consistencyScore: z.number().min(0).max(100),
  weakestWeekday: z.string().max(12).nullable(),
  habits: z
    .array(
      z.object({
        name: z.string().min(1).max(60),
        rate: z.number().min(0).max(1),
        recentRate: z.number().min(0).max(1).nullable(),
        trend: z.number().min(-1).max(1).nullable(),
        currentStreak: z.number().int().min(0).max(10_000),
        longestStreak: z.number().int().min(0).max(10_000),
        bestWeekday: z.string().max(12).nullable(),
        worstWeekday: z.string().max(12).nullable(),
        doneToday: z.boolean(),
        trackedDays: z.number().int().min(0).max(10_000),
      }),
    )
    .min(1)
    .max(20),
  links: z
    .array(
      z.object({
        from: z.string().max(60),
        to: z.string().max(60),
        withRate: z.number().min(0).max(1),
        withoutRate: z.number().min(0).max(1),
      }),
    )
    .max(10),
});

export type CoachRequest = z.infer<typeof CoachRequestSchema>;

export const CoachReportSchema = z.object({
  headline: z.string().describe("One encouraging, specific sentence summarising the user's month."),
  focus: z.object({
    habit: z.string().describe("Exact name of the single habit that deserves attention this week."),
    reason: z.string(),
  }),
  suggestions: z
    .array(
      z.object({
        habit: z.string().describe("Exact habit name this suggestion is about."),
        observation: z.string().describe("What the numbers show, citing a specific figure."),
        action: z.string().describe("One concrete, small action for the next 7 days."),
      }),
    )
    .describe("Two to four suggestions, most impactful first."),
  experiment: z.object({
    title: z.string(),
    description: z.string().describe("A one-week experiment the user can run, with how to tell if it worked."),
  }),
  encouragement: z.string().describe("A short, warm closing line. No generic platitudes."),
});

export type CoachReport = z.infer<typeof CoachReportSchema>;

export type CoachResult =
  | { source: "ai"; report: CoachReport; model: string }
  | { source: "rules"; insights: Insight[]; reason: string };

export function toCoachRequest(analysis: Analysis): CoachRequest {
  const names = new Map(analysis.habits.map((h) => [h.id, h.name]));
  const day = (w: { weekday: number } | null) => (w ? WEEKDAY_NAMES[w.weekday] : null);
  return {
    consistencyScore: analysis.consistencyScore,
    weakestWeekday: day(analysis.weakestWeekday),
    habits: analysis.habits.slice(0, 20).map((h) => ({
      name: h.name.slice(0, 60),
      rate: h.rate,
      recentRate: h.recentRate,
      trend: h.trend,
      currentStreak: h.currentStreak,
      longestStreak: h.longestStreak,
      bestWeekday: day(h.bestWeekday),
      worstWeekday: day(h.worstWeekday),
      doneToday: h.doneToday,
      trackedDays: h.trackedDays,
    })),
    links: analysis.links.slice(0, 10).map((l) => ({
      from: (names.get(l.from) ?? "").slice(0, 60),
      to: (names.get(l.to) ?? "").slice(0, 60),
      withRate: l.withRate,
      withoutRate: l.withoutRate,
    })),
  };
}

export const COACH_SYSTEM_PROMPT = `You are HabitMind's habit coach. You receive aggregated statistics about one person's habits over the last eight weeks and write a short, personalised coaching report.

How to read the data:
- rate is the completion rate over the tracked window (0-1). recentRate is the last 14 days; trend is recentRate minus the 14 days before (null when there isn't enough history).
- bestWeekday / worstWeekday are the days with the highest and lowest completion for that habit.
- links are correlations: on days "from" is done, "to" happens withRate of the time vs withoutRate otherwise. They are correlations, not proof of cause — phrase them that way.
- A habit with doneToday=false and a currentStreak of 3 or more is at risk of losing its streak today.

How to coach:
- Ground every observation in a specific number from the data. Never invent habits, numbers or context you weren't given.
- Prefer small, concrete behaviour-design changes (cues, habit stacking, shrinking the habit, planning for weak days) over motivational talk.
- Use the exact habit names from the data.
- Be warm and direct. Keep each field to one or two sentences.`;

export function coachUserPrompt(req: CoachRequest): string {
  return `Here are my habit stats as JSON:\n\n${JSON.stringify(req, null, 2)}\n\nWrite my coaching report.`;
}
