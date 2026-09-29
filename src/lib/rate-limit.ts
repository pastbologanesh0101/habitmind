/**
 * Fixed-window, per-instance rate limiter. Good enough to stop a single visitor
 * from hammering the paid AI endpoint; not a distributed limiter.
 */
const WINDOW_MS = 60_000;
const LIMIT = 5;
const hits = new Map<string, { start: number; count: number }>();

export function rateLimit(key: string, now = Date.now(), limit = LIMIT): boolean {
  const entry = hits.get(key);
  if (!entry || now - entry.start >= WINDOW_MS) {
    hits.set(key, { start: now, count: 1 });
    if (hits.size > 10_000) hits.clear();
    return true;
  }
  entry.count++;
  return entry.count <= limit;
}
