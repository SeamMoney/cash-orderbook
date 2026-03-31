/**
 * Hono REST API server for the CASH/USDC orderbook.
 *
 * Mounts all route handlers and configures middleware.
 * Port 3100 (configured via PORT env var).
 */

import { Hono } from "hono";
import { cors } from "hono/cors";
import { OrderbookState } from "./state/orderbook-state.js";
import { healthRoute } from "./routes/health.js";
import { depthRoute } from "./routes/depth.js";
import { tradesRoute } from "./routes/trades.js";
import { ordersRoute } from "./routes/orders.js";
import { candlesRoute } from "./routes/candles.js";
import { marketRoute } from "./routes/market.js";
import { balancesRoute } from "./routes/balances.js";

export interface CreateAppOptions {
  /** Shared in-memory state (injected for testability) */
  state?: OrderbookState;
  /** Server start time for uptime calculation */
  startTime?: number;
}

/**
 * Create a configured Hono app with all routes mounted.
 */
export function createApp(options: CreateAppOptions = {}): {
  app: Hono;
  state: OrderbookState;
} {
  const state = options.state ?? new OrderbookState();
  const startTime = options.startTime ?? Date.now();

  const app = new Hono();

  // Middleware
  app.use("*", cors());

  // Mount routes
  app.route("/", healthRoute(state, startTime));
  app.route("/", depthRoute(state));
  app.route("/", tradesRoute(state));
  app.route("/", ordersRoute(state));
  app.route("/", candlesRoute(state));
  app.route("/", marketRoute(state));
  app.route("/", balancesRoute(state));

  // 404 handler for unknown routes
  app.notFound((c) => {
    return c.json(
      {
        error: "NOT_FOUND",
        message: `Route ${c.req.method} ${c.req.path} not found`,
      },
      404,
    );
  });

  // Global error handler
  app.onError((err, c) => {
    console.error("[API Error]", err);
    return c.json(
      {
        error: "INTERNAL_ERROR",
        message: "An unexpected error occurred",
      },
      500,
    );
  });

  return { app, state };
}
