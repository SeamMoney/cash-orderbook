/**
 * GET /depth — Orderbook depth endpoint.
 *
 * Returns { bids: [{ price, quantity, total }], asks: [{ price, quantity, total }] }
 * Bids sorted descending by price, asks ascending.
 */

import { Hono } from "hono";
import type { OrderbookState } from "../state/orderbook-state.js";

export function depthRoute(state: OrderbookState): Hono {
  const app = new Hono();

  app.get("/depth", (c) => {
    const depth = state.getDepth();
    return c.json(depth);
  });

  return app;
}
