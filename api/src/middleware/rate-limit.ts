/**
 * Rate limiting middleware for the Hono REST API.
 *
 * Limits: 100 requests per 10 seconds per IP address.
 * Returns 429 Too Many Requests with Retry-After header when exceeded.
 */

import type { Context, Next, MiddlewareHandler } from "hono";

// ============================================================
// Types
// ============================================================

interface RateLimitEntry {
  /** Timestamps of requests within the current window */
  timestamps: number[];
}

export interface RateLimitOptions {
  /** Maximum number of requests in the time window (default: 100) */
  maxRequests?: number;
  /** Time window in milliseconds (default: 10000 = 10 seconds) */
  windowMs?: number;
}

// ============================================================
// RateLimiter class
// ============================================================

export class RateLimiter {
  private readonly maxRequests: number;
  private readonly windowMs: number;
  /** IP -> request timestamps */
  private readonly entries: Map<string, RateLimitEntry> = new Map();
  /** Cleanup interval timer */
  private cleanupTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: RateLimitOptions = {}) {
    this.maxRequests = options.maxRequests ?? 100;
    this.windowMs = options.windowMs ?? 10_000;

    // Periodically clean up stale entries every 60 seconds
    this.cleanupTimer = setInterval(() => {
      this.cleanup();
    }, 60_000);

    // Prevent the timer from keeping the process alive
    if (this.cleanupTimer && typeof this.cleanupTimer === "object" && "unref" in this.cleanupTimer) {
      this.cleanupTimer.unref();
    }
  }

  /**
   * Check whether a request from the given IP should be allowed.
   * Returns the number of remaining requests or -1 if rate limited.
   */
  check(ip: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let entry = this.entries.get(ip);
    if (!entry) {
      entry = { timestamps: [] };
      this.entries.set(ip, entry);
    }

    // Remove timestamps outside the current window
    entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

    if (entry.timestamps.length >= this.maxRequests) {
      // Rate limited — compute retry-after from oldest timestamp in window
      const oldestInWindow = entry.timestamps[0];
      const retryAfterMs = oldestInWindow + this.windowMs - now;
      return {
        allowed: false,
        remaining: 0,
        retryAfterMs: Math.max(1, Math.ceil(retryAfterMs)),
      };
    }

    // Allowed — record this request
    entry.timestamps.push(now);
    const remaining = this.maxRequests - entry.timestamps.length;

    return { allowed: true, remaining, retryAfterMs: 0 };
  }

  /**
   * Stop the cleanup timer.
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  /**
   * Remove stale entries (no requests in the last window period).
   */
  private cleanup(): void {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    for (const [ip, entry] of this.entries) {
      entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
      if (entry.timestamps.length === 0) {
        this.entries.delete(ip);
      }
    }
  }
}

// ============================================================
// Hono middleware factory
// ============================================================

/**
 * Extract client IP from request, considering common proxy headers.
 */
function getClientIp(c: Context): string {
  // Check X-Forwarded-For first (most proxies)
  const forwarded = c.req.header("x-forwarded-for");
  if (forwarded) {
    return forwarded.split(",")[0].trim();
  }

  // Check X-Real-IP (Nginx)
  const realIp = c.req.header("x-real-ip");
  if (realIp) {
    return realIp;
  }

  // Fallback to remote address or unknown
  return "unknown";
}

/**
 * Create a Hono rate limiting middleware.
 *
 * Usage:
 *   app.use('*', rateLimit({ maxRequests: 100, windowMs: 10_000 }))
 */
export function rateLimit(options: RateLimitOptions = {}): MiddlewareHandler {
  const limiter = new RateLimiter(options);

  return async (c: Context, next: Next): Promise<Response | void> => {
    const ip = getClientIp(c);
    const result = limiter.check(ip);

    // Set rate limit headers
    c.header("X-RateLimit-Limit", String(options.maxRequests ?? 100));
    c.header("X-RateLimit-Remaining", String(result.remaining));

    if (!result.allowed) {
      const retryAfterSeconds = Math.ceil(result.retryAfterMs / 1000);
      c.header("Retry-After", String(retryAfterSeconds));
      return c.json(
        {
          error: "RATE_LIMITED",
          message: "Too many requests. Please try again later.",
          retryAfter: retryAfterSeconds,
        },
        429,
      );
    }

    await next();
  };
}

/**
 * Create a rate limiter instance for testing purposes.
 */
export function createRateLimiter(options: RateLimitOptions = {}): RateLimiter {
  return new RateLimiter(options);
}
