/**
 * Frontend configuration derived from environment variables.
 *
 * All external URLs are configurable via NEXT_PUBLIC_* env vars
 * so the frontend can connect to testnet or mainnet API/WS servers.
 */

/** REST API base URL (no trailing slash) */
export const API_BASE: string =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3100";

/** WebSocket server URL */
export const WS_URL: string =
  process.env.NEXT_PUBLIC_WS_URL ?? "ws://localhost:3101";

/** Aptos network */
export const APTOS_NETWORK: string =
  process.env.NEXT_PUBLIC_APTOS_NETWORK ?? "mainnet";

/** Contract address */
export const CONTRACT_ADDRESS: string =
  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "0xCAFE";
