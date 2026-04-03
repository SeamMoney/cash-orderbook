/**
 * Frontend configuration derived from environment variables.
 *
 * All external URLs are configurable via VITE_* env vars
 * so the frontend can connect to testnet or mainnet API/WS servers.
 */

/**
 * REST API base URL (no trailing slash).
 *
 * In development, the Vite proxy maps /cash-api → http://localhost:3100
 * so we use the proxy path by default to avoid CORS issues.
 * The VITE_* env vars are not loaded because the Uniswap fork sets envPrefix: [].
 */
export const API_BASE: string = "/cash-api";

/**
 * WebSocket server URL.
 *
 * In development, the Vite proxy maps /cash-ws → ws://localhost:3101.
 * WebSocket connections from the browser use the proxy-aware URL.
 */
function getWsUrl(): string {
  if (typeof window !== "undefined") {
    const loc = window.location;
    const protocol = loc.protocol === "https:" ? "wss:" : "ws:";
    return `${protocol}//${loc.host}/cash-ws`;
  }
  return "ws://localhost:3101";
}

export const WS_URL: string = getWsUrl();

/** Aptos network */
export const APTOS_NETWORK: string =
  import.meta.env.VITE_APTOS_NETWORK ?? "mainnet";

/** Contract address */
export const CONTRACT_ADDRESS: string =
  import.meta.env.VITE_CONTRACT_ADDRESS ?? "0xCAFE";
