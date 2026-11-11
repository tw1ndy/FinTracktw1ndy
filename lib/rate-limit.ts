// Best-effort per-instance guard only. It is not a distributed limiter.
// Configure Supabase Auth rate limits and a shared Redis/Upstash limiter before launch.
const buckets = new Map<string, { count: number; resetAt: number }>();
export function allowRequest(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    if (buckets.size > 10_000) {
      buckets.forEach((bucket, bucketKey) => { if (bucket.resetAt <= now) buckets.delete(bucketKey); });
      if (buckets.size > 10_000) return false;
    }
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (current.count >= limit) return false;
  current.count += 1;
  return true;
}
