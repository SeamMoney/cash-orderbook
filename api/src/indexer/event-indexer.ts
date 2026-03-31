/**
 * EventIndexer — polls Aptos RPC for contract events and updates in-memory OrderbookState.
 *
 * Events processed:
 *   - OrderPlaced (from order_placement module)
 *   - OrderCancelled (from cancel module)
 *   - OrderFilled (from settlement module)
 *   - TradeEvent (from settlement module)
 *   - DepositEvent (from accounts module)
 *   - WithdrawEvent (from accounts module)
 */

import { Aptos, AptosConfig, Network } from "@aptos-labs/ts-sdk";
import type { OrderbookState } from "../state/orderbook-state.js";

/** Configuration for the EventIndexer */
export interface EventIndexerConfig {
  /** Aptos network to connect to */
  network?: "mainnet" | "testnet" | "devnet" | "local";
  /** The contract address where cash_orderbook is deployed */
  contractAddress: string;
  /** Poll interval in milliseconds (default: 2000) */
  pollIntervalMs?: number;
  /** Optional custom fullnode URL */
  fullnodeUrl?: string;
}

/** Event types we index */
const EVENT_TYPES = [
  "order_placement::OrderPlaced",
  "cancel::OrderCancelled",
  "settlement::OrderFilled",
  "settlement::TradeEvent",
  "accounts::DepositEvent",
  "accounts::WithdrawEvent",
] as const;

/**
 * Map SDK network type to Aptos SDK Network enum.
 */
function toAptosNetwork(network: string): Network {
  switch (network) {
    case "mainnet": return Network.MAINNET;
    case "testnet": return Network.TESTNET;
    case "devnet": return Network.DEVNET;
    case "local": return Network.LOCAL;
    default: return Network.MAINNET;
  }
}

/**
 * EventIndexer polls Aptos RPC for contract events and feeds them
 * into the in-memory OrderbookState for fast API responses.
 */
export class EventIndexer {
  /** Aptos client for RPC polling (used when polling is active) */
  readonly aptos: Aptos;
  private readonly contractAddress: string;
  private readonly pollIntervalMs: number;
  private readonly state: OrderbookState;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;

  constructor(config: EventIndexerConfig, state: OrderbookState) {
    this.contractAddress = config.contractAddress;
    this.pollIntervalMs = config.pollIntervalMs ?? 2000;
    this.state = state;

    const aptosConfig = new AptosConfig({
      network: toAptosNetwork(config.network ?? "mainnet"),
      ...(config.fullnodeUrl ? { fullnode: config.fullnodeUrl } : {}),
    });

    this.aptos = new Aptos(aptosConfig);
  }

  /**
   * Start polling for events.
   */
  start(): void {
    if (this.isRunning) return;
    this.isRunning = true;
    this.pollTimer = setInterval(() => {
      void this.poll();
    }, this.pollIntervalMs);
    // Initial poll
    void this.poll();
  }

  /**
   * Stop polling for events.
   */
  stop(): void {
    this.isRunning = false;
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  /**
   * Poll for new events from the contract.
   */
  private async poll(): Promise<void> {
    try {
      for (const eventType of EVENT_TYPES) {
        const fullType = `${this.contractAddress}::${eventType}`;
        await this.processEventType(fullType, eventType);
      }
    } catch (error) {
      // Silently handle poll errors — the indexer is best-effort.
      // In production, we'd log and alert.
      if (process.env.NODE_ENV !== "test") {
        console.error("[EventIndexer] Poll error:", error);
      }
    }
  }

  /**
   * Process a specific event type, fetching new events since last indexed version.
   */
  private async processEventType(
    _fullEventType: string,
    shortType: string,
  ): Promise<void> {
    // In production, we'd use the Aptos events API to fetch events
    // by type after a certain sequence number. For now, this is
    // the integration point — events are fed via processEvent() in tests
    // and manual polling would use:
    //
    // const events = await this.aptos.getEvents({
    //   eventType: fullEventType,
    //   options: { start: lastSequence, limit: 100 },
    // });
    //
    // For each event, call the appropriate processor on state.
    void shortType;
  }

  /**
   * Process a single raw event (used for testing and manual event injection).
   */
  processEvent(eventType: string, data: Record<string, unknown>): void {
    switch (eventType) {
      case "OrderPlaced":
        this.state.processOrderPlaced({
          order_id: String(data.order_id),
          owner: String(data.owner),
          pair_id: Number(data.pair_id),
          price: Number(data.price),
          quantity: Number(data.quantity),
          is_bid: Boolean(data.is_bid),
          order_type: Number(data.order_type),
          timestamp: Number(data.timestamp),
        });
        break;

      case "OrderCancelled":
        this.state.processOrderCancelled({
          order_id: String(data.order_id),
          owner: String(data.owner),
          pair_id: Number(data.pair_id),
          remaining_quantity: Number(data.remaining_quantity),
          is_bid: Boolean(data.is_bid),
          price: Number(data.price),
        });
        break;

      case "TradeEvent":
        this.state.processTrade({
          taker_order_id: String(data.taker_order_id),
          maker_order_id: String(data.maker_order_id),
          price: Number(data.price),
          quantity: Number(data.quantity),
          quote_amount: Number(data.quote_amount),
          buyer: String(data.buyer),
          seller: String(data.seller),
          pair_id: Number(data.pair_id),
          taker_is_bid: Boolean(data.taker_is_bid),
        });
        break;

      case "OrderFilled":
        this.state.processOrderFilled({
          order_id: String(data.order_id),
          fill_quantity: Number(data.fill_quantity),
          fill_price: Number(data.fill_price),
          owner: String(data.owner),
          pair_id: Number(data.pair_id),
        });
        break;

      case "DepositEvent":
        this.state.processDeposit({
          user: String(data.user),
          asset: String(data.asset),
          amount: Number(data.amount),
        });
        break;

      case "WithdrawEvent":
        this.state.processWithdraw({
          user: String(data.user),
          asset: String(data.asset),
          amount: Number(data.amount),
        });
        break;
    }
  }
}
