import { addDays, maxKey, weekday, WEEKDAYS, type DayKey } from "@/lib/dates";
import type { Habit } from "@/lib/types";

const WEEKS = 8;

function bucket(fraction: number): number {
  if (fraction <= 0) return 0;
  if (fraction < 0.34) return 1;
  if (fraction < 0.67) return 2;
  if (fraction < 1) return 3;
  return 4;
}

/** GitHub-style grid: columns are weeks, rows are weekdays, color is share of habits done. */
export function Heatmap({ habits, today }: { habits: Habit[]; today: DayKey }) {
  const sets = habits.map((h) => ({ created: h.createdAt, done: new Set(h.completions) }));
  const lastSunday = addDays(today, -weekday(today));
  const start = addDays(lastSunday, -(WEEKS - 1) * 7);

  const columns = Array.from({ length: WEEKS }, (_, w) =>
    Array.from({ length: 7 }, (_, d) => {
      const day = addDays(start, w * 7 + d);
      if (day > today) return { day, future: true, done: 0, total: 0 };
      const active = sets.filter((s) => maxKey(s.created, day) === day);
      return {
        day,
        future: false,
        done: active.filter((s) => s.done.has(day)).length,
        total: active.length,
      };
    }),
  );

  return (
    <div>
      <div className="flex gap-1">
        <div className="mr-1 grid grid-rows-7 gap-1 text-[10px] leading-none text-muted">
          {WEEKDAYS.map((w, i) => (
            <span key={w} className="flex h-4 items-center">
              {i % 2 === 1 ? w : ""}
            </span>
          ))}
        </div>
        {columns.map((col, i) => (
          <div key={i} className="grid flex-1 grid-rows-7 gap-1">
            {col.map((c) => {
              const label = c.future
                ? ""
                : c.total === 0
                  ? `${c.day}: no habits yet`
                  : `${c.day}: ${c.done}/${c.total} habits`;
              return (
                <div
                  key={c.day}
                  title={label}
                  aria-label={label || undefined}
                  className={`h-4 rounded-[4px] ${c.future ? "" : "hover:ring-2 hover:ring-ink"}`}
                  style={{
                    background: c.future
                      ? "transparent"
                      : `var(--seq-${c.total ? bucket(c.done / c.total) : 0})`,
                  }}
                />
              );
            })}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center justify-end gap-1 text-[10px] text-muted">
        None
        {[0, 1, 2, 3, 4].map((b) => (
          <span key={b} className="size-3 rounded-[3px]" style={{ background: `var(--seq-${b})` }} />
        ))}
        All
      </div>
    </div>
  );
}
