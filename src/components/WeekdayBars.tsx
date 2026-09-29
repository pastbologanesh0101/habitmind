import { WEEKDAYS, WEEKDAY_NAMES } from "@/lib/dates";
import type { Analysis } from "@/lib/types";

export function WeekdayBars({ analysis }: { analysis: Analysis }) {
  const totals = WEEKDAYS.map((_, i) => {
    let done = 0;
    let total = 0;
    for (const h of analysis.habits) {
      done += h.weekdays[i].done;
      total += h.weekdays[i].total;
    }
    return { i, done, total, rate: total ? done / total : 0 };
  });

  if (totals.every((t) => t.total === 0)) {
    return <p className="text-sm text-muted">Check in for a few days to see your weekly rhythm.</p>;
  }

  const withData = totals.filter((t) => t.total > 0);
  const best = withData.reduce((a, b) => (b.rate > a.rate ? b : a));
  const worst = withData.reduce((a, b) => (b.rate < a.rate ? b : a));

  return (
    <div>
      <div className="relative flex h-36 items-end gap-2 border-b border-[var(--grid)]">
        {totals.map((t) => {
          const labelled = t === best || t === worst;
          const tip = `${WEEKDAY_NAMES[t.i]}: ${Math.round(t.rate * 100)}% (${t.done}/${t.total} check-ins)`;
          return (
            <div key={t.i} className="group relative flex h-full flex-1 flex-col justify-end" title={tip}>
              {labelled && (
                <span className="mb-1 text-center text-[11px] tabular-nums text-ink-2">
                  {Math.round(t.rate * 100)}%
                </span>
              )}
              <div
                className="w-full rounded-t-[4px] bg-accent transition-opacity group-hover:opacity-80"
                style={{ height: `${Math.max(t.rate * 100, t.total ? 2 : 0)}%` }}
              />
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex gap-2">
        {totals.map((t) => (
          <span key={t.i} className="flex-1 text-center text-[11px] text-muted">
            {WEEKDAYS[t.i]}
          </span>
        ))}
      </div>
      <details className="mt-3 text-xs text-ink-2">
        <summary className="cursor-pointer text-muted">Show as table</summary>
        <table className="mt-2 w-full tabular-nums">
          <tbody>
            {totals.map((t) => (
              <tr key={t.i} className="border-t border-line">
                <td className="py-1">{WEEKDAY_NAMES[t.i]}</td>
                <td className="text-right">
                  {t.done}/{t.total}
                </td>
                <td className="text-right">{Math.round(t.rate * 100)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
