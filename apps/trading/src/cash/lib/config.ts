/**
 * Frontend configuration derived from environment variables.
 *
 * All external URLs are configurable via VITE_* env vars
 * so the frontend can connect to testnet or mainnet API/WS servers.
 */

/** REST API base URL (no trailing slash) */
export const API_BASE: string =
  import.meta.env.VITE_API_URL ?? "http://localhost:3100";

/** WebSocket server URL */
export const WS_URL: string =
  import.meta.env.VITE_WS_URL ?? "ws://localhost:3101";

/** Aptos network */
export const APTOS_NETWORK: string =
  import.meta.env.VITE_APTOS_NETWORK ?? "mainnet";

/** Contract address */
export const CONTRACT_ADDRESS: string =
  import.meta.env.VITE_CONTRACT_ADDRESS ?? "0xCAFE";
