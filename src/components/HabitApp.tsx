"use client";

import { useEffect, useMemo, useState } from "react";
import { analyze } from "@/lib/analytics";
import { toDayKey, type DayKey } from "@/lib/dates";
import { demoHabits } from "@/lib/demo";
import { ruleInsights } from "@/lib/rules";
import { loadHabits, saveHabits, toggleCompletion } from "@/lib/storage";
import type { Habit } from "@/lib/types";
import { AddHabit } from "./AddHabit";
import { Card } from "./Card";
import { Heatmap } from "./Heatmap";
import { InsightsPanel } from "./InsightsPanel";
import { TodayList } from "./TodayList";
import { WeekdayBars } from "./WeekdayBars";

export function HabitApp() {
  const [habits, setHabits] = useState<Habit[] | null>(null);
  const [today, setToday] = useState<DayKey | null>(null);

  // localStorage and the viewer's timezone only exist in the browser.
  useEffect(() => {
    const now = toDayKey(new Date());
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setToday(now);
    setHabits(loadHabits() ?? []);
  }, []);

  useEffect(() => {
    if (habits) saveHabits(habits);
  }, [habits]);

  const analysis = useMemo(
    () => (habits && today ? analyze(habits, today) : null),
    [habits, today],
  );
  const insights = useMemo(() => (analysis ? ruleInsights(analysis) : []), [analysis]);

  if (!habits || !today || !analysis) {
    return <div className="mx-auto w-full max-w-5xl p-6 text-muted">Loading…</div>;
  }

  const addHabit = (name: string, emoji: string) =>
    setHabits([...habits, { id: crypto.randomUUID(), name, emoji, createdAt: today, completions: [] }]);
  const toggle = (id: string, day: DayKey) =>
    setHabits(habits.map((h) => (h.id === id ? toggleCompletion(h, day) : h)));
  const remove = (id: string) => setHabits(habits.filter((h) => h.id !== id));
  const loadDemo = () => setHabits(demoHabits(today));
  const reset = () => setHabits([]);

  const doneToday = analysis.habits.filter((h) => h.doneToday).length;

  return (
    <main className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6">
      <header className="mb-8 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">HabitMind</h1>
          <p className="mt-1 text-ink-2">Track your habits. Let the patterns tell you what to change.</p>
        </div>
        <div className="flex gap-2 text-sm">
          <button
            onClick={loadDemo}
            className="rounded-lg border border-line bg-surface px-3 py-1.5 hover:bg-grid"
          >
            Load demo data
          </button>
          {habits.length > 0 && (
            <button
              onClick={() => confirmReset(reset)}
              className="rounded-lg border border-line bg-surface px-3 py-1.5 text-ink-2 hover:bg-grid"
            >
              Clear all
            </button>
          )}
        </div>
      </header>

      <section className="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Consistency (8 wks)" value={`${analysis.consistencyScore}%`} />
        <Stat label="Done today" value={`${doneToday}/${habits.length}`} />
        <Stat
          label="Best current streak"
          value={`${Math.max(0, ...analysis.habits.map((h) => h.currentStreak))}d`}
        />
        <Stat label="Habits tracked" value={String(habits.length)} />
      </section>

      <div className="grid gap-6 lg:grid-cols-[1fr_1.1fr]">
        <div className="space-y-6">
          <Card title="Today">
            <TodayList stats={analysis.habits} habits={habits} today={today} onToggle={toggle} onRemove={remove} />
            <AddHabit onAdd={addHabit} />
          </Card>
          <Card title="Last 8 weeks" subtitle="Share of habits completed each day">
            <Heatmap habits={habits} today={today} />
          </Card>
          <Card title="By weekday" subtitle="Completion rate across all habits">
            <WeekdayBars analysis={analysis} />
          </Card>
        </div>
        <InsightsPanel analysis={analysis} insights={insights} />
      </div>

      <footer className="mt-10 text-center text-xs text-muted">
        Your habit log stays in this browser. The AI coach only receives aggregated stats.
      </footer>
    </main>
  );
}

function confirmReset(reset: () => void) {
  if (window.confirm("Delete all habits and history from this browser?")) reset();
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-line bg-surface p-4">
      <div className="text-xs text-muted">{label}</div>
      <div className="mt-1 text-2xl font-semibold tabular-nums">{value}</div>
    </div>
  );
}
