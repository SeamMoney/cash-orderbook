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
  const port = parseInt(process.env.WS_PORT ?? "3101", 10);
  const network = (process.env.APTOS_NETWORK as "mainnet" | "testnet" | "devnet" | "local") ?? "mainnet";
  const contractAddress = resolveContractAddress();

  // Shared state — the same instance is used by both the indexer and the WS server.
  // When the indexer updates state, the OrderbookState EventEmitter fires,
  // and the WS server broadcasts to subscribed clients.
  const state = new OrderbookState();

  // Update market info for testnet CASH/USD1 market
  if (network === "testnet") {
    state.updateMarketInfo({
      pair: "CASH/USD1",
      quoteAsset: "USD1",
    });
  }

  // Create and start the event indexer to populate state
  const indexer = new EventIndexer(
    {
      contractAddress,
      network,
      pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? "2000", 10),
    },
    state,
  );

  indexer.start();

  // WS server auto-wires to state events on start()
  const wsServer = new WsServer({ port, state });
  wsServer.start();

  console.log(`[WS] CASH Orderbook WebSocket server running on port ${port}`);
  console.log(`[WS] Network: ${network}`);
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
