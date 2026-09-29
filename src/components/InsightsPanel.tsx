"use client";

import { useEffect, useState } from "react";
import { toCoachRequest, type CoachReport } from "@/lib/coach";
import type { Analysis, Insight, InsightKind } from "@/lib/types";
import { Card } from "./Card";

const ICONS: Record<InsightKind, string> = {
  "streak-risk": "⏰",
  "weekday-dip": "📉",
  declining: "↘️",
  improving: "↗️",
  "habit-link": "🔗",
  struggling: "🪶",
  strong: "🏆",
  "getting-started": "🌱",
};

const VISIBLE_INSIGHTS = 5;

type CoachState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; report: CoachReport; model: string }
  | { status: "error"; message: string };

export function InsightsPanel({ analysis, insights }: { analysis: Analysis; insights: Insight[] }) {
  const [aiEnabled, setAiEnabled] = useState<boolean | null>(null);
  const [coach, setCoach] = useState<CoachState>({ status: "idle" });
  const [showAll, setShowAll] = useState(false);
  const visible = showAll ? insights : insights.slice(0, VISIBLE_INSIGHTS);

  useEffect(() => {
    fetch("/api/insights")
      .then((r) => r.json())
      .then((d) => setAiEnabled(Boolean(d.enabled)))
      .catch(() => setAiEnabled(false));
  }, []);

  const canCoach = analysis.habits.some((h) => h.trackedDays >= 7);

  async function askCoach() {
    setCoach({ status: "loading" });
    try {
      const res = await fetch("/api/insights", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(toCoachRequest(analysis)),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Something went wrong.");
      setCoach({ status: "done", report: data.report, model: data.model });
    } catch (e) {
      setCoach({ status: "error", message: e instanceof Error ? e.message : "Something went wrong." });
    }
  }

  return (
    <div className="space-y-6">
      <Card
        title="AI coach"
        subtitle="A personalised weekly plan, written by Claude from your stats"
        aside={
          aiEnabled && (
            <button
              onClick={askCoach}
              disabled={!canCoach || coach.status === "loading"}
              className="shrink-0 rounded-lg bg-accent px-3 py-1.5 text-sm font-medium text-accent-ink disabled:opacity-50"
            >
              {coach.status === "loading" ? "Thinking…" : coach.status === "done" ? "Refresh" : "Get coaching"}
            </button>
          )
        }
      >
        {aiEnabled === false && (
          <p className="text-sm text-ink-2">
            The AI coach isn&apos;t configured on this deployment (no <code>ANTHROPIC_API_KEY</code>). The
            on-device insights below still work: they&apos;re computed from the same stats. See the README to
            enable it.
          </p>
        )}
        {aiEnabled && !canCoach && (
          <p className="text-sm text-ink-2">Track at least one habit for a week, or load the demo data, to unlock coaching.</p>
        )}
        {aiEnabled && canCoach && coach.status === "idle" && (
          <p className="text-sm text-ink-2">
            Sends only aggregated numbers (rates, streaks, weekday patterns), never your day-by-day log.
          </p>
        )}
        {coach.status === "loading" && <Skeleton />}
        {coach.status === "error" && <p className="text-sm text-warn">⚠ {coach.message}</p>}
        {coach.status === "done" && <Report report={coach.report} model={coach.model} />}
      </Card>

      <Card title="Pattern insights" subtitle="Computed on your device from the last 8 weeks">
        <ul className="space-y-3">
          {visible.map((i, idx) => (
            <li key={idx} className="rounded-xl border border-line p-4">
              <div className="flex gap-3">
                <span className="text-xl" aria-hidden>
                  {ICONS[i.kind]}
                </span>
                <div>
                  <div className="font-medium">{i.title}</div>
                  <p className="mt-0.5 text-sm text-ink-2">{i.detail}</p>
                  <p className="mt-2 text-sm">
                    <span className="font-medium text-accent">Try:</span> {i.action}
                  </p>
                </div>
              </div>
            </li>
          ))}
          {insights.length === 0 && (
            <li className="text-sm text-ink-2">No strong patterns right now. Steady is good.</li>
          )}
        </ul>
        {insights.length > VISIBLE_INSIGHTS && (
          <button onClick={() => setShowAll(!showAll)} className="mt-3 text-sm text-accent hover:underline">
            {showAll ? "Show fewer" : `Show ${insights.length - VISIBLE_INSIGHTS} more`}
          </button>
        )}
        {analysis.links.length > 0 && (
          <p className="mt-3 text-[11px] text-muted">
            🔗 links are correlations between habits, not proof that one causes the other.
          </p>
        )}
      </Card>
    </div>
  );
}

function Report({ report, model }: { report: CoachReport; model: string }) {
  return (
    <div className="space-y-4 text-sm">
      <p className="text-base font-medium">{report.headline}</p>
      <div className="rounded-xl bg-page p-3">
        <div className="text-xs uppercase tracking-wide text-muted">Focus this week</div>
        <div className="mt-1 font-medium">{report.focus.habit}</div>
        <p className="text-ink-2">{report.focus.reason}</p>
      </div>
      <ol className="space-y-3">
        {report.suggestions.map((s, i) => (
          <li key={i} className="border-l-2 border-accent pl-3">
            <div className="font-medium">{s.habit}</div>
            <p className="text-ink-2">{s.observation}</p>
            <p className="mt-1">
              <span className="font-medium text-accent">Do:</span> {s.action}
            </p>
          </li>
        ))}
      </ol>
      <div className="rounded-xl border border-dashed border-line p-3">
        <div className="text-xs uppercase tracking-wide text-muted">🧪 7-day experiment</div>
        <div className="mt-1 font-medium">{report.experiment.title}</div>
        <p className="text-ink-2">{report.experiment.description}</p>
      </div>
      <p className="italic text-ink-2">{report.encouragement}</p>
      <p className="text-[11px] text-muted">Generated by {model}. AI can be wrong; check it against your numbers.</p>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-label="Loading coaching">
      <div className="h-4 w-3/4 rounded bg-grid" />
      <div className="h-16 rounded-xl bg-grid" />
      <div className="h-4 w-full rounded bg-grid" />
      <div className="h-4 w-5/6 rounded bg-grid" />
    </div>
  );
}
