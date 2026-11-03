/**
 * Rate limiting in memoria per il login (un solo processo PM2 in modalità fork).
 * Blocca dopo MAX_ATTEMPTS fallimenti entro WINDOW_MS, per IP e per username.
 */
const WINDOW_MS = 15 * 60 * 1000;
const MAX_ATTEMPTS = Number(process.env.LOGIN_MAX_ATTEMPTS || 5);

type Entry = { count: number; first: number };
const store = new Map<string, Entry>();

function prune(now: number) {
  if (store.size < 5000) return;
  for (const [k, v] of store) if (now - v.first > WINDOW_MS) store.delete(k);
}

export function isRateLimited(keys: string[]): { limited: boolean; retryAfterSec: number } {
  const now = Date.now();
  for (const key of keys) {
    const e = store.get(key);
    if (e && now - e.first <= WINDOW_MS && e.count >= MAX_ATTEMPTS) {
      return { limited: true, retryAfterSec: Math.ceil((WINDOW_MS - (now - e.first)) / 1000) };
    }
  }
  return { limited: false, retryAfterSec: 0 };
}

export function registerFailure(keys: string[]) {
  const now = Date.now();
  prune(now);
  for (const key of keys) {
    const e = store.get(key);
    if (!e || now - e.first > WINDOW_MS) store.set(key, { count: 1, first: now });
    else e.count++;
  }
}

export function clearFailures(keys: string[]) {
  for (const key of keys) store.delete(key);
}
