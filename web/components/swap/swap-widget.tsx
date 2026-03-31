"use client";

import { useState, useCallback, useEffect, useRef, forwardRef } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ArrowDownUp, Loader2, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import { useDepth } from "@/hooks/use-depth";
import { useBalances } from "@/hooks/use-balances";
import { useAccountSubscription } from "@/hooks/use-account-subscription";
import { buildPlaceOrderPayload } from "@/lib/sdk";
import {
  calculateSwapQuote,
  type SwapDirection,
  type SwapQuote,
} from "@/lib/swap-quote";
import { SwapPriceDetails } from "@/components/swap/swap-price-details";
import {
  TokenSelectorModal,
  SUPPORTED_TOKENS,
  type TokenInfo,
} from "@/components/swap/token-selector-modal";
import { WalletSelector } from "@/components/wallet/wallet-selector";
import { formatBalance } from "@/lib/utils";

/** Tab types for the swap widget */
type SwapTab = "swap" | "limit";

/** Which token selector slot is being edited */
type SelectorSlot = "from" | "to" | null;

/** CASH/USDC token metadata — lookup map */
const TOKENS: Record<string, TokenInfo> = Object.fromEntries(
  SUPPORTED_TOKENS.map((t) => [t.symbol, t]),
);

type TokenSymbol = string;

/**
 * SwapWidget — Uniswap-style swap card with Swap and Limit tabs.
 *
 * Features:
 * - Swap + Limit tab switching with animated indicator
 * - "You pay" / "You receive" inputs with token selectors
 * - Direction toggle that rotates on click
 * - CTA button with state-aware labels
 * - Limit order form with price, amount, buy/sell toggle
 * - Expandable price details section
 * - Toast notifications on execution
 */
export function SwapWidget(): React.ReactElement {
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const { depth, loading: depthLoading } = useDepth(3000);

  const walletAddress =
    connected && account?.address ? account.address.toString() : undefined;
  const { balances, updateBalances } = useBalances(walletAddress);

  // Subscribe to WS account channel for real-time balance updates
  useAccountSubscription(walletAddress, updateBalances);

  // Wallet selector modal state (for CTA "Connect Wallet" clicks)
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);

  // Active tab
  const [activeTab, setActiveTab] = useState<SwapTab>("swap");

  // --- Swap tab state ---
  const [direction, setDirection] = useState<SwapDirection>("sell");
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [directionRotation, setDirectionRotation] = useState(0);

  // --- Token selector modal state ---
  const [selectorOpen, setSelectorOpen] = useState<SelectorSlot>(null);
  const fromTokenBtnRef = useRef<HTMLButtonElement>(null);
  const toTokenBtnRef = useRef<HTMLButtonElement>(null);

  // --- Limit tab state ---
  const [limitSide, setLimitSide] = useState<"buy" | "sell">("buy");
  const [limitPrice, setLimitPrice] = useState("");
  const [limitAmount, setLimitAmount] = useState("");
  const [isPlacingOrder, setIsPlacingOrder] = useState(false);

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fromToken: TokenSymbol = direction === "sell" ? "CASH" : "USDC";
  const toToken: TokenSymbol = direction === "sell" ? "USDC" : "CASH";

  // Determine user's available balance for the "from" asset
  const fromBalance = balances
    ? direction === "sell"
      ? balances.cash.available
      : balances.usdc.available
    : null;

  const toBalance = balances
    ? direction === "sell"
      ? balances.usdc.available
      : balances.cash.available
    : null;

  // Check if the input amount exceeds the user's available balance
  const inputNum = parseFloat(inputAmount);
  const insufficientBalance =
    connected &&
    fromBalance !== null &&
    !isNaN(inputNum) &&
    inputNum > 0 &&
    inputNum > fromBalance;

  // Calculate quote with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0 || !depth) {
      setQuote(null);
      return;
    }

    debounceRef.current = setTimeout(() => {
      const result = calculateSwapQuote(
        amount,
        direction,
        depth.bids,
        depth.asks,
      );
      setQuote(result);
    }, 300);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputAmount, direction, depth]);

  const handleDirectionToggle = useCallback((): void => {
    setDirection((prev) => (prev === "sell" ? "buy" : "sell"));
    setInputAmount("");
    setQuote(null);
    setDirectionRotation((prev) => prev + 180);
  }, []);

  /** Handle token selection from the modal */
  const handleTokenSelect = useCallback(
    (token: TokenInfo): void => {
      if (selectorOpen === "from") {
        // If user selects the same token that's currently on "to", swap direction
        if (token.symbol === toToken) {
          setDirection((prev) => (prev === "sell" ? "buy" : "sell"));
        } else {
          // Set direction based on what was selected as "from"
          setDirection(token.symbol === "CASH" ? "sell" : "buy");
        }
      } else if (selectorOpen === "to") {
        // If user selects the same token that's currently on "from", swap direction
        if (token.symbol === fromToken) {
          setDirection((prev) => (prev === "sell" ? "buy" : "sell"));
        } else {
          // Set direction based on what was selected as "to"
          setDirection(token.symbol === "USDC" ? "sell" : "buy");
        }
      }
      setInputAmount("");
      setQuote(null);
      setSelectorOpen(null);
    },
    [selectorOpen, fromToken, toToken],
  );

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const value = e.target.value;
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setInputAmount(value);
      }
    },
    [],
  );

  const handleLimitPriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const value = e.target.value;
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setLimitPrice(value);
      }
    },
    [],
  );

  const handleLimitAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const value = e.target.value;
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setLimitAmount(value);
      }
    },
    [],
  );

  // Compute USD equivalent for the "from" input
  const fromUsdEquivalent =
    quote && inputNum > 0
      ? direction === "sell"
        ? quote.outputAmount
        : inputNum
      : null;

  // Compute USD equivalent for the "to" output
  const toUsdEquivalent =
    quote
      ? direction === "sell"
        ? quote.outputAmount
        : quote.outputAmount * (quote.effectivePrice || 1)
      : null;

  const handleSwap = useCallback(async (): Promise<void> => {
    if (!connected || !account || !signAndSubmitTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!quote) {
      toast.error("No price quote available");
      return;
    }

    setIsSwapping(true);

    try {
      // For sell-side, the user enters CASH amount → pass directly as quantity.
      // For buy-side, the user enters USDC amount, but the contract expects
      // base-asset (CASH) quantity. Use the quote's outputAmount which is the
      // estimated CASH the user will receive (computed by walking asks).
      const baseQuantity = direction === "buy" ? quote.outputAmount : amount;

      const payload = buildPlaceOrderPayload({
        pairId: 0,
        price: 0,
        quantity: baseQuantity,
        side: direction === "buy" ? "buy" : "sell",
        orderType: "Market",
      });

      const response = await signAndSubmitTransaction({
        data: payload,
      });

      const txHash =
        typeof response === "object" && response !== null && "hash" in response
          ? (response as { hash: string }).hash
          : String(response);

      toast.success("Swap successful", {
        description: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
        duration: 6000,
      });

      setInputAmount("");
      setQuote(null);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transaction failed";
      toast.error("Swap failed", {
        description: message,
        duration: 8000,
        action: {
          label: "Retry",
          onClick: () => void handleSwap(),
        },
      });
    } finally {
      setIsSwapping(false);
    }
  }, [
    connected,
    account,
    signAndSubmitTransaction,
    inputAmount,
    quote,
    direction,
  ]);

  const handlePlaceLimitOrder = useCallback(async (): Promise<void> => {
    if (!connected || !account || !signAndSubmitTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    const price = parseFloat(limitPrice);
    const amount = parseFloat(limitAmount);

    if (isNaN(price) || price <= 0) {
      toast.error("Please enter a valid price");
      return;
    }
    if (isNaN(amount) || amount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsPlacingOrder(true);

    try {
      const payload = buildPlaceOrderPayload({
        pairId: 0,
        price,
        quantity: amount,
        side: limitSide,
        orderType: "GTC",
      });

      const response = await signAndSubmitTransaction({
        data: payload,
      });

      const txHash =
        typeof response === "object" && response !== null && "hash" in response
          ? (response as { hash: string }).hash
          : String(response);

      toast.success("Order placed", {
        description: `${limitSide === "buy" ? "Buy" : "Sell"} ${amount} CASH @ ${price} USDC — Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
        duration: 6000,
      });

      setLimitPrice("");
      setLimitAmount("");
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transaction failed";
      toast.error("Order failed", {
        description: message,
        duration: 8000,
        action: {
          label: "Retry",
          onClick: () => void handlePlaceLimitOrder(),
        },
      });
    } finally {
      setIsPlacingOrder(false);
    }
  }, [
    connected,
    account,
    signAndSubmitTransaction,
    limitPrice,
    limitAmount,
    limitSide,
  ]);

  // CTA button state for Swap tab
  const getSwapCtaState = (): { label: string; disabled: boolean; connectWallet: boolean } => {
    if (!connected) return { label: "Connect Wallet", disabled: false, connectWallet: true };
    if (!inputAmount || parseFloat(inputAmount) <= 0)
      return { label: "Enter an amount", disabled: true, connectWallet: false };
    if (insufficientBalance)
      return { label: "Insufficient balance", disabled: true, connectWallet: false };
    if (!quote) return { label: "Fetching quote...", disabled: true, connectWallet: false };
    if (!quote.sufficientLiquidity)
      return { label: "Insufficient liquidity", disabled: true, connectWallet: false };
    if (isSwapping) return { label: "Swapping...", disabled: true, connectWallet: false };
    return { label: "Swap", disabled: false, connectWallet: false };
  };

  // CTA button state for Limit tab
  const getLimitCtaState = (): { label: string; disabled: boolean; connectWallet: boolean } => {
    if (!connected) return { label: "Connect Wallet", disabled: false, connectWallet: true };
    if (!limitPrice || parseFloat(limitPrice) <= 0)
      return { label: "Enter a price", disabled: true, connectWallet: false };
    if (!limitAmount || parseFloat(limitAmount) <= 0)
      return { label: "Enter an amount", disabled: true, connectWallet: false };
    if (isPlacingOrder) return { label: "Placing order...", disabled: true, connectWallet: false };
    return { label: "Place Order", disabled: false, connectWallet: false };
  };

  const swapCta = getSwapCtaState();
  const limitCta = getLimitCtaState();

  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      {/* Swap / Limit Tabs */}
      <div className="mb-5 flex items-center gap-1 rounded-full bg-background p-1">
        {(["swap", "limit"] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`relative flex-1 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
              activeTab === tab ? "text-white" : "text-text-muted hover:text-text-secondary"
            }`}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="swap-tab-indicator"
                className="absolute inset-0 rounded-full bg-secondary"
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
            <span className="relative z-10 capitalize">{tab}</span>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <AnimatePresence mode="wait">
        {activeTab === "swap" ? (
          <motion.div
            key="swap"
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 10 }}
            transition={{ duration: 0.15 }}
          >
            {/* You Pay */}
            <div className="rounded-xl bg-background border border-border p-4 mb-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted">You pay</span>
                {connected && fromBalance !== null && (
                  <span className="text-xs text-text-muted">
                    Balance:{" "}
                    <span className="font-mono text-text-secondary">
                      {formatBalance(fromBalance, 4)}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={inputAmount}
                  onChange={handleInputChange}
                  className="flex-1 bg-transparent text-2xl font-mono text-white placeholder:text-text-muted outline-none min-w-0"
                />
                <TokenSelectorButton
                  ref={fromTokenBtnRef}
                  symbol={fromToken}
                  onClick={() => setSelectorOpen("from")}
                />
              </div>
              {fromUsdEquivalent !== null && fromUsdEquivalent > 0 && (
                <p className="mt-1 text-xs text-text-muted font-mono">
                  ≈ ${formatBalance(fromUsdEquivalent, 2)}
                </p>
              )}
            </div>

            {/* Direction Toggle */}
            <div className="flex justify-center -my-3 relative z-10">
              <motion.button
                animate={{ rotate: directionRotation }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                onClick={handleDirectionToggle}
                className="rounded-xl border border-border bg-card p-2 text-text-muted hover:text-white hover:border-surface-hover transition-colors"
              >
                <ArrowDownUp className="h-4 w-4" />
              </motion.button>
            </div>

            {/* You Receive */}
            <div className="rounded-xl bg-background border border-border p-4 mt-1">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted">You receive</span>
                {connected && toBalance !== null && (
                  <span className="text-xs text-text-muted">
                    Balance:{" "}
                    <span className="font-mono text-text-secondary">
                      {formatBalance(toBalance, 4)}
                    </span>
                  </span>
                )}
              </div>
              <div className="flex items-center gap-3">
                <AnimatePresence mode="wait">
                  <motion.p
                    key={quote?.outputAmount ?? "empty"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    className="flex-1 text-2xl font-mono text-white min-w-0"
                  >
                    {quote ? formatBalance(quote.outputAmount, 6) : "0"}
                  </motion.p>
                </AnimatePresence>
                <TokenSelectorButton
                  ref={toTokenBtnRef}
                  symbol={toToken}
                  onClick={() => setSelectorOpen("to")}
                />
              </div>
              {toUsdEquivalent !== null && toUsdEquivalent > 0 && (
                <p className="mt-1 text-xs text-text-muted font-mono">
                  ≈ ${formatBalance(toUsdEquivalent, 2)}
                </p>
              )}
            </div>

            {/* CTA Button */}
            <button
              onClick={swapCta.connectWallet ? () => setWalletSelectorOpen(true) : handleSwap}
              disabled={swapCta.disabled}
              className="mt-4 w-full rounded-2xl py-3.5 text-base font-semibold transition-all
                bg-primary text-primary-foreground hover:brightness-110
                disabled:bg-secondary disabled:text-text-muted disabled:cursor-not-allowed"
            >
              {isSwapping ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {swapCta.label}
                </span>
              ) : (
                swapCta.label
              )}
            </button>

            {/* Price Details (expandable) — below CTA */}
            <SwapPriceDetails
              quote={quote}
              direction={direction}
              loading={depthLoading}
            />
          </motion.div>
        ) : (
          <motion.div
            key="limit"
            initial={{ opacity: 0, x: 10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
          >
            {/* Buy/Sell Toggle */}
            <div className="mb-4 flex items-center gap-1 rounded-full bg-background p-1">
              {(["buy", "sell"] as const).map((side) => (
                <button
                  key={side}
                  onClick={() => setLimitSide(side)}
                  className={`relative flex-1 rounded-full px-4 py-1.5 text-sm font-semibold transition-colors ${
                    limitSide === side
                      ? side === "buy"
                        ? "text-primary-foreground"
                        : "text-white"
                      : "text-text-muted hover:text-text-secondary"
                  }`}
                >
                  {limitSide === side && (
                    <motion.div
                      layoutId="limit-side-indicator"
                      className={`absolute inset-0 rounded-full ${
                        side === "buy" ? "bg-cash-green" : "bg-cash-red"
                      }`}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <span className="relative z-10 capitalize">{side}</span>
                </button>
              ))}
            </div>

            {/* Price Input */}
            <div className="rounded-xl bg-background border border-border p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted">Price (USDC)</span>
              </div>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={limitPrice}
                onChange={handleLimitPriceChange}
                className="w-full bg-transparent text-2xl font-mono text-white placeholder:text-text-muted outline-none"
              />
            </div>

            {/* Amount Input */}
            <div className="rounded-xl bg-background border border-border p-4 mb-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs text-text-muted">Amount (CASH)</span>
                {connected && balances && (
                  <span className="text-xs text-text-muted">
                    Balance:{" "}
                    <span className="font-mono text-text-secondary">
                      {limitSide === "sell"
                        ? formatBalance(balances.cash.available, 4)
                        : formatBalance(balances.usdc.available, 4)}
                    </span>
                  </span>
                )}
              </div>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={limitAmount}
                onChange={handleLimitAmountChange}
                className="w-full bg-transparent text-2xl font-mono text-white placeholder:text-text-muted outline-none"
              />
            </div>

            {/* Order Total */}
            {limitPrice && limitAmount && parseFloat(limitPrice) > 0 && parseFloat(limitAmount) > 0 && (
              <div className="rounded-xl bg-background border border-border p-3 mb-3">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-muted">Total</span>
                  <span className="font-mono text-white">
                    {formatBalance(
                      parseFloat(limitPrice) * parseFloat(limitAmount),
                      2,
                    )}{" "}
                    USDC
                  </span>
                </div>
              </div>
            )}

            {/* Place Order CTA */}
            <button
              onClick={limitCta.connectWallet ? () => setWalletSelectorOpen(true) : handlePlaceLimitOrder}
              disabled={limitCta.disabled}
              className={`mt-1 w-full rounded-2xl py-3.5 text-base font-semibold transition-all
                disabled:bg-secondary disabled:text-text-muted disabled:cursor-not-allowed
                ${
                  !limitCta.disabled
                    ? limitCta.connectWallet
                      ? "bg-primary text-primary-foreground hover:brightness-110"
                      : limitSide === "buy"
                        ? "bg-cash-green text-primary-foreground hover:brightness-110"
                        : "bg-cash-red text-white hover:brightness-110"
                    : ""
                }`}
            >
              {isPlacingOrder ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {limitCta.label}
                </span>
              ) : (
                limitCta.label
              )}
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Token Selector Modal */}
      <TokenSelectorModal
        open={selectorOpen !== null}
        onOpenChange={(open) => {
          if (!open) setSelectorOpen(null);
        }}
        onSelect={handleTokenSelect}
        balances={balances}
        selectedSymbol={
          selectorOpen === "from" ? fromToken : selectorOpen === "to" ? toToken : undefined
        }
        triggerRef={selectorOpen === "from" ? fromTokenBtnRef : toTokenBtnRef}
      />

      {/* Wallet Selector Modal — opened by CTA when disconnected */}
      <WalletSelector
        isOpen={walletSelectorOpen}
        onClose={() => setWalletSelectorOpen(false)}
      />
    </div>
  );
}

/**
 * TokenSelectorButton — shows token icon + ticker with a chevron.
 * Clicking opens the token selector modal.
 */
const TokenSelectorButton = forwardRef<
  HTMLButtonElement,
  { symbol: TokenSymbol; onClick: () => void }
>(function TokenSelectorButton({ symbol, onClick }, ref): React.ReactElement {
  const token = TOKENS[symbol];

  if (!token) return <></>;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-secondary px-3 py-1.5 shrink-0 hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
    >
      <div
        className={`h-5 w-5 rounded-full bg-gradient-to-br ${token.gradient} flex items-center justify-center`}
      >
        <span className="text-[10px] font-bold text-white">
          {token.symbol[0]}
        </span>
      </div>
      <span className="text-sm font-medium text-white">{token.symbol}</span>
      <ChevronDown className="h-3 w-3 text-text-muted" />
    </button>
  );
});
