/**
 * CashOrderbook — Main SDK client for interacting with the CASH/USDC orderbook.
 *
 * Wraps @aptos-labs/ts-sdk to provide typed methods for:
 *   - Order placement and cancellation (write operations)
 *   - Deposit and withdraw (write operations)
 *   - Orderbook, balance, and order queries (view functions)
 */

import {
  Aptos,
  AptosConfig,
  Network,
  type Account,
  type InputViewFunctionData,
  type InputEntryFunctionData,
  type MoveValue,
  type UserTransactionResponse,
} from "@aptos-labs/ts-sdk";

import {
  PRICE_SCALE,
  CASH_DECIMALS,
  USDC_DECIMALS,
} from "@cash/shared";

import type {
  Order,
  OrderType,
  OrderStatus,
  UserBalances,
  OrderbookDepth,
  DepthLevel,
} from "@cash/shared";

import {
  type CashOrderbookConfig,
  type PlaceOrderParams,
  type CancelOrderParams,
  type TransactionResult,
  type NetworkType,
  ORDER_TYPE_MAP,
  MODULE_NAMES,
} from "./types.js";

/**
 * Map SDK network type to Aptos SDK Network enum.
 */
function toAptosNetwork(network: NetworkType): Network {
  switch (network) {
    case "mainnet":
      return Network.MAINNET;
    case "testnet":
      return Network.TESTNET;
    case "devnet":
      return Network.DEVNET;
    case "local":
      return Network.LOCAL;
    default:
      return Network.MAINNET;
  }
}

/**
 * Convert a human-readable amount to on-chain integer units.
 * Both CASH and USDC have 6 decimals.
 */
function toOnChainAmount(amount: number, decimals: number): number {
  return Math.round(amount * 10 ** decimals);
}

/**
 * Convert a human-readable price to on-chain PRICE_SCALE units.
 * Price is expressed in USDC per CASH with 6 decimal precision.
 */
function toOnChainPrice(price: number): number {
  return Math.round(price * PRICE_SCALE);
}

/**
 * Parse an on-chain Order struct from Move view function return values.
 */
function parseOrder(raw: Record<string, MoveValue>, pairIdHint?: number): Order {
  const isBid = raw["is_bid"] as boolean;
  const orderTypeNum = Number(raw["order_type"]);
  const orderTypeMap: Record<number, OrderType> = {
    0: "GTC",
    1: "IOC",
    2: "FOK",
    3: "PostOnly",
  };

  const originalQty = Number(raw["original_quantity"]);
  const remainingQty = Number(raw["remaining_quantity"]);

  let status: OrderStatus = "open";
  if (remainingQty === 0) {
    status = "filled";
  } else if (remainingQty < originalQty) {
    status = "partially_filled";
  }

  return {
    orderId: String(raw["order_id"]),
    pairId: pairIdHint ?? Number(raw["pair_id"]),
    owner: String(raw["owner"]),
    side: isBid ? "buy" : "sell",
    type: orderTypeMap[orderTypeNum] ?? "GTC",
    price: Number(raw["price"]) / PRICE_SCALE,
    quantity: originalQty / 10 ** CASH_DECIMALS,
    remaining: remainingQty / 10 ** CASH_DECIMALS,
    status,
    timestamp: Number(raw["timestamp"]),
  };
}

/**
 * CashOrderbook — the main client class for the CASH/USDC orderbook SDK.
 *
 * @example
 * ```ts
 * const client = new CashOrderbook({
 *   network: "mainnet",
 *   contractAddress: "0x...",
 * });
 *
 * // Read orderbook
 * const book = await client.getOrderbook(0);
 *
 * // Place order (requires Account)
 * const result = await client.placeOrder(account, {
 *   pairId: 0,
 *   price: 1.5,
 *   quantity: 100,
 *   side: "buy",
 *   orderType: "GTC",
 * });
 * ```
 */
export class CashOrderbook {
  /** The underlying Aptos client */
  public readonly aptos: Aptos;
  /** The contract address where cash_orderbook is deployed */
  public readonly contractAddress: string;
  /** The network being used */
  public readonly network: NetworkType;
  /** Base asset (CASH) metadata address */
  public readonly baseAsset: string;
  /** Quote asset (USDC) metadata address */
  public readonly quoteAsset: string;

  constructor(config: CashOrderbookConfig) {
    this.contractAddress = config.contractAddress;
    this.network = config.network;
    this.baseAsset = config.baseAsset;
    this.quoteAsset = config.quoteAsset;

    const aptosConfig = new AptosConfig({
      network: toAptosNetwork(config.network),
      ...(config.fullnodeUrl ? { fullnode: config.fullnodeUrl } : {}),
      ...(config.apiKey
        ? {
            clientConfig: {
              API_KEY: config.apiKey,
            },
          }
        : {}),
    });

    this.aptos = new Aptos(aptosConfig);
  }

  // ============================================================
  // Write Operations (require Account)
  // ============================================================

  /**
   * Place an order on the orderbook.
   *
   * For Market orders, only quantity and side are required (price is ignored).
   * For limit orders (GTC, IOC, FOK, PostOnly), price is required.
   *
   * Fulfills VAL-BACKEND-001: SDK placeOrder builds and submits transaction, returns tx hash.
   */
  async placeOrder(
    account: Account,
    params: PlaceOrderParams,
  ): Promise<TransactionResult> {
    const { pairId, price, quantity, side, orderType } = params;
    const isBid = side === "buy";
    const onChainQuantity = toOnChainAmount(quantity, CASH_DECIMALS);

    let data: InputEntryFunctionData;

    if (orderType === "Market") {
      data = {
        function: `${this.contractAddress}::${MODULE_NAMES.ORDER_PLACEMENT}::place_market_order`,
        functionArguments: [pairId, onChainQuantity, isBid],
      };
    } else {
      const orderTypeNum = ORDER_TYPE_MAP[orderType];
      const onChainPrice = toOnChainPrice(price);

      data = {
        function: `${this.contractAddress}::${MODULE_NAMES.ORDER_PLACEMENT}::place_limit_order`,
        functionArguments: [pairId, onChainPrice, onChainQuantity, isBid, orderTypeNum],
      };
    }

    const txn = await this.aptos.transaction.build.simple({
      sender: account.accountAddress,
      data,
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: account,
      transaction: txn,
    });

    const committed = await this.aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
    });

    return { txHash: (committed as UserTransactionResponse).hash };
  }

  /**
   * Cancel an existing order on the orderbook.
   *
   * Fulfills VAL-BACKEND-002: SDK cancelOrder submits cancellation, returns tx hash.
   */
  async cancelOrder(
    account: Account,
    params: CancelOrderParams,
  ): Promise<TransactionResult> {
    const { pairId, orderId } = params;

    const data: InputEntryFunctionData = {
      function: `${this.contractAddress}::${MODULE_NAMES.CANCEL}::cancel_order`,
      functionArguments: [pairId, Number(orderId)],
    };

    const txn = await this.aptos.transaction.build.simple({
      sender: account.accountAddress,
      data,
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: account,
      transaction: txn,
    });

    const committed = await this.aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
    });

    return { txHash: (committed as UserTransactionResponse).hash };
  }

  /**
   * Deposit a FungibleAsset into the trading account.
   *
   * @param account - Signer account
   * @param asset - The asset metadata address (Object<Metadata>)
   * @param amount - Amount in human-readable units (e.g., 100 for 100 USDC)
   * @param decimals - Asset decimals (default: 6)
   *
   * Fulfills VAL-BACKEND-003: SDK deposit submits correct transaction.
   */
  async deposit(
    account: Account,
    asset: string,
    amount: number,
    decimals: number = USDC_DECIMALS,
  ): Promise<TransactionResult> {
    const onChainAmount = toOnChainAmount(amount, decimals);

    const data: InputEntryFunctionData = {
      function: `${this.contractAddress}::${MODULE_NAMES.ACCOUNTS}::deposit`,
      functionArguments: [asset, onChainAmount],
    };

    const txn = await this.aptos.transaction.build.simple({
      sender: account.accountAddress,
      data,
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: account,
      transaction: txn,
    });

    const committed = await this.aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
    });

    return { txHash: (committed as UserTransactionResponse).hash };
  }

  /**
   * Withdraw a FungibleAsset from the trading account.
   *
   * @param account - Signer account
   * @param asset - The asset metadata address (Object<Metadata>)
   * @param amount - Amount in human-readable units
   * @param decimals - Asset decimals (default: 6)
   *
   * Fulfills VAL-BACKEND-003: SDK withdraw submits correct transaction.
   */
  async withdraw(
    account: Account,
    asset: string,
    amount: number,
    decimals: number = USDC_DECIMALS,
  ): Promise<TransactionResult> {
    const onChainAmount = toOnChainAmount(amount, decimals);

    const data: InputEntryFunctionData = {
      function: `${this.contractAddress}::${MODULE_NAMES.ACCOUNTS}::withdraw`,
      functionArguments: [asset, onChainAmount],
    };

    const txn = await this.aptos.transaction.build.simple({
      sender: account.accountAddress,
      data,
    });

    const pendingTxn = await this.aptos.signAndSubmitTransaction({
      signer: account,
      transaction: txn,
    });

    const committed = await this.aptos.waitForTransaction({
      transactionHash: pendingTxn.hash,
    });

    return { txHash: (committed as UserTransactionResponse).hash };
  }

  // ============================================================
  // View Operations (read-only, no Account needed)
  // ============================================================

  /**
   * Get the current orderbook depth for a trading pair.
   *
   * Calls the on-chain view function `views::get_orderbook(pair_id)`.
   * Returns typed bids (descending by price) and asks (ascending by price).
   *
   * Fulfills VAL-BACKEND-004: SDK getOrderbook calls view function, returns typed response.
   */
  async getOrderbook(pairId: number): Promise<OrderbookDepth> {
    const payload: InputViewFunctionData = {
      function: `${this.contractAddress}::${MODULE_NAMES.VIEWS}::get_orderbook`,
      functionArguments: [pairId],
    };

    const result = await this.aptos.view({ payload });

    // Result is [vector<Order>, vector<Order>] → [bids, asks]
    const rawBids = result[0] as Array<Record<string, MoveValue>>;
    const rawAsks = result[1] as Array<Record<string, MoveValue>>;

    const bids: DepthLevel[] = aggregateDepthLevels(rawBids, "desc");
    const asks: DepthLevel[] = aggregateDepthLevels(rawAsks, "asc");

    return { bids, asks };
  }

  /**
   * Get a user's available and locked balances for CASH and USDC.
   *
   * Calls the on-chain view function `views::get_user_balances(user, base, quote)`.
   * Resolves base and quote asset addresses from the client config.
   *
   * Fulfills VAL-BACKEND-005: SDK getBalances returns available + locked per asset.
   */
  async getBalances(address: string): Promise<UserBalances> {
    const payload: InputViewFunctionData = {
      function: `${this.contractAddress}::${MODULE_NAMES.VIEWS}::get_user_balances`,
      functionArguments: [address, this.baseAsset, this.quoteAsset],
    };

    const result = await this.aptos.view({ payload });

    // Result is (base_available, base_locked, quote_available, quote_locked)
    const baseAvailable = Number(result[0]);
    const baseLocked = Number(result[1]);
    const quoteAvailable = Number(result[2]);
    const quoteLocked = Number(result[3]);

    return {
      cash: {
        available: baseAvailable / 10 ** CASH_DECIMALS,
        locked: baseLocked / 10 ** CASH_DECIMALS,
      },
      usdc: {
        available: quoteAvailable / 10 ** USDC_DECIMALS,
        locked: quoteLocked / 10 ** USDC_DECIMALS,
      },
    };
  }

  /**
   * Get all open orders for a user on a specific market.
   *
   * Calls the on-chain view function `views::get_user_orders(user, pair_id)`.
   */
  async getOrders(address: string, pairId: number): Promise<Order[]> {
    const payload: InputViewFunctionData = {
      function: `${this.contractAddress}::${MODULE_NAMES.VIEWS}::get_user_orders`,
      functionArguments: [address, pairId],
    };

    const result = await this.aptos.view({ payload });

    // Result is vector<Order>
    const rawOrders = result[0] as Array<Record<string, MoveValue>>;

    return rawOrders.map((raw) => parseOrder(raw, pairId));
  }
}

// ============================================================
// Internal Helpers
// ============================================================

/**
 * Aggregate raw order data into depth levels grouped by price.
 * Each depth level has price, quantity (sum at that level), and total (cumulative).
 */
function aggregateDepthLevels(
  rawOrders: Array<Record<string, MoveValue>>,
  direction: "asc" | "desc",
): DepthLevel[] {
  // Group by price
  const priceMap = new Map<number, number>();

  for (const raw of rawOrders) {
    const price = Number(raw["price"]);
    const remaining = Number(raw["remaining_quantity"]);
    priceMap.set(price, (priceMap.get(price) ?? 0) + remaining);
  }

  // Sort prices
  const prices = Array.from(priceMap.keys());
  prices.sort((a, b) => (direction === "asc" ? a - b : b - a));

  // Build depth levels with cumulative total
  let cumulative = 0;
  const levels: DepthLevel[] = [];

  for (const price of prices) {
    const quantity = priceMap.get(price)!;
    cumulative += quantity;
    levels.push({
      price: price / PRICE_SCALE,
      quantity: quantity / 10 ** CASH_DECIMALS,
      total: cumulative / 10 ** CASH_DECIMALS,
    });
  }

  return levels;
}
