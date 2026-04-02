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
export type { OrderbookStateEvents } from "./state/orderbook-state.js";
export { EventIndexer } from "./indexer/event-indexer.js";
export type { EventIndexerConfig } from "./indexer/event-indexer.js";
export { WsServer } from "./websocket/ws-server.js";
export type { WsServerOptions, ServerMessage, WsClient } from "./websocket/ws-server.js";
export { rateLimit, RateLimiter, createRateLimiter } from "./middleware/rate-limit.js";
export type { RateLimitOptions } from "./middleware/rate-limit.js";

/**
 * Start the API server with event indexer.
 */
/** Testnet contract address deployed by cash-testnet profile */
const TESTNET_CONTRACT_ADDRESS =
  "0xe66fef668077ab8dc5ea65539b6250d8ca3fc024ea4f16555fca9eaeb73b41d1";

/**
 * Resolve the contract address based on environment variables.
 * When APTOS_NETWORK=testnet and no explicit CONTRACT_ADDRESS is set,
 * defaults to the known testnet deployment.
 */
function resolveContractAddress(): string {
  if (process.env.CONTRACT_ADDRESS) return process.env.CONTRACT_ADDRESS;
  const network = process.env.APTOS_NETWORK ?? "mainnet";
  if (network === "testnet") return TESTNET_CONTRACT_ADDRESS;
  return "0xCAFE";
}

function main(): void {
  const port = parseInt(process.env.PORT ?? "3100", 10);
  const network = (process.env.APTOS_NETWORK as "mainnet" | "testnet" | "devnet" | "local") ?? "mainnet";
  const contractAddress = resolveContractAddress();

  // Create shared state
  const state = new OrderbookState();

  // Update market info for testnet CASH/USD1 market
  if (network === "testnet") {
    state.updateMarketInfo({
      pair: "CASH/USD1",
      quoteAsset: "USD1",
    });
  }

  // Create the Hono app (disable rate limiting in local development)
  const isDev = process.env.NODE_ENV !== "production";
  const { app } = createApp({
    state,
    rateLimitOptions: isDev ? { maxRequests: 10_000, windowMs: 10_000 } : undefined,
  });

  // Create and start the event indexer
  const indexer = new EventIndexer(
    {
      contractAddress,
      network,
      pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? "2000", 10),
    },
    state,
  );

  indexer.start();

  // Start HTTP server
  serve({ fetch: app.fetch, port }, async (info) => {
    console.log(`[API] CASH Orderbook REST API v${API_VERSION} listening on port ${info.port}`);
    console.log(`[API] Network: ${network}`);
    console.log(`[API] Contract address: ${contractAddress}`);
    console.log(`[API] Indexer polling every ${process.env.POLL_INTERVAL_MS ?? "2000"}ms`);

    // Auto-seed mock data in dev mode so charts/trades/stats are populated immediately
    if (isDev) {
      try {
        const res = await fetch(`http://localhost:${info.port}/dev/seed`, { method: "POST" });
        const data = await res.json() as { seeded: boolean; trades: number; candles: number };
        console.log(`[API] Dev seed complete — ${data.trades} trades, ${data.candles} candles injected`);
      } catch (err) {
        console.warn("[API] Dev seed failed (non-critical):", err);
      }
    }
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
