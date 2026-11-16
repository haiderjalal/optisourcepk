interface Bucket {
  count: number;
  resetAt: number;
}

// ponytail: process-local map — one Vercel instance only. Swap for Upstash
// or Vercel KV if inquiry volume ever spreads across regions.
const buckets = new Map<string, Bucket>();

/** Stop the map growing without bound on a long-lived instance. */
function sweep(now: number): void {
  if (buckets.size < 512) return;
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  /** Seconds until the window resets. */
  retryAfter: number;
}

/**
 * Fixed-window limiter. Deliberately coarse — it exists to stop a script
 * hammering the inquiry endpoint, not to meter a paid API.
 */
export function rateLimit(
  key: string,
  { limit = 5, windowMs = 10 * 60 * 1000 } = {},
): RateLimitResult {
  const now = Date.now();
  sweep(now);

  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: limit - 1, retryAfter: 0 };
  }

  bucket.count += 1;
  const retryAfter = Math.ceil((bucket.resetAt - now) / 1000);

  return {
    allowed: bucket.count <= limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter,
  };
}

/**
 * Whether `key` has already used up its window, without counting this call.
 *
 * For limits that should only count failures: check here first, and call
 * `rateLimit` only when the attempt fails. The window length is set by that
 * `rateLimit` call, which is the one that opened the bucket.
 */
export function isRateLimited(
  key: string,
  { limit = 5 }: { limit?: number } = {},
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }

  return {
    allowed: bucket.count < limit,
    remaining: Math.max(0, limit - bucket.count),
    retryAfter: Math.ceil((bucket.resetAt - now) / 1000),
  };
}

/**
 * Best-effort client identity behind Vercel's proxy, read from any headers.
 *
 * `x-forwarded-for` is a chain. Its leftmost entry is whatever the client sent,
 * so keying on it lets a caller rotate a fake address per request and never hit
 * the limit. The rightmost entry is appended by the proxy nearest the platform,
 * so that is the one to trust.
 */
export function clientAddressFrom(headers: Pick<Headers, "get">): string {
  const forwarded = headers.get("x-forwarded-for") ?? "";
  const hops = forwarded
    .split(",")
    .map((hop) => hop.trim())
    .filter(Boolean);

  return hops.at(-1) || headers.get("x-real-ip")?.trim() || "unknown";
}

/** The client address for a route handler's request. See `clientAddressFrom`. */
export function clientKey(request: Request): string {
  return clientAddressFrom(request.headers);
}
