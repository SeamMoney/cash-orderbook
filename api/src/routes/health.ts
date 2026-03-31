/**
 * GET /health — Health check endpoint.
 *
 * Returns { status: "ok", uptime: <seconds>, lastIndexedVersion: <number> }
 */

import { Hono } from "hono";
import type { OrderbookState } from "../state/orderbook-state.js";

export function healthRoute(state: OrderbookState, startTime: number): Hono {
  const app = new Hono();

  app.get("/health", (c) => {
    const uptime = Math.floor((Date.now() - startTime) / 1000);
    return c.json({
      status: "ok",
      uptime,
      lastIndexedVersion: state.getLastIndexedVersion(),
    });
  });

  return app;
}
