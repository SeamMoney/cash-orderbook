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
import {
  getPanoraQuote,
  getPanoraSwapPayload,
  PanoraError,
  type PanoraQuote,
} from "@/lib/panora";
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

/** Token metadata — lookup map */
const TOKENS: Record<string, TokenInfo> = Object.fromEntries(
  SUPPORTED_TOKENS.map((t) => [t.symbol, t]),
);

/** Default tokens */
const DEFAULT_FROM_TOKEN = TOKENS["USD1"] ?? SUPPORTED_TOKENS[1];
const DEFAULT_TO_TOKEN = TOKENS["CASH"] ?? SUPPORTED_TOKENS[0];

/**
 * Determine if a swap pair should be routed through Panora rather than the
 * native CASH/USD1 orderbook. Only CASH↔USD1 uses the orderbook; all other
 * combinations (e.g. USDT→CASH, CASH→USDC) go through Panora.
 */
function isPanoraPair(from: TokenInfo, to: TokenInfo): boolean {
  const isCashUsd1 =
    (from.symbol === "CASH" && to.symbol === "USD1") ||
    (from.symbol === "USD1" && to.symbol === "CASH");
  return !isCashUsd1;
}

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
  const [fromToken, setFromToken] = useState<TokenInfo>(DEFAULT_FROM_TOKEN);
  const [toToken, setToToken] = useState<TokenInfo>(DEFAULT_TO_TOKEN);
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [panoraQuote, setPanoraQuote] = useState<PanoraQuote | null>(null);
  const [panoraError, setPanoraError] = useState<string | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);
  const [directionRotation, setDirectionRotation] = useState(0);

  // Derived direction for orderbook swap-quote compatibility
  const direction: SwapDirection = toToken.symbol === "CASH" ? "buy" : "sell";

  // Whether this pair should be routed through Panora
  const usePanora = isPanoraPair(fromToken, toToken);

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

  /** Resolve a token symbol to the user's available balance, or null */
  const getTokenBalance = useCallback(
    (symbol: string): number | null => {
      if (!balances) return null;
      if (symbol === "CASH") return balances.cash.available;
      if (symbol === "USDC") return balances.usdc.available;
      return null;
    },
    [balances],
  );

  const fromBalance = getTokenBalance(fromToken.symbol);
  const toBalance = getTokenBalance(toToken.symbol);

  // Check if the input amount exceeds the user's available balance
  const inputNum = parseFloat(inputAmount);
  const insufficientBalance =
    connected &&
    fromBalance !== null &&
    !isNaN(inputNum) &&
    inputNum > 0 &&
    inputNum > fromBalance;

  // Calculate quote with debounce — branches between orderbook and Panora
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const amount = parseFloat(inputAmount);
    if (isNaN(amount) || amount <= 0) {
      setQuote(null);
      setPanoraQuote(null);
      setPanoraError(null);
      return;
    }

    // Orderbook path: CASH/USD1 only
    if (!usePanora) {
      setPanoraQuote(null);
      setPanoraError(null);

      if (!depth) {
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
    }

    // Panora path: non-USD1 pairs
    setQuote(null);
    let cancelled = false;

    debounceRef.current = setTimeout(() => {
      setPanoraError(null);
      getPanoraQuote(fromToken.symbol, toToken.symbol, amount, 0.5)
        .then((result) => {
          if (!cancelled) {
            setPanoraQuote(result);
          }
        })
        .catch((err) => {
          if (!cancelled) {
            setPanoraQuote(null);
            setPanoraError(
              err instanceof PanoraError
                ? err.message
                : "Route unavailable",
            );
          }
        });
    }, 500);

    return () => {
      cancelled = true;
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [inputAmount, direction, depth, usePanora, fromToken.symbol, toToken.symbol]);

  const handleDirectionToggle = useCallback((): void => {
    setFromToken((prev) => {
      const next = toToken;
      setToToken(prev);
      return next;
    });
    setInputAmount("");
    setQuote(null);
    setPanoraQuote(null);
    setPanoraError(null);
    setDirectionRotation((prev) => prev + 180);
  }, [toToken]);

  /** Handle token selection from the modal */
  const handleTokenSelect = useCallback(
    (token: TokenInfo): void => {
      if (selectorOpen === "from") {
        // If user selects the same token that's currently on "to", swap sides
        if (token.symbol === toToken.symbol) {
          setToToken(fromToken);
        }
        setFromToken(token);
      } else if (selectorOpen === "to") {
        // If user selects the same token that's currently on "from", swap sides
        if (token.symbol === fromToken.symbol) {
          setFromToken(toToken);
        }
        setToToken(token);
      }
      setInputAmount("");
      setQuote(null);
      setPanoraQuote(null);
      setPanoraError(null);
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

  // Active quote — either orderbook or Panora (for display output)
  const activeOutputAmount = usePanora
    ? panoraQuote?.outputAmount ?? null
    : quote?.outputAmount ?? null;

  // Compute USD equivalent for the "from" input
  const fromUsdEquivalent =
    (quote || panoraQuote) && inputNum > 0
      ? direction === "sell"
        ? activeOutputAmount
        : inputNum
      : null;

  // Compute USD equivalent for the "to" output
  // For Panora swaps: prefer toTokenAmountUSD from the API (real USD price),
  // otherwise fall back to the raw output amount.
  const toUsdEquivalent = usePanora
    ? panoraQuote
      ? panoraQuote.toTokenAmountUSD ?? panoraQuote.outputAmount
      : null
    : quote
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

    if (!usePanora && !quote) {
      toast.error("No price quote available");
      return;
    }
    if (usePanora && !panoraQuote) {
      toast.error("No price quote available");
      return;
    }

    setIsSwapping(true);

    try {
      if (usePanora) {
        // Panora-routed swap: fetch transaction payload with real sender
        const txData = await getPanoraSwapPayload(
          fromToken.symbol,
          toToken.symbol,
          amount,
          0.5,
          account.address.toString(),
        );

        const response = await signAndSubmitTransaction({
          data: txData as Parameters<typeof signAndSubmitTransaction>[0]["data"],
        });

        const txHash =
          typeof response === "object" && response !== null && "hash" in response
            ? (response as { hash: string }).hash
            : String(response);

        toast.success("Swap successful", {
          description: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
          duration: 6000,
        });
      } else {
        // Direct orderbook swap: CASH/USD1 only
        const baseQuantity = direction === "buy" ? quote!.outputAmount : amount;

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
      }

      setInputAmount("");
      setQuote(null);
      setPanoraQuote(null);
      setPanoraError(null);
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
    panoraQuote,
    direction,
    usePanora,
    fromToken.symbol,
    toToken.symbol,
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
        description: `${limitSide === "buy" ? "Buy" : "Sell"} ${amount} CASH @ ${price} USD1 — Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
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

    if (usePanora) {
      // Panora route
      if (panoraError) return { label: "Route unavailable", disabled: true, connectWallet: false };
      if (!panoraQuote) return { label: "Fetching quote...", disabled: true, connectWallet: false };
    } else {
      // Orderbook route
      if (!quote) return { label: "Fetching quote...", disabled: true, connectWallet: false };
      if (!quote.sufficientLiquidity)
        return { label: "Insufficient liquidity", disabled: true, connectWallet: false };
    }

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
            className={`relative flex-1 rounded-full px-4 py-2 min-h-[44px] text-sm font-medium transition-colors ${
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
                  symbol={fromToken.symbol}
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
                    {activeOutputAmount !== null
                      ? formatBalance(activeOutputAmount, 6)
                      : "0"}
                  </motion.p>
                </AnimatePresence>
                <TokenSelectorButton
                  ref={toTokenBtnRef}
                  symbol={toToken.symbol}
                  onClick={() => setSelectorOpen("to")}
                />
              </div>
              {toUsdEquivalent !== null && toUsdEquivalent > 0 && (
                <p className="mt-1 text-xs text-text-muted font-mono">
                  ≈ ${formatBalance(toUsdEquivalent, 2)}
                </p>
              )}
            </div>

            {/* Panora route error banner */}
            {usePanora && panoraError && (
              <div className="mt-3 rounded-xl bg-cash-red/10 border border-cash-red/20 px-3 py-2.5">
                <p className="text-xs text-cash-red">
                  ⚠ {panoraError}
                </p>
              </div>
            )}

            {/* CTA Button */}
            <button
              onClick={swapCta.connectWallet ? () => setWalletSelectorOpen(true) : handleSwap}
              disabled={swapCta.disabled}
              className="mt-4 w-full rounded-2xl py-3.5 min-h-[44px] text-base font-semibold transition-all
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
              baseSymbol={direction === "sell" ? fromToken.symbol : toToken.symbol}
              quoteSymbol={direction === "sell" ? toToken.symbol : fromToken.symbol}
              panoraQuote={panoraQuote}
              panoraError={panoraError}
              usePanora={usePanora}
              fromSymbol={fromToken.symbol}
              toSymbol={toToken.symbol}
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
                  className={`relative flex-1 rounded-full px-4 py-2 min-h-[44px] text-sm font-semibold transition-colors ${
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
                <span className="text-xs text-text-muted">Price (USD1)</span>
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
                    USD1
                  </span>
                </div>
              </div>
            )}

            {/* Place Order CTA */}
            <button
              onClick={limitCta.connectWallet ? () => setWalletSelectorOpen(true) : handlePlaceLimitOrder}
              disabled={limitCta.disabled}
              className={`mt-1 w-full rounded-2xl py-3.5 min-h-[44px] text-base font-semibold transition-all
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
          selectorOpen === "from" ? fromToken.symbol : selectorOpen === "to" ? toToken.symbol : undefined
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
  { symbol: string; onClick: () => void }
>(function TokenSelectorButton({ symbol, onClick }, ref): React.ReactElement {
  const token = TOKENS[symbol];

  if (!token) return <></>;

  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 rounded-full bg-secondary px-3 py-2 min-h-[44px] shrink-0 hover:bg-surface-hover transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card"
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
