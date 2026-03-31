/**
 * GET /market — Market info endpoint.
 *
 * Returns { pair, baseAsset, quoteAsset, lotSize, tickSize, lastPrice, volume24h }
 */

import { Hono } from "hono";
import type { OrderbookState } from "../state/orderbook-state.js";

export function marketRoute(state: OrderbookState): Hono {
  const app = new Hono();

  app.get("/market", (c) => {
    const info = state.getMarketInfo();
    return c.json(info);
  });

  return app;
}
