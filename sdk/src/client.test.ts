import { describe, it, expect, vi, beforeEach } from "vitest";
import { CashOrderbook } from "./client.js";
import type { PlaceOrderParams, CancelOrderParams } from "./types.js";
import { PRICE_SCALE, CASH_DECIMALS, USDC_DECIMALS } from "@cash/shared";

// ============================================================
// Mock @aptos-labs/ts-sdk
// ============================================================

const mockView = vi.fn();
const mockBuildSimple = vi.fn();
const mockSignAndSubmit = vi.fn();
const mockWaitForTransaction = vi.fn();

vi.mock("@aptos-labs/ts-sdk", () => {
  return {
    Aptos: vi.fn().mockImplementation(() => ({
      view: mockView,
      transaction: {
        build: {
          simple: mockBuildSimple,
        },
      },
      signAndSubmitTransaction: mockSignAndSubmit,
      waitForTransaction: mockWaitForTransaction,
    })),
    AptosConfig: vi.fn().mockImplementation((config: unknown) => config),
    Network: {
      MAINNET: "mainnet",
      TESTNET: "testnet",
      DEVNET: "devnet",
      LOCAL: "local",
    },
  };
});

// ============================================================
// Test Helpers
// ============================================================

const CONTRACT_ADDRESS = "0xCAFE";
const MOCK_TX_HASH = "0xabc123def456789";
const MOCK_ACCOUNT = {
  accountAddress: { toString: () => "0xBEEF" },
  sign: vi.fn(),
} as unknown as import("@aptos-labs/ts-sdk").Account;

function createClient(): CashOrderbook {
  return new CashOrderbook({
    network: "mainnet",
    contractAddress: CONTRACT_ADDRESS,
  });
}

function setupWriteMocks(): void {
  mockBuildSimple.mockResolvedValue({ rawTransaction: "mock_raw" });
  mockSignAndSubmit.mockResolvedValue({ hash: MOCK_TX_HASH });
  mockWaitForTransaction.mockResolvedValue({
    hash: MOCK_TX_HASH,
    success: true,
  });
}

// ============================================================
// Tests
// ============================================================

describe("CashOrderbook", () => {
  let client: CashOrderbook;

  beforeEach(() => {
    vi.clearAllMocks();
    client = createClient();
  });

  // ----------------------------------------------------------
  // Constructor
  // ----------------------------------------------------------

  describe("constructor", () => {
    it("creates client with required config", () => {
      expect(client.contractAddress).toBe(CONTRACT_ADDRESS);
      expect(client.network).toBe("mainnet");
      expect(client.aptos).toBeDefined();
    });

    it("creates client with optional apiKey", () => {
      const c = new CashOrderbook({
        network: "testnet",
        contractAddress: "0x1234",
        apiKey: "test-key",
      });
      expect(c.network).toBe("testnet");
    });

    it("creates client with custom fullnode URL", () => {
      const c = new CashOrderbook({
        network: "local",
        contractAddress: "0x1234",
        fullnodeUrl: "http://localhost:8080",
      });
      expect(c.network).toBe("local");
    });
  });

  // ----------------------------------------------------------
  // placeOrder
  // ----------------------------------------------------------

  describe("placeOrder", () => {
    beforeEach(() => {
      setupWriteMocks();
    });

    it("builds correct GTC limit buy order payload", async () => {
      const params: PlaceOrderParams = {
        pairId: 0,
        price: 1.5,
        quantity: 100,
        side: "buy",
        orderType: "GTC",
      };

      const result = await client.placeOrder(MOCK_ACCOUNT, params);

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockBuildSimple).toHaveBeenCalledWith({
        sender: MOCK_ACCOUNT.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::order_placement::place_limit_order`,
          functionArguments: [
            0,                      // pairId
            1_500_000,              // price = 1.5 * PRICE_SCALE
            100_000_000,            // quantity = 100 * 10^6
            true,                   // is_bid (buy)
            0,                      // GTC = 0
          ],
        },
      });
    });

    it("builds correct IOC limit sell order payload", async () => {
      const params: PlaceOrderParams = {
        pairId: 0,
        price: 2.0,
        quantity: 50,
        side: "sell",
        orderType: "IOC",
      };

      const result = await client.placeOrder(MOCK_ACCOUNT, params);

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockBuildSimple).toHaveBeenCalledWith({
        sender: MOCK_ACCOUNT.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::order_placement::place_limit_order`,
          functionArguments: [
            0,                      // pairId
            2_000_000,              // price = 2.0 * PRICE_SCALE
            50_000_000,             // quantity = 50 * 10^6
            false,                  // is_bid = false (sell)
            1,                      // IOC = 1
          ],
        },
      });
    });

    it("builds correct FOK limit order payload", async () => {
      const params: PlaceOrderParams = {
        pairId: 0,
        price: 0.5,
        quantity: 200,
        side: "buy",
        orderType: "FOK",
      };

      const result = await client.placeOrder(MOCK_ACCOUNT, params);

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockBuildSimple).toHaveBeenCalledWith({
        sender: MOCK_ACCOUNT.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::order_placement::place_limit_order`,
          functionArguments: [0, 500_000, 200_000_000, true, 2],
        },
      });
    });

    it("builds correct PostOnly limit order payload", async () => {
      const params: PlaceOrderParams = {
        pairId: 0,
        price: 3.14,
        quantity: 10,
        side: "sell",
        orderType: "PostOnly",
      };

      const result = await client.placeOrder(MOCK_ACCOUNT, params);

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockBuildSimple).toHaveBeenCalledWith({
        sender: MOCK_ACCOUNT.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::order_placement::place_limit_order`,
          functionArguments: [0, 3_140_000, 10_000_000, false, 3],
        },
      });
    });

    it("builds correct market order payload (no price)", async () => {
      const params: PlaceOrderParams = {
        pairId: 0,
        price: 0, // ignored for market orders
        quantity: 50,
        side: "buy",
        orderType: "Market",
      };

      const result = await client.placeOrder(MOCK_ACCOUNT, params);

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockBuildSimple).toHaveBeenCalledWith({
        sender: MOCK_ACCOUNT.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::order_placement::place_market_order`,
          functionArguments: [0, 50_000_000, true],
        },
      });
    });

    it("builds correct market sell order payload", async () => {
      const params: PlaceOrderParams = {
        pairId: 0,
        price: 0,
        quantity: 75,
        side: "sell",
        orderType: "Market",
      };

      const result = await client.placeOrder(MOCK_ACCOUNT, params);

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockBuildSimple).toHaveBeenCalledWith({
        sender: MOCK_ACCOUNT.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::order_placement::place_market_order`,
          functionArguments: [0, 75_000_000, false],
        },
      });
    });

    it("submits transaction and waits for confirmation", async () => {
      const params: PlaceOrderParams = {
        pairId: 0,
        price: 1.0,
        quantity: 10,
        side: "buy",
        orderType: "GTC",
      };

      await client.placeOrder(MOCK_ACCOUNT, params);

      // Verify the flow: build → sign+submit → wait
      expect(mockBuildSimple).toHaveBeenCalledTimes(1);
      expect(mockSignAndSubmit).toHaveBeenCalledTimes(1);
      expect(mockWaitForTransaction).toHaveBeenCalledWith({
        transactionHash: MOCK_TX_HASH,
      });
    });
  });

  // ----------------------------------------------------------
  // cancelOrder
  // ----------------------------------------------------------

  describe("cancelOrder", () => {
    beforeEach(() => {
      setupWriteMocks();
    });

    it("builds correct cancel order payload", async () => {
      const params: CancelOrderParams = {
        pairId: 0,
        orderId: "42",
      };

      const result = await client.cancelOrder(MOCK_ACCOUNT, params);

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockBuildSimple).toHaveBeenCalledWith({
        sender: MOCK_ACCOUNT.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::cancel::cancel_order`,
          functionArguments: [0, 42],
        },
      });
    });

    it("submits cancellation and returns tx hash", async () => {
      const result = await client.cancelOrder(MOCK_ACCOUNT, {
        pairId: 0,
        orderId: "99",
      });

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockSignAndSubmit).toHaveBeenCalledTimes(1);
      expect(mockWaitForTransaction).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------
  // deposit
  // ----------------------------------------------------------

  describe("deposit", () => {
    beforeEach(() => {
      setupWriteMocks();
    });

    it("builds correct deposit payload with default decimals", async () => {
      const assetAddr = "0xUSDC_META";
      const result = await client.deposit(MOCK_ACCOUNT, assetAddr, 100);

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockBuildSimple).toHaveBeenCalledWith({
        sender: MOCK_ACCOUNT.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::accounts::deposit`,
          functionArguments: [assetAddr, 100_000_000],
        },
      });
    });

    it("builds correct deposit payload with custom decimals", async () => {
      const assetAddr = "0xCASH_META";
      const result = await client.deposit(MOCK_ACCOUNT, assetAddr, 500, 6);

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockBuildSimple).toHaveBeenCalledWith({
        sender: MOCK_ACCOUNT.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::accounts::deposit`,
          functionArguments: [assetAddr, 500_000_000],
        },
      });
    });

    it("returns transaction hash on success", async () => {
      const result = await client.deposit(MOCK_ACCOUNT, "0xAsset", 50);
      expect(result.txHash).toBe(MOCK_TX_HASH);
    });
  });

  // ----------------------------------------------------------
  // withdraw
  // ----------------------------------------------------------

  describe("withdraw", () => {
    beforeEach(() => {
      setupWriteMocks();
    });

    it("builds correct withdraw payload", async () => {
      const assetAddr = "0xUSDC_META";
      const result = await client.withdraw(MOCK_ACCOUNT, assetAddr, 75);

      expect(result.txHash).toBe(MOCK_TX_HASH);
      expect(mockBuildSimple).toHaveBeenCalledWith({
        sender: MOCK_ACCOUNT.accountAddress,
        data: {
          function: `${CONTRACT_ADDRESS}::accounts::withdraw`,
          functionArguments: [assetAddr, 75_000_000],
        },
      });
    });

    it("returns transaction hash on success", async () => {
      const result = await client.withdraw(MOCK_ACCOUNT, "0xAsset", 25);
      expect(result.txHash).toBe(MOCK_TX_HASH);
    });
  });

  // ----------------------------------------------------------
  // getOrderbook
  // ----------------------------------------------------------

  describe("getOrderbook", () => {
    it("calls view function with correct payload", async () => {
      mockView.mockResolvedValue([[], []]);

      await client.getOrderbook(0);

      expect(mockView).toHaveBeenCalledWith({
        payload: {
          function: `${CONTRACT_ADDRESS}::views::get_orderbook`,
          functionArguments: [0],
        },
      });
    });

    it("returns typed bids and asks from view function", async () => {
      // Mock response: 2 bids, 2 asks
      const mockBids = [
        {
          order_id: "1",
          owner: "0xBEEF",
          price: "3000000", // 3.0
          original_quantity: "100000000", // 100
          remaining_quantity: "100000000",
          is_bid: true,
          order_type: "0",
          timestamp: "1000",
          pair_id: "0",
          locked_quote: "300000000",
        },
        {
          order_id: "2",
          owner: "0xBEEF",
          price: "2000000", // 2.0
          original_quantity: "50000000", // 50
          remaining_quantity: "50000000",
          is_bid: true,
          order_type: "0",
          timestamp: "2000",
          pair_id: "0",
          locked_quote: "100000000",
        },
      ];

      const mockAsks = [
        {
          order_id: "3",
          owner: "0xDEAD",
          price: "4000000", // 4.0
          original_quantity: "80000000", // 80
          remaining_quantity: "80000000",
          is_bid: false,
          order_type: "0",
          timestamp: "1500",
          pair_id: "0",
          locked_quote: "0",
        },
        {
          order_id: "4",
          owner: "0xDEAD",
          price: "5000000", // 5.0
          original_quantity: "60000000", // 60
          remaining_quantity: "60000000",
          is_bid: false,
          order_type: "0",
          timestamp: "2500",
          pair_id: "0",
          locked_quote: "0",
        },
      ];

      mockView.mockResolvedValue([mockBids, mockAsks]);

      const book = await client.getOrderbook(0);

      // Bids: aggregated by price, descending
      expect(book.bids).toHaveLength(2);
      expect(book.bids[0].price).toBe(3.0);
      expect(book.bids[0].quantity).toBe(100);
      expect(book.bids[0].total).toBe(100); // cumulative
      expect(book.bids[1].price).toBe(2.0);
      expect(book.bids[1].quantity).toBe(50);
      expect(book.bids[1].total).toBe(150); // 100 + 50

      // Asks: aggregated by price, ascending
      expect(book.asks).toHaveLength(2);
      expect(book.asks[0].price).toBe(4.0);
      expect(book.asks[0].quantity).toBe(80);
      expect(book.asks[0].total).toBe(80);
      expect(book.asks[1].price).toBe(5.0);
      expect(book.asks[1].quantity).toBe(60);
      expect(book.asks[1].total).toBe(140); // 80 + 60
    });

    it("aggregates multiple orders at the same price", async () => {
      // Two bids at the same price
      const mockBids = [
        {
          order_id: "1",
          owner: "0xA",
          price: "2000000",
          original_quantity: "30000000",
          remaining_quantity: "30000000",
          is_bid: true,
          order_type: "0",
          timestamp: "1000",
          pair_id: "0",
          locked_quote: "60000000",
        },
        {
          order_id: "2",
          owner: "0xB",
          price: "2000000",
          original_quantity: "20000000",
          remaining_quantity: "20000000",
          is_bid: true,
          order_type: "0",
          timestamp: "2000",
          pair_id: "0",
          locked_quote: "40000000",
        },
      ];

      mockView.mockResolvedValue([mockBids, []]);

      const book = await client.getOrderbook(0);

      // Should aggregate to a single level
      expect(book.bids).toHaveLength(1);
      expect(book.bids[0].price).toBe(2.0);
      expect(book.bids[0].quantity).toBe(50); // 30 + 20
      expect(book.bids[0].total).toBe(50);
    });

    it("returns empty arrays for empty book", async () => {
      mockView.mockResolvedValue([[], []]);

      const book = await client.getOrderbook(0);

      expect(book.bids).toEqual([]);
      expect(book.asks).toEqual([]);
    });
  });

  // ----------------------------------------------------------
  // getBalances
  // ----------------------------------------------------------

  describe("getBalances", () => {
    it("calls view function with correct parameters", async () => {
      mockView.mockResolvedValue(["0", "0", "0", "0"]);

      await client.getBalances("0xBEEF", "0xCASH", "0xUSDC");

      expect(mockView).toHaveBeenCalledWith({
        payload: {
          function: `${CONTRACT_ADDRESS}::views::get_user_balances`,
          functionArguments: ["0xBEEF", "0xCASH", "0xUSDC"],
        },
      });
    });

    it("returns typed balance object with human-readable amounts", async () => {
      // On-chain: 500 CASH available (500_000_000), 100 locked, 1000 USDC available, 200 locked
      mockView.mockResolvedValue([
        "500000000",  // base available
        "100000000",  // base locked
        "1000000000", // quote available
        "200000000",  // quote locked
      ]);

      const balances = await client.getBalances("0xBEEF", "0xCASH", "0xUSDC");

      expect(balances.cash.available).toBe(500);
      expect(balances.cash.locked).toBe(100);
      expect(balances.usdc.available).toBe(1000);
      expect(balances.usdc.locked).toBe(200);
    });

    it("returns zeros for non-existent user", async () => {
      mockView.mockResolvedValue(["0", "0", "0", "0"]);

      const balances = await client.getBalances("0xDEAD", "0xCASH", "0xUSDC");

      expect(balances.cash.available).toBe(0);
      expect(balances.cash.locked).toBe(0);
      expect(balances.usdc.available).toBe(0);
      expect(balances.usdc.locked).toBe(0);
    });
  });

  // ----------------------------------------------------------
  // getOrders
  // ----------------------------------------------------------

  describe("getOrders", () => {
    it("calls view function with correct parameters", async () => {
      mockView.mockResolvedValue([[]]);

      await client.getOrders("0xBEEF", 0);

      expect(mockView).toHaveBeenCalledWith({
        payload: {
          function: `${CONTRACT_ADDRESS}::views::get_user_orders`,
          functionArguments: ["0xBEEF", 0],
        },
      });
    });

    it("returns typed Order array from view function", async () => {
      const mockOrders = [
        {
          order_id: "42",
          owner: "0xBEEF",
          price: "1500000", // 1.5
          original_quantity: "100000000", // 100
          remaining_quantity: "100000000",
          is_bid: true,
          order_type: "0", // GTC
          timestamp: "1000000",
          pair_id: "0",
          locked_quote: "150000000",
        },
        {
          order_id: "43",
          owner: "0xBEEF",
          price: "5000000", // 5.0
          original_quantity: "50000000", // 50
          remaining_quantity: "30000000", // partially filled
          is_bid: false,
          order_type: "1", // IOC
          timestamp: "2000000",
          pair_id: "0",
          locked_quote: "0",
        },
      ];

      mockView.mockResolvedValue([mockOrders]);

      const orders = await client.getOrders("0xBEEF", 0);

      expect(orders).toHaveLength(2);

      // First order: GTC buy, fully open
      expect(orders[0].orderId).toBe("42");
      expect(orders[0].owner).toBe("0xBEEF");
      expect(orders[0].side).toBe("buy");
      expect(orders[0].type).toBe("GTC");
      expect(orders[0].price).toBe(1.5);
      expect(orders[0].quantity).toBe(100);
      expect(orders[0].remaining).toBe(100);
      expect(orders[0].status).toBe("open");
      expect(orders[0].pairId).toBe(0);

      // Second order: IOC sell, partially filled
      expect(orders[1].orderId).toBe("43");
      expect(orders[1].side).toBe("sell");
      expect(orders[1].type).toBe("IOC");
      expect(orders[1].price).toBe(5.0);
      expect(orders[1].quantity).toBe(50);
      expect(orders[1].remaining).toBe(30);
      expect(orders[1].status).toBe("partially_filled");
    });

    it("returns empty array when user has no orders", async () => {
      mockView.mockResolvedValue([[]]);

      const orders = await client.getOrders("0xDEAD", 0);

      expect(orders).toEqual([]);
    });

    it("correctly identifies fully filled orders", async () => {
      const mockOrders = [
        {
          order_id: "99",
          owner: "0xBEEF",
          price: "1000000",
          original_quantity: "50000000",
          remaining_quantity: "0", // fully filled
          is_bid: true,
          order_type: "2", // FOK
          timestamp: "5000000",
          pair_id: "0",
          locked_quote: "50000000",
        },
      ];

      mockView.mockResolvedValue([mockOrders]);

      const orders = await client.getOrders("0xBEEF", 0);

      expect(orders[0].status).toBe("filled");
      expect(orders[0].type).toBe("FOK");
    });
  });
});

// ----------------------------------------------------------
// Export/import verification
// ----------------------------------------------------------

describe("SDK exports", () => {
  it("exports SDK_VERSION", async () => {
    const mod = await import("./index.js");
    expect(mod.SDK_VERSION).toBe("0.1.0");
  });

  it("exports CashOrderbook class", async () => {
    const mod = await import("./index.js");
    expect(mod.CashOrderbook).toBeDefined();
  });

  it("exports shared constants", async () => {
    const mod = await import("./index.js");
    expect(mod.PRICE_SCALE).toBe(1_000_000);
    expect(mod.CASH_DECIMALS).toBe(6);
    expect(mod.USDC_DECIMALS).toBe(6);
    expect(mod.CASH_TOKEN_ADDRESS).toBeDefined();
    expect(mod.USDC_TOKEN_ADDRESS).toBeDefined();
  });

  it("exports ORDER_TYPE_MAP", async () => {
    const mod = await import("./index.js");
    expect(mod.ORDER_TYPE_MAP).toEqual({
      GTC: 0,
      IOC: 1,
      FOK: 2,
      PostOnly: 3,
    });
  });

  it("exports MODULE_NAMES", async () => {
    const mod = await import("./index.js");
    expect(mod.MODULE_NAMES).toBeDefined();
    expect(mod.MODULE_NAMES.ORDER_PLACEMENT).toBe("order_placement");
    expect(mod.MODULE_NAMES.CANCEL).toBe("cancel");
    expect(mod.MODULE_NAMES.ACCOUNTS).toBe("accounts");
    expect(mod.MODULE_NAMES.VIEWS).toBe("views");
  });
});
