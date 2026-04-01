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
 *
 * Supports two polling strategies:
 *   1. Indexer GraphQL (mainnet): Uses `getModuleEventsByEventType()` with cursor-based pagination.
 *   2. REST transaction polling (testnet): Fetches account transactions from the REST API
 *      and extracts matching events. Required because the Indexer v1 `events` table is
 *      deprecated on testnet.
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
  /** Maximum events to fetch per poll per event type (default: 100) */
  batchSize?: number;
}

/** Event type definitions: module::EventStruct → short name used by processEvent() */
const EVENT_TYPE_MAP: Record<string, string> = {
  "order_placement::OrderPlaced": "OrderPlaced",
  "cancel::OrderCancelled": "OrderCancelled",
  "settlement::OrderFilled": "OrderFilled",
  "settlement::TradeEvent": "TradeEvent",
  "accounts::DepositEvent": "DepositEvent",
  "accounts::WithdrawEvent": "WithdrawEvent",
};

/** All event module::struct types we index */
const EVENT_TYPES = Object.keys(EVENT_TYPE_MAP);

/**
 * An event fetched from RPC with transaction ordering metadata,
 * used for cross-type sorting before processing.
 */
interface IndexedEvent {
  /** Full event type string (e.g. "0xCAFE::order_placement::OrderPlaced") */
  fullType: string;
  /** Short event type name (e.g. "OrderPlaced") */
  shortType: string;
  /** Raw event data payload */
  data: Record<string, unknown>;
  /** Transaction version — primary sort key for on-chain ordering */
  transactionVersion: number;
  /** Event index within the transaction — secondary sort key */
  eventIndex: number;
}

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
 * Resolve fullnode URL for a network.
 */
function getFullnodeUrl(network: string, customUrl?: string): string {
  if (customUrl) return customUrl;
  switch (network) {
    case "testnet": return "https://fullnode.testnet.aptoslabs.com/v1";
    case "devnet": return "https://fullnode.devnet.aptoslabs.com/v1";
    case "local": return "http://localhost:8080/v1";
    default: return "https://fullnode.mainnet.aptoslabs.com/v1";
  }
}

/**
 * EventIndexer polls Aptos RPC for contract events and feeds them
 * into the in-memory OrderbookState for fast API responses.
 *
 * On testnet/devnet (where Indexer GraphQL events v1 is deprecated),
 * falls back to polling account transactions via the REST fullnode API
 * and extracting matching contract events from them.
 */
export class EventIndexer {
  /** Aptos client for RPC polling */
  readonly aptos: Aptos;
  private readonly contractAddress: string;
  private readonly network: string;
  private readonly pollIntervalMs: number;
  private readonly batchSize: number;
  private readonly state: OrderbookState;
  private readonly fullnodeUrl: string;
  private pollTimer: ReturnType<typeof setInterval> | null = null;
  private isRunning: boolean = false;
  private isPolling: boolean = false;

  /**
   * Per-event-type cursor: tracks the last processed sequence_number so we
   * only fetch new events on each poll. Keyed by the full event type string
   * (e.g. "0xCAFE::order_placement::OrderPlaced").
   */
  private cursors: Map<string, number> = new Map();

  /**
   * For REST-based polling: tracks the offset into the account's transaction list.
   * Incremented as we process transactions.
   */
  private restTxnOffset: number = 0;

  /** Whether we've detected that the Indexer GraphQL events table is unavailable */
  private useRestFallback: boolean = false;

  constructor(config: EventIndexerConfig, state: OrderbookState) {
    this.contractAddress = config.contractAddress;
    this.network = config.network ?? "mainnet";
    this.pollIntervalMs = config.pollIntervalMs ?? 2000;
    this.batchSize = config.batchSize ?? 100;
    this.state = state;
    this.fullnodeUrl = getFullnodeUrl(this.network, config.fullnodeUrl);

    // Pre-enable REST fallback for testnet/devnet where Indexer events v1 is deprecated
    if (this.network === "testnet" || this.network === "devnet") {
      this.useRestFallback = true;
    }

    const aptosConfig = new AptosConfig({
      network: toAptosNetwork(this.network),
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
   * Get the current cursor for an event type (for testing/debugging).
   */
  getCursor(eventType: string): number | undefined {
    return this.cursors.get(eventType);
  }

  /**
   * Poll for new events from the contract.
   * Skips if a previous poll is still in progress (prevents overlap).
   *
   * Uses REST transaction polling on testnet/devnet (Indexer events v1 deprecated),
   * and Indexer GraphQL polling on mainnet.
   */
  private async poll(): Promise<void> {
    if (this.isPolling) return;
    this.isPolling = true;

    try {
      if (this.useRestFallback) {
        await this.pollViaRest();
      } else {
        await this.pollViaIndexer();
      }
    } catch (error) {
      // Silently handle poll errors — the indexer is best-effort.
      if (process.env.NODE_ENV !== "test") {
        console.error("[EventIndexer] Poll error:", error);
      }
    } finally {
      this.isPolling = false;
    }
  }

  /**
   * Poll via Indexer GraphQL API (mainnet).
   * Fetches all event types, merges into a single array, and sorts by
   * (transaction_version, event_index) to ensure on-chain ordering.
   */
  private async pollViaIndexer(): Promise<void> {
    const fetchPromises = EVENT_TYPES.map((moduleEventType) => {
      const fullType = `${this.contractAddress}::${moduleEventType}`;
      const shortType = EVENT_TYPE_MAP[moduleEventType];
      return this.fetchEventsViaIndexer(fullType, shortType);
    });

    const results = await Promise.all(fetchPromises);

    // Merge all fetched events into a single array
    const allEvents: IndexedEvent[] = [];
    for (const events of results) {
      allEvents.push(...events);
    }

    if (allEvents.length === 0) return;

    // Sort by (transaction_version, event_index) to preserve on-chain order
    allEvents.sort((a, b) => {
      if (a.transactionVersion !== b.transactionVersion) {
        return a.transactionVersion - b.transactionVersion;
      }
      return a.eventIndex - b.eventIndex;
    });

    // Process events in sorted order
    for (const event of allEvents) {
      this.processEvent(event.shortType, event.data);
    }

    // Update cursors for each event type based on how many we fetched
    for (const events of results) {
      if (events.length > 0) {
        const fullType = events[0].fullType;
        const cursor = this.cursors.get(fullType) ?? 0;
        this.cursors.set(fullType, cursor + events.length);
      }
    }

    // Update the global last indexed version from the last sorted event
    const lastEvent = allEvents[allEvents.length - 1];
    if (lastEvent.transactionVersion > this.state.getLastIndexedVersion()) {
      this.state.setLastIndexedVersion(lastEvent.transactionVersion);
    }
  }

  /**
   * Poll via REST fullnode API (testnet/devnet fallback).
   *
   * Fetches recent transactions from the contract account and extracts
   * matching events from their `events` arrays. This works on testnet
   * where the Indexer GraphQL events v1 table is deprecated.
   */
  private async pollViaRest(): Promise<void> {
    try {
      const url = `${this.fullnodeUrl}/accounts/${this.contractAddress}/transactions?start=${this.restTxnOffset}&limit=${this.batchSize}`;
      const response = await fetch(url, {
        headers: { Accept: "application/json" },
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        if (process.env.NODE_ENV !== "test") {
          console.error(`[EventIndexer] REST poll failed: HTTP ${response.status}`);
        }
        return;
      }

      const transactions = (await response.json()) as Array<{
        type: string;
        version: string;
        success: boolean;
        events: Array<{
          type: string;
          data: Record<string, unknown>;
          sequence_number: string;
          guid: { creation_number: string; account_address: string };
        }>;
      }>;

      if (!transactions || transactions.length === 0) return;

      // Build the set of fully-qualified event types we care about
      const fullTypeToShort = new Map<string, string>();
      for (const moduleEventType of EVENT_TYPES) {
        const fullType = `${this.contractAddress}::${moduleEventType}`;
        fullTypeToShort.set(fullType, EVENT_TYPE_MAP[moduleEventType]);
      }

      const allEvents: IndexedEvent[] = [];

      for (const txn of transactions) {
        if (txn.type !== "user_transaction" || !txn.success) continue;

        const txVersion = Number(txn.version);

        for (let i = 0; i < txn.events.length; i++) {
          const event = txn.events[i];
          const shortType = fullTypeToShort.get(event.type);
          if (shortType) {
            allEvents.push({
              fullType: event.type,
              shortType,
              data: event.data,
              transactionVersion: txVersion,
              eventIndex: i,
            });
          }
        }
      }

      // Update offset for next poll (skip past processed transactions)
      this.restTxnOffset += transactions.length;

      if (allEvents.length === 0) return;

      // Sort by (transaction_version, event_index)
      allEvents.sort((a, b) => {
        if (a.transactionVersion !== b.transactionVersion) {
          return a.transactionVersion - b.transactionVersion;
        }
        return a.eventIndex - b.eventIndex;
      });

      // Process events in order
      for (const event of allEvents) {
        this.processEvent(event.shortType, event.data);
      }

      // Update last indexed version
      const lastEvent = allEvents[allEvents.length - 1];
      if (lastEvent.transactionVersion > this.state.getLastIndexedVersion()) {
        this.state.setLastIndexedVersion(lastEvent.transactionVersion);
      }

      if (process.env.NODE_ENV !== "test") {
        console.log(
          `[EventIndexer] REST poll: processed ${allEvents.length} events from ${transactions.length} transactions`,
        );
      }
    } catch (error) {
      if (process.env.NODE_ENV !== "test") {
        console.error("[EventIndexer] REST poll error:", error);
      }
    }
  }

  /**
   * Fetch events of a specific type from Aptos Indexer GraphQL API.
   * Returns raw events with transaction ordering metadata for cross-type sorting.
   */
  private async fetchEventsViaIndexer(
    fullEventType: string,
    shortType: string,
  ): Promise<IndexedEvent[]> {
    try {
      const cursor = this.cursors.get(fullEventType) ?? 0;

      const events = await this.aptos.getModuleEventsByEventType({
        eventType: fullEventType as `${string}::${string}::${string}`,
        options: {
          offset: cursor,
          limit: this.batchSize,
          orderBy: [{ sequence_number: "asc" } as Record<string, unknown>],
        },
      });

      if (!events || events.length === 0) return [];

      return events.map((event) => ({
        fullType: fullEventType,
        shortType,
        data: event.data as Record<string, unknown>,
        transactionVersion: typeof event.transaction_version === "number"
          ? event.transaction_version
          : Number(event.transaction_version ?? 0),
        eventIndex: typeof (event as Record<string, unknown>).event_index === "number"
          ? (event as Record<string, unknown>).event_index as number
          : Number((event as Record<string, unknown>).event_index ?? 0),
      }));
    } catch (error) {
      // If Indexer GraphQL fails, switch to REST fallback
      const errorMsg = error instanceof Error ? error.message : String(error);
      if (errorMsg.includes("Deprecated Resource") || errorMsg.includes("events")) {
        if (!this.useRestFallback) {
          if (process.env.NODE_ENV !== "test") {
            console.warn("[EventIndexer] Indexer events v1 deprecated — switching to REST fallback");
          }
          this.useRestFallback = true;
        }
      }

      if (process.env.NODE_ENV !== "test") {
        console.error(`[EventIndexer] Error fetching ${fullEventType}:`, error);
      }
      return [];
    }
  }

  /**
   * Process a single raw event (used for testing, manual event injection,
   * and by the poll loop after fetching from RPC).
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
