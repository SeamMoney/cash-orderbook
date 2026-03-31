/**
 * WebSocket server entry point.
 *
 * Runs on port 3101 (separate from REST API on 3100).
 * Streams real-time orderbook deltas, trades, and account updates.
 */

import { WsServer } from "./websocket/ws-server.js";
import { OrderbookState } from "./state/orderbook-state.js";

function main(): void {
  const port = parseInt(process.env.WS_PORT ?? "3101", 10);

  // Create shared state (in production, this would be shared with the REST API process)
  const state = new OrderbookState();

  const wsServer = new WsServer({ port, state });
  wsServer.start();

  console.log(`[WS] CASH Orderbook WebSocket server running on port ${port}`);

  // Graceful shutdown
  const shutdown = (): void => {
    console.log("[WS] Shutting down...");
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
