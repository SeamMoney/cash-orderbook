/**
 * WebSocket server entry point.
 *
 * Runs on port 3101 (separate from REST API on 3100).
 * Streams real-time orderbook deltas, trades, and account updates.
 *
 * The WS server is wired to OrderbookState's EventEmitter:
 * when the indexer processes events and mutates state, the WS server
 * automatically broadcasts to subscribed clients.
 */

import { WsServer } from "./websocket/ws-server.js";
import { OrderbookState } from "./state/orderbook-state.js";
import { EventIndexer } from "./indexer/event-indexer.js";

function main(): void {
  const port = parseInt(process.env.WS_PORT ?? "3101", 10);
  const contractAddress = process.env.CONTRACT_ADDRESS ?? "0xCAFE";

  // Shared state — the same instance is used by both the indexer and the WS server.
  // When the indexer updates state, the OrderbookState EventEmitter fires,
  // and the WS server broadcasts to subscribed clients.
  const state = new OrderbookState();

  // Create and start the event indexer to populate state
  const indexer = new EventIndexer(
    {
      contractAddress,
      network: (process.env.APTOS_NETWORK as "mainnet" | "testnet" | "devnet" | "local") ?? "mainnet",
      pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? "2000", 10),
    },
    state,
  );

  indexer.start();

  // WS server auto-wires to state events on start()
  const wsServer = new WsServer({ port, state });
  wsServer.start();

  console.log(`[WS] CASH Orderbook WebSocket server running on port ${port}`);
  console.log(`[WS] Indexer polling contract ${contractAddress}`);

  // Graceful shutdown
  const shutdown = (): void => {
    console.log("[WS] Shutting down...");
    indexer.stop();
    wsServer.stop();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

// Only run if this is the main module
const isMainModule = process.argv[1]?.endsWith("ws.ts") || process.argv[1]?.endsWith("ws.js");
if (isMainModule) {
  main();
}
