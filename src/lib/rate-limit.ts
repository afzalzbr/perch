// Lightweight in-memory token bucket used by sign-in and /go/[linkId].
// Per-process; good enough for a single-creator product. In a horizontal
// deployment, replace the Map with Redis.
type Bucket = { tokens: number; last: number };

const buckets = new Map<string, Bucket>();

export function hitRateLimit(
  key: string,
  { capacity, refillPerSecond }: { capacity: number; refillPerSecond: number }
): { ok: boolean; retryAfter: number } {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: capacity, last: now };
  const elapsed = (now - b.last) / 1000;
  b.tokens = Math.min(capacity, b.tokens + elapsed * refillPerSecond);
  b.last = now;
  if (b.tokens < 1) {
    buckets.set(key, b);
    return { ok: false, retryAfter: Math.ceil((1 - b.tokens) / refillPerSecond) };
  }
  b.tokens -= 1;
  buckets.set(key, b);
  return { ok: true, retryAfter: 0 };
}

export function resetRateLimit(): void {
  buckets.clear();
}
