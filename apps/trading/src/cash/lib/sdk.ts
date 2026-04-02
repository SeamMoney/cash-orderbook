/**
 * SDK initialization helper for the frontend.
 *
 * Creates a singleton CashOrderbook instance configured from environment variables.
 * Used by swap-widget, order-form, and other components that need to build
 * entry function payloads via the SDK.
 */

import {
  CashOrderbook,
  type CashOrderbookConfig,
  type PlaceOrderParams,
  MODULE_NAMES,
  ORDER_TYPE_MAP,
  CASH_TOKEN_ADDRESS,
  USDC_TOKEN_ADDRESS,
} from "@cash/orderbook-sdk";
import {
  CONTRACT_ADDRESS as ENV_CONTRACT_ADDRESS,
  APTOS_NETWORK,
} from "./config";

const CONTRACT_ADDRESS = ENV_CONTRACT_ADDRESS;

const NETWORK = APTOS_NETWORK as CashOrderbookConfig["network"];

/**
 * Build the entry function data for a placeOrder call.
 *
 * This does NOT submit the transaction — it returns the payload object
 * that can be passed to `signAndSubmitTransaction` from the wallet adapter.
 *
 * The SDK's `placeOrder()` expects an `Account` object (private key signer),
 * but the frontend uses the wallet adapter's `signAndSubmitTransaction`.
 * So we replicate the payload-building logic here.
 */
export function buildPlaceOrderPayload(params: PlaceOrderParams): {
  function: `${string}::${string}::${string}`;
  functionArguments: (number | boolean)[];
} {
  const { pairId, price, quantity, side, orderType } = params;
  const isBid = side === "buy";
  const onChainQuantity = Math.round(quantity * 1_000_000); // 6 decimals

  if (orderType === "Market") {
    return {
      function: `${CONTRACT_ADDRESS}::${MODULE_NAMES.ORDER_PLACEMENT}::place_market_order`,
      functionArguments: [pairId, onChainQuantity, isBid],
    };
  }

  const orderTypeNum = ORDER_TYPE_MAP[orderType];
  const onChainPrice = Math.round(price * 1_000_000); // PRICE_SCALE

  return {
    function: `${CONTRACT_ADDRESS}::${MODULE_NAMES.ORDER_PLACEMENT}::place_limit_order`,
    functionArguments: [pairId, onChainPrice, onChainQuantity, isBid, orderTypeNum],
  };
}

/** Re-export the contract address for components that need it */
export { CONTRACT_ADDRESS, MODULE_NAMES };
