/**
 * GET /trades — Recent trades endpoint.
 *
 * Query params:
 *   - limit: number (default 50, max 1000)
 *
 * Returns [{ id, price, quantity, side, timestamp }]
 * Sorted by most recent first.
 */

import { Hono } from "hono";
import { z } from "zod";
import type { OrderbookState } from "../state/orderbook-state.js";

const tradesQuerySchema = z.object({
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 50))
    .pipe(z.number().int().min(1).max(1000)),
});

export function tradesRoute(state: OrderbookState): Hono {
  const app = new Hono();

  app.get("/trades", (c) => {
    const parsed = tradesQuerySchema.safeParse({
      limit: c.req.query("limit"),
    });

    if (!parsed.success) {
      return c.json(
        {
          error: "INVALID_PARAMS",
          message: parsed.error.issues.map((i) => i.message).join(", "),
        },
        400,
      );
    }

    const trades = state.getTrades(parsed.data.limit);

    // Map to the expected response format
    const response = trades.map((t) => ({
      id: t.tradeId,
      price: t.price,
      quantity: t.quantity,
      side: t.side,
      timestamp: t.timestamp,
    }));

    return c.json(response);
  });

  return app;
}
