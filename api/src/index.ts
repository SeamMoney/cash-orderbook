/**
 * @cash/api — REST API + Event Indexer for the CASH/USDC orderbook.
 *
 * Hono for REST (port 3100).
 * EventIndexer polls Aptos RPC and maintains in-memory OrderbookState.
 */

import { serve } from "@hono/node-server";
import { createApp } from "./server.js";
import { EventIndexer } from "./indexer/event-indexer.js";
import { OrderbookState } from "./state/orderbook-state.js";

export const API_VERSION = "0.1.0";

// Re-export for consumers
export { createApp } from "./server.js";
export { OrderbookState } from "./state/orderbook-state.js";
export { EventIndexer } from "./indexer/event-indexer.js";
export type { EventIndexerConfig } from "./indexer/event-indexer.js";
export { WsServer } from "./websocket/ws-server.js";
export type { WsServerOptions, ServerMessage, WsClient } from "./websocket/ws-server.js";
export { rateLimit, RateLimiter, createRateLimiter } from "./middleware/rate-limit.js";
export type { RateLimitOptions } from "./middleware/rate-limit.js";

/**
 * Start the API server with event indexer.
 */
function main(): void {
  const port = parseInt(process.env.PORT ?? "3100", 10);
  const contractAddress = process.env.CONTRACT_ADDRESS ?? "0xCAFE";

  // Create shared state
  const state = new OrderbookState();

  // Create the Hono app
  const { app } = createApp({ state });

  // Create and start the event indexer
  const indexer = new EventIndexer(
    {
      contractAddress,
      network: (process.env.APTOS_NETWORK as "mainnet" | "testnet" | "devnet" | "local") ?? "mainnet",
      pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? "2000", 10),
    },
    state,
  );

  indexer.start();

  // Start HTTP server
  serve({ fetch: app.fetch, port }, (info) => {
    console.log(`[API] CASH Orderbook REST API v${API_VERSION} listening on port ${info.port}`);
    console.log(`[API] Contract address: ${contractAddress}`);
    console.log(`[API] Indexer polling every ${process.env.POLL_INTERVAL_MS ?? "2000"}ms`);
  });

  // Graceful shutdown
  const shutdown = (): void => {
    console.log("[API] Shutting down...");
    indexer.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Only run if this is the main module
const isMainModule = process.argv[1]?.endsWith("index.ts") || process.argv[1]?.endsWith("index.js");
if (isMainModule) {
  main();
}
