// Pluggable fixed-window rate limiter.
//
// Serverless functions share no memory across instances, so durable rate
// limiting needs an external store. When UPSTASH_REDIS_REST_URL and
// UPSTASH_REDIS_REST_TOKEN are set, this uses Upstash Redis over its REST API
// (fixed window via INCR + PEXPIRE, called with the built-in fetch — no npm
// dependency added). Because the counter lives in Redis, the limit is shared
// across every serverless instance and is therefore durable.
//
// When those env vars are NOT set, it falls back to an in-memory,
// module-scoped Map counter. This fallback is BEST-EFFORT PER WARM INSTANCE:
// each running instance keeps its own Map, so limits are enforced per-instance
// and reset on cold start. Set the Upstash env vars to get durable,
// cross-instance limiting.

const memory = new Map(); // key -> { count, resetAt }

function memoryLimit(key, limit, windowMs) {
  const now = Date.now();
  // Prune expired entries so the Map can't grow without bound.
  for (const [k, v] of memory) {
    if (v.resetAt <= now) memory.delete(k);
  }
  let entry = memory.get(key);
  if (!entry || entry.resetAt <= now) {
    entry = { count: 0, resetAt: now + windowMs };
    memory.set(key, entry);
  }
  entry.count += 1;
  if (entry.count > limit) {
    return { ok: false, retryAfterMs: Math.max(0, entry.resetAt - now) };
  }
  return { ok: true, retryAfterMs: 0 };
}

async function upstashLimit(key, limit, windowMs) {
  const url = process.env.UPSTASH_REDIS_REST_URL.replace(/\/+$/, "");
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  const redisKey = `ratelimit:${key}`;

  // One pipelined round-trip:
  //   INCR   -> bump the window counter (returns 1 on the first hit)
  //   PEXPIRE ... NX -> set the window TTL only if the key has no TTL yet, so
  //                     the window is anchored to the first hit and does not
  //                     slide on subsequent hits (true fixed window)
  //   PTTL   -> remaining window in ms, used for Retry-After
  const res = await fetch(`${url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify([
      ["INCR", redisKey],
      ["PEXPIRE", redisKey, String(windowMs), "NX"],
      ["PTTL", redisKey],
    ]),
  });

  if (!res.ok) {
    // Fail open on backend errors: a limiter outage must not lock users out.
    return { ok: true, retryAfterMs: 0 };
  }

  const data = await res.json();
  // Upstash pipeline responds with an ordered array of { result } / { error }.
  const count = Number(data?.[0]?.result ?? 0);
  let ttl = Number(data?.[2]?.result ?? windowMs);
  if (!Number.isFinite(ttl) || ttl < 0) ttl = windowMs;

  if (count > limit) {
    return { ok: false, retryAfterMs: ttl };
  }
  return { ok: true, retryAfterMs: 0 };
}

/**
 * Fixed-window rate limit for `key`. Returns { ok, retryAfterMs }.
 * ok === false means the caller is over `limit` within the current `windowMs`.
 */
export async function rateLimit(key, { limit, windowMs }) {
  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    try {
      return await upstashLimit(key, limit, windowMs);
    } catch {
      // Fail open on unexpected errors (network, JSON, etc.).
      return { ok: true, retryAfterMs: 0 };
    }
  }
  return memoryLimit(key, limit, windowMs);
}

/**
 * Best-effort client IP: first hop of x-forwarded-for, falling back to the
 * socket address. Vercel sets x-forwarded-for on every request.
 */
export function clientIp(req) {
  const xff = req.headers?.["x-forwarded-for"];
  if (typeof xff === "string" && xff.length > 0) {
    return xff.split(",")[0].trim();
  }
  if (Array.isArray(xff) && xff.length > 0) {
    return String(xff[0]).split(",")[0].trim();
  }
  return req.socket?.remoteAddress || "unknown";
}
