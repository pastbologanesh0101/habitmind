import { addDays, type DayKey } from "@/lib/dates";
import type { Habit, HabitStats } from "@/lib/types";

interface Props {
  habits: Habit[];
  stats: HabitStats[];
  today: DayKey;
  onToggle: (id: string, day: DayKey) => void;
  onRemove: (id: string) => void;
}

export function TodayList({ habits, stats, today, onToggle, onRemove }: Props) {
  if (habits.length === 0) {
    return (
      <p className="mb-4 text-sm text-ink-2">
        No habits yet. Add one below, or load the demo data to see insights straight away.
      </p>
    );
  }

  const week = Array.from({ length: 7 }, (_, i) => addDays(today, i - 6));

  return (
    <ul className="mb-4 divide-y divide-line">
      {habits.map((h, i) => {
        const s = stats[i];
        const done = new Set(h.completions);
        return (
          <li key={h.id} className="group flex items-center gap-3 py-3">
            <button
              onClick={() => onToggle(h.id, today)}
              aria-pressed={s.doneToday}
              aria-label={`Mark ${h.name} ${s.doneToday ? "not done" : "done"} today`}
              className={`grid size-9 shrink-0 place-items-center rounded-full border-2 text-lg transition ${
                s.doneToday ? "border-accent bg-accent text-accent-ink" : "border-line hover:border-accent"
              }`}
            >
              {s.doneToday ? "✓" : h.emoji}
            </button>
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{h.name}</div>
              <div className="text-xs text-muted">
                {s.currentStreak > 0 ? `🔥 ${s.currentStreak}-day streak` : "No active streak"}
                {s.streakAtRisk && <span className="ml-2 text-warn">⚠ at risk today</span>}
              </div>
            </div>
            <div className="hidden gap-1 sm:flex" aria-label="Last 7 days">
              {week.map((d) => (
                <button
                  key={d}
                  onClick={() => onToggle(h.id, d)}
                  title={`${d}: ${done.has(d) ? "done" : "not done"} — click to toggle`}
                  className={`size-3.5 rounded-[4px] ${done.has(d) ? "bg-[var(--seq-3)]" : "bg-[var(--seq-0)]"}`}
                />
              ))}
            </div>
            <button
              onClick={() => onRemove(h.id)}
              aria-label={`Delete ${h.name}`}
              className="text-muted opacity-0 transition group-hover:opacity-100 focus:opacity-100 hover:text-ink"
            >
              ✕
            </button>
          </li>
        );
      })}
    </ul>
  );
}
