/**
 * GET /candles — OHLCV candle data endpoint.
 *
 * Query params:
 *   - interval: "1m" | "5m" | "15m" | "1h" | "1d" (default "1m")
 *
 * Returns [{ open, high, low, close, volume, timestamp }]
 */

import { Hono } from "hono";
import { z } from "zod";
import type { OrderbookState } from "../state/orderbook-state.js";

const candlesQuerySchema = z.object({
  interval: z.enum(["1m", "5m", "15m", "1h", "1d"]).default("1m"),
});

export function candlesRoute(state: OrderbookState): Hono {
  const app = new Hono();

  app.get("/candles", (c) => {
    const parsed = candlesQuerySchema.safeParse({
      interval: c.req.query("interval") ?? "1m",
    });

    if (!parsed.success) {
      return c.json(
        {
          error: "INVALID_PARAMS",
          message: "interval must be one of: 1m, 5m, 15m, 1h, 1d",
        },
        400,
      );
    }

    const candles = state.getCandles(parsed.data.interval);
    return c.json(candles);
  });

  return app;
}
