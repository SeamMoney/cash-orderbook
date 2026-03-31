/**
 * Tests for rate limiting middleware.
 *
 * Tests:
 *   - RateLimiter class directly (unit tests)
 *   - Hono middleware integration (429 + Retry-After)
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RateLimiter, createRateLimiter } from "./rate-limit.js";
import { createApp } from "../server.js";
import type { Hono } from "hono";

// ============================================================
// RateLimiter class (unit tests)
// ============================================================

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  afterEach(() => {
    limiter?.destroy();
  });

  it("allows requests under the limit", () => {
    limiter = createRateLimiter({ maxRequests: 5, windowMs: 10_000 });

    for (let i = 0; i < 5; i++) {
      const result = limiter.check("1.2.3.4");
      expect(result.allowed).toBe(true);
    }
  });

  it("blocks requests over the limit", () => {
    limiter = createRateLimiter({ maxRequests: 3, windowMs: 10_000 });

    // Use up the limit
    for (let i = 0; i < 3; i++) {
      const result = limiter.check("1.2.3.4");
      expect(result.allowed).toBe(true);
    }

    // 4th request should be blocked
    const result = limiter.check("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks IPs independently", () => {
    limiter = createRateLimiter({ maxRequests: 2, windowMs: 10_000 });

    // IP1: 2 requests
    limiter.check("1.1.1.1");
    limiter.check("1.1.1.1");
    expect(limiter.check("1.1.1.1").allowed).toBe(false);

    // IP2: still has quota
    expect(limiter.check("2.2.2.2").allowed).toBe(true);
    expect(limiter.check("2.2.2.2").allowed).toBe(true);
    expect(limiter.check("2.2.2.2").allowed).toBe(false);
  });

  it("reports correct remaining count", () => {
    limiter = createRateLimiter({ maxRequests: 5, windowMs: 10_000 });

    expect(limiter.check("1.2.3.4").remaining).toBe(4);
    expect(limiter.check("1.2.3.4").remaining).toBe(3);
    expect(limiter.check("1.2.3.4").remaining).toBe(2);
    expect(limiter.check("1.2.3.4").remaining).toBe(1);
    expect(limiter.check("1.2.3.4").remaining).toBe(0);
  });

  it("returns positive retryAfterMs when rate limited", () => {
    limiter = createRateLimiter({ maxRequests: 1, windowMs: 5_000 });

    limiter.check("1.2.3.4");
    const result = limiter.check("1.2.3.4");
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(5_000);
  });

  it("uses default values (100 req / 10s)", () => {
    limiter = createRateLimiter();

    for (let i = 0; i < 100; i++) {
      const result = limiter.check("1.2.3.4");
      expect(result.allowed).toBe(true);
    }

    // 101st should be blocked
    expect(limiter.check("1.2.3.4").allowed).toBe(false);
  });
});

// ============================================================
// Hono middleware integration
// ============================================================

describe("Rate limit middleware (Hono integration)", () => {
  it("returns 429 with Retry-After header when rate limited", async () => {
    const { app } = createApp({
      rateLimitOptions: { maxRequests: 3, windowMs: 10_000 },
    });

    // First 3 requests should succeed
    for (let i = 0; i < 3; i++) {
      const res = await app.request("/health", {
        method: "GET",
        headers: { "x-forwarded-for": "10.0.0.1" },
      });
      expect(res.status).toBe(200);
    }

    // 4th request should be rate limited
    const res = await app.request("/health", {
      method: "GET",
      headers: { "x-forwarded-for": "10.0.0.1" },
    });
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body.error).toBe("RATE_LIMITED");
    expect(body.message).toBeTruthy();
    expect(body.retryAfter).toBeGreaterThan(0);

    // Check Retry-After header
    const retryAfter = res.headers.get("Retry-After");
    expect(retryAfter).toBeTruthy();
    expect(parseInt(retryAfter!, 10)).toBeGreaterThan(0);
  });

  it("includes X-RateLimit-Limit and X-RateLimit-Remaining headers", async () => {
    const { app } = createApp({
      rateLimitOptions: { maxRequests: 10, windowMs: 10_000 },
    });

    const res = await app.request("/health", {
      method: "GET",
      headers: { "x-forwarded-for": "10.0.0.2" },
    });
    expect(res.status).toBe(200);

    expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
    expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
  });

  it("429 response has consistent error format { error, message }", async () => {
    const { app } = createApp({
      rateLimitOptions: { maxRequests: 1, windowMs: 10_000 },
    });

    // Use up the limit
    await app.request("/health", {
      method: "GET",
      headers: { "x-forwarded-for": "10.0.0.3" },
    });

    // Rate limited
    const res = await app.request("/health", {
      method: "GET",
      headers: { "x-forwarded-for": "10.0.0.3" },
    });
    expect(res.status).toBe(429);

    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(body).toHaveProperty("message");
    expect(typeof body.error).toBe("string");
    expect(typeof body.message).toBe("string");
  });

  it("different IPs have independent rate limits", async () => {
    const { app } = createApp({
      rateLimitOptions: { maxRequests: 1, windowMs: 10_000 },
    });

    // IP1: use up limit
    const res1 = await app.request("/health", {
      method: "GET",
      headers: { "x-forwarded-for": "10.0.0.4" },
    });
    expect(res1.status).toBe(200);

    const res1b = await app.request("/health", {
      method: "GET",
      headers: { "x-forwarded-for": "10.0.0.4" },
    });
    expect(res1b.status).toBe(429);

    // IP2: should still be allowed
    const res2 = await app.request("/health", {
      method: "GET",
      headers: { "x-forwarded-for": "10.0.0.5" },
    });
    expect(res2.status).toBe(200);
  });

  it("rate limit with default options: 101st request gets 429", async () => {
    const { app } = createApp({
      rateLimitOptions: { maxRequests: 100, windowMs: 10_000 },
    });

    // First 100 requests pass
    for (let i = 0; i < 100; i++) {
      const res = await app.request("/health", {
        method: "GET",
        headers: { "x-forwarded-for": "10.0.0.6" },
      });
      expect(res.status).toBe(200);
    }

    // 101st request is rate limited
    const res = await app.request("/health", {
      method: "GET",
      headers: { "x-forwarded-for": "10.0.0.6" },
    });
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
  });

  it("rate limiting can be disabled", async () => {
    const { app } = createApp({ rateLimitOptions: false });

    // Make many requests — none should be rate limited
    for (let i = 0; i < 200; i++) {
      const res = await app.request("/health", {
        method: "GET",
        headers: { "x-forwarded-for": "10.0.0.7" },
      });
      expect(res.status).toBe(200);
    }
  });
});
