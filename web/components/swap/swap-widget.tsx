"use client";

import { useState, useCallback, useEffect, useRef, forwardRef } from "react";
import { Text, styled, useTheme } from "@tamagui/core";
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
import { Flex } from "@/components/ui/Flex";

// ---------------------------------------------------------------------------
// Styled Tamagui Components — Matching Uniswap SwapSkeleton / styled.tsx
// ---------------------------------------------------------------------------

/**
 * SwapContainer — outer wrapper matching Uniswap's LoadingWrapper.
 * surface1 bg, 1px surface3 border, rounded16, 8px padding.
 */
const SwapContainer = styled(Flex, {
  backgroundColor: "$surface1",
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "$surface3",
  borderRadius: "$rounded16",
  padding: "$spacing8",
});

/**
 * SwapSection — input sections matching Uniswap's SwapSection from styled.tsx.
 * surface2 bg, 120px height, rounded16, 16px padding, invisible border that
 * changes to surface2Hovered on hover and surface3 on focus-within.
 */
const SwapSection = styled(Flex, {
  backgroundColor: "$surface2",
  borderRadius: "$rounded16",
  minHeight: 120,
  padding: "$spacing16",
  position: "relative",
  borderStyle: "solid",
  borderWidth: 1,
  borderColor: "$surface2",

  hoverStyle: {
    borderColor: "$surface2Hovered",
  },

  focusWithinStyle: {
    borderColor: "$surface3",
  },
});

/**
 * ArrowWrapper — matching Uniswap's ArrowWrapper from styled.tsx.
 * 40x40, rounded12, surface2 bg, 4px surface1 border, -18px vertical overlap.
 */
const ArrowWrapper = styled(Flex, {
  display: "flex",
  borderRadius: "$rounded12",
  height: 40,
  width: 40,
  position: "relative",
  marginTop: -18,
  marginBottom: -18,
  marginLeft: "auto",
  marginRight: "auto",
  backgroundColor: "$surface2",
  borderWidth: 4,
  borderStyle: "solid",
  borderColor: "$surface1",
  zIndex: 2,
  alignItems: "center",
  justifyContent: "center",
  cursor: "pointer",

  hoverStyle: {
    opacity: 0.8,
  },
});

/**
 * ArrowContainer — inner flex centering for the arrow icon.
 */
const ArrowContainer = styled(Flex, {
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  width: "100%",
  height: "100%",
});

/**
 * SwapCTAButton — primary action button matching Uniswap's swap CTA.
 * accent1 bg (#00D54B), rounded20, 56px min-height, buttonLabel2 (17px).
 */
const SwapCTAButton = styled(Flex, {
  tag: "button",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "$accent1",
  borderRadius: "$rounded20",
  minHeight: 56,
  width: "100%",
  cursor: "pointer",
  marginTop: "$spacing16",

  hoverStyle: {
    opacity: 0.9,
  },

  variants: {
    disabled: {
      true: {
        backgroundColor: "$surface3Solid",
        cursor: "not-allowed",
        hoverStyle: {
          opacity: 1,
        },
      },
    },
  } as const,
});

/**
 * TokenPill — token selector pill matching Uniswap's SelectTokenButton.
 * roundedFull border radius, surface1 bg, row layout with icon + name + chevron.
 */
const TokenPill = styled(Flex, {
  tag: "button",
  flexDirection: "row",
  alignItems: "center",
  gap: "$spacing6",
  backgroundColor: "$surface1",
  borderRadius: "$roundedFull",
  paddingHorizontal: "$spacing8",
  paddingVertical: "$spacing4",
  cursor: "pointer",
  flexShrink: 0,

  hoverStyle: {
    backgroundColor: "$surface1Hovered",
  },
});

/**
 * SegmentedTabBar — container for Swap/Limit tabs.
 */
const SegmentedTabBar = styled(Flex, {
  flexDirection: "row",
  alignItems: "center",
  marginBottom: "$spacing12",
});

/**
 * SegmentedTab — individual tab button.
 */
const SegmentedTab = styled(Flex, {
  tag: "button",
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  paddingVertical: "$spacing8",
  cursor: "pointer",
  position: "relative",

  variants: {
    isActive: {
      true: {},
      false: {},
    },
  } as const,
});

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// SwapWidget
// ---------------------------------------------------------------------------

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
  const theme = useTheme();
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
    <SwapContainer data-testid="swap-widget">
      {/* Swap / Limit SegmentedControl Tabs */}
      <SegmentedTabBar data-testid="swap-tabs">
        {(["swap", "limit"] as const).map((tab) => (
          <SegmentedTab
            key={tab}
            isActive={activeTab === tab}
            onPress={() => setActiveTab(tab)}
            data-testid={`swap-tab-${tab}`}
          >
            {activeTab === tab && (
              <motion.div
                layoutId="swap-tab-indicator"
                style={{
                  position: "absolute",
                  inset: 0,
                  borderRadius: 8,
                  backgroundColor: "rgba(255,255,255,0.08)",
                }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                }}
              />
            )}
            <Text
              fontFamily="$body"
              fontSize={17}
              lineHeight={22.1}
              fontWeight="535"
              color={activeTab === tab ? "$neutral1" : "$neutral2"}
              position="relative"
              zIndex={1}
              textTransform="capitalize"
            >
              {tab}
            </Text>
          </SegmentedTab>
        ))}
      </SegmentedTabBar>

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
            <SwapSection data-testid="swap-input-pay">
              <Flex row alignItems="center" justifyContent="space-between" marginBottom="$spacing8">
                <Text
                  fontFamily="$body"
                  fontSize={13}
                  lineHeight={16}
                  color="$neutral3"
                >
                  You pay
                </Text>
                {connected && fromBalance !== null && (
                  <Text
                    fontFamily="$body"
                    fontSize={13}
                    lineHeight={16}
                    color="$neutral3"
                  >
                    Balance:{" "}
                    <Text
                      fontFamily="$body"
                      fontSize={13}
                      lineHeight={16}
                      color="$neutral2"
                    >
                      {formatBalance(fromBalance, 4)}
                    </Text>
                  </Text>
                )}
              </Flex>
              <Flex row alignItems="center" gap="$spacing12">
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0"
                  value={inputAmount}
                  onChange={handleInputChange}
                  style={{
                    flex: 1,
                    background: "transparent",
                    fontSize: 28,
                    fontFamily: "var(--font-geist-sans), sans-serif",
                    color: theme.neutral1?.val as string,
                    border: "none",
                    outline: "none",
                    minWidth: 0,
                    padding: 0,
                  }}
                  className="placeholder:text-[rgba(255,255,255,0.38)]"
                />
                <TokenSelectorButton
                  ref={fromTokenBtnRef}
                  symbol={fromToken.symbol}
                  onClick={() => setSelectorOpen("from")}
                />
              </Flex>
              {fromUsdEquivalent !== null && fromUsdEquivalent > 0 && (
                <Text
                  fontFamily="$body"
                  fontSize={13}
                  lineHeight={16}
                  color="$neutral3"
                  marginTop="$spacing4"
                >
                  ≈ ${formatBalance(fromUsdEquivalent, 2)}
                </Text>
              )}
            </SwapSection>

            {/* Direction Toggle — Arrow */}
            <Flex alignItems="center" justifyContent="center" zIndex={2}>
              <motion.div
                animate={{ rotate: directionRotation }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                style={{ display: "flex" }}
              >
                <ArrowWrapper
                  onPress={handleDirectionToggle}
                  data-testid="swap-arrow"
                >
                  <ArrowContainer>
                    <ArrowDownUp size={16} color={theme.neutral2?.val as string} />
                  </ArrowContainer>
                </ArrowWrapper>
              </motion.div>
            </Flex>

            {/* You Receive */}
            <SwapSection data-testid="swap-input-receive">
              <Flex row alignItems="center" justifyContent="space-between" marginBottom="$spacing8">
                <Text
                  fontFamily="$body"
                  fontSize={13}
                  lineHeight={16}
                  color="$neutral3"
                >
                  You receive
                </Text>
                {connected && toBalance !== null && (
                  <Text
                    fontFamily="$body"
                    fontSize={13}
                    lineHeight={16}
                    color="$neutral3"
                  >
                    Balance:{" "}
                    <Text
                      fontFamily="$body"
                      fontSize={13}
                      lineHeight={16}
                      color="$neutral2"
                    >
                      {formatBalance(toBalance, 4)}
                    </Text>
                  </Text>
                )}
              </Flex>
              <Flex row alignItems="center" gap="$spacing12">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={quote?.outputAmount ?? "empty"}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15 }}
                    style={{ flex: 1, minWidth: 0 }}
                  >
                    <Text
                      fontFamily="$body"
                      fontSize={28}
                      color="$neutral1"
                    >
                      {activeOutputAmount !== null
                        ? formatBalance(activeOutputAmount, 6)
                        : "0"}
                    </Text>
                  </motion.div>
                </AnimatePresence>
                <TokenSelectorButton
                  ref={toTokenBtnRef}
                  symbol={toToken.symbol}
                  onClick={() => setSelectorOpen("to")}
                />
              </Flex>
              {toUsdEquivalent !== null && toUsdEquivalent > 0 && (
                <Text
                  fontFamily="$body"
                  fontSize={13}
                  lineHeight={16}
                  color="$neutral3"
                  marginTop="$spacing4"
                >
                  ≈ ${formatBalance(toUsdEquivalent, 2)}
                </Text>
              )}
            </SwapSection>

            {/* Panora route error banner */}
            {usePanora && panoraError && (
              <Flex
                marginTop="$spacing12"
                borderRadius="$rounded12"
                padding="$spacing12"
                backgroundColor="$statusCritical2"
                borderWidth={1}
                borderStyle="solid"
                borderColor="$statusCritical2Hovered"
              >
                <Text fontFamily="$body" fontSize={13} lineHeight={16} color="$statusCritical">
                  ⚠ {panoraError}
                </Text>
              </Flex>
            )}

            {/* CTA Button */}
            <SwapCTAButton
              disabled={swapCta.disabled}
              onPress={swapCta.connectWallet ? () => setWalletSelectorOpen(true) : handleSwap}
              data-testid="swap-cta"
            >
              {isSwapping && (
                <Loader2
                  size={16}
                  style={{
                    animation: "spin 1s linear infinite",
                    marginRight: 8,
                  }}
                  color={theme.neutral3?.val as string}
                />
              )}
              <Text
                fontFamily="$button"
                fontSize={17}
                lineHeight={19.55}
                fontWeight="535"
                color={swapCta.disabled ? "$neutral3" : "$neutral1"}
              >
                {swapCta.label}
              </Text>
            </SwapCTAButton>

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
            <Flex row alignItems="center" gap="$spacing4" marginBottom="$spacing16">
              {(["buy", "sell"] as const).map((side) => (
                <Flex
                  key={side}
                  tag="button"
                  flex={1}
                  alignItems="center"
                  justifyContent="center"
                  borderRadius="$roundedFull"
                  paddingVertical="$spacing8"
                  minHeight={44}
                  cursor="pointer"
                  position="relative"
                  onPress={() => setLimitSide(side)}
                >
                  {limitSide === side && (
                    <motion.div
                      layoutId="limit-side-indicator"
                      style={{
                        position: "absolute",
                        inset: 0,
                        borderRadius: 999999,
                        backgroundColor:
                          side === "buy"
                            ? (theme.statusSuccess?.val as string)
                            : (theme.statusCritical?.val as string),
                      }}
                      transition={{
                        type: "spring",
                        stiffness: 400,
                        damping: 30,
                      }}
                    />
                  )}
                  <Text
                    fontFamily="$button"
                    fontSize={15}
                    lineHeight={17.25}
                    fontWeight="535"
                    color={
                      limitSide === side
                        ? "$neutral1"
                        : "$neutral2"
                    }
                    position="relative"
                    zIndex={1}
                    textTransform="capitalize"
                  >
                    {side}
                  </Text>
                </Flex>
              ))}
            </Flex>

            {/* Price Input */}
            <SwapSection marginBottom="$spacing12">
              <Flex row alignItems="center" justifyContent="space-between" marginBottom="$spacing8">
                <Text fontFamily="$body" fontSize={13} lineHeight={16} color="$neutral3">
                  Price (USD1)
                </Text>
              </Flex>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={limitPrice}
                onChange={handleLimitPriceChange}
                style={{
                  width: "100%",
                  background: "transparent",
                  fontSize: 28,
                  fontFamily: "var(--font-geist-sans), sans-serif",
                  color: theme.neutral1?.val as string,
                  border: "none",
                  outline: "none",
                  padding: 0,
                }}
                className="placeholder:text-[rgba(255,255,255,0.38)]"
              />
            </SwapSection>

            {/* Amount Input */}
            <SwapSection marginBottom="$spacing12">
              <Flex row alignItems="center" justifyContent="space-between" marginBottom="$spacing8">
                <Text fontFamily="$body" fontSize={13} lineHeight={16} color="$neutral3">
                  Amount (CASH)
                </Text>
                {connected && balances && (
                  <Text fontFamily="$body" fontSize={13} lineHeight={16} color="$neutral3">
                    Balance:{" "}
                    <Text fontFamily="$body" fontSize={13} lineHeight={16} color="$neutral2">
                      {limitSide === "sell"
                        ? formatBalance(balances.cash.available, 4)
                        : formatBalance(balances.usdc.available, 4)}
                    </Text>
                  </Text>
                )}
              </Flex>
              <input
                type="text"
                inputMode="decimal"
                placeholder="0.00"
                value={limitAmount}
                onChange={handleLimitAmountChange}
                style={{
                  width: "100%",
                  background: "transparent",
                  fontSize: 28,
                  fontFamily: "var(--font-geist-sans), sans-serif",
                  color: theme.neutral1?.val as string,
                  border: "none",
                  outline: "none",
                  padding: 0,
                }}
                className="placeholder:text-[rgba(255,255,255,0.38)]"
              />
            </SwapSection>

            {/* Order Total */}
            {limitPrice && limitAmount && parseFloat(limitPrice) > 0 && parseFloat(limitAmount) > 0 && (
              <Flex
                backgroundColor="$surface2"
                borderRadius="$rounded16"
                borderWidth={1}
                borderStyle="solid"
                borderColor="$surface2"
                padding="$spacing12"
                marginBottom="$spacing12"
              >
                <Flex row alignItems="center" justifyContent="space-between">
                  <Text fontFamily="$body" fontSize={15} lineHeight={19.5} color="$neutral3">
                    Total
                  </Text>
                  <Text fontFamily="$body" fontSize={15} lineHeight={19.5} color="$neutral1">
                    {formatBalance(
                      parseFloat(limitPrice) * parseFloat(limitAmount),
                      2,
                    )}{" "}
                    USD1
                  </Text>
                </Flex>
              </Flex>
            )}

            {/* Place Order CTA */}
            <SwapCTAButton
              disabled={limitCta.disabled}
              onPress={limitCta.connectWallet ? () => setWalletSelectorOpen(true) : handlePlaceLimitOrder}
              {...(!limitCta.disabled && !limitCta.connectWallet
                ? {
                    backgroundColor:
                      limitSide === "buy"
                        ? "$statusSuccess"
                        : "$statusCritical",
                  }
                : {})}
              data-testid="limit-cta"
            >
              {isPlacingOrder && (
                <Loader2
                  size={16}
                  style={{
                    animation: "spin 1s linear infinite",
                    marginRight: 8,
                  }}
                  color={theme.neutral3?.val as string}
                />
              )}
              <Text
                fontFamily="$button"
                fontSize={17}
                lineHeight={19.55}
                fontWeight="535"
                color={limitCta.disabled ? "$neutral3" : "$neutral1"}
              >
                {limitCta.label}
              </Text>
            </SwapCTAButton>
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
    </SwapContainer>
  );
}

// ---------------------------------------------------------------------------
// TokenSelectorButton — Tamagui pill matching Uniswap's SelectTokenButton
// ---------------------------------------------------------------------------

/**
 * TokenSelectorButton — shows token icon + ticker with a chevron.
 * Uses roundedFull border radius matching Uniswap's SelectTokenButton pattern.
 * Clicking opens the token selector modal.
 */
const TokenSelectorButton = forwardRef<
  HTMLButtonElement,
  { symbol: string; onClick: () => void }
>(function TokenSelectorButton({ symbol, onClick }, ref): React.ReactElement {
  const theme = useTheme();
  const token = TOKENS[symbol];

  if (!token) return <></>;

  return (
    <TokenPill
      ref={ref as React.Ref<HTMLElement>}
      onPress={onClick}
      data-testid={`token-selector-${symbol}`}
    >
      {/* Token Icon — 28px circle */}
      <Flex
        width={28}
        height={28}
        borderRadius="$roundedFull"
        alignItems="center"
        justifyContent="center"
        style={{
          backgroundImage: `linear-gradient(to bottom right, ${getGradientColors(token.gradient)})`,
        }}
      >
        <Text
          fontFamily="$button"
          fontSize={10}
          fontWeight="535"
          color="$neutral1"
        >
          {token.symbol[0]}
        </Text>
      </Flex>

      {/* Token Name — buttonLabel2 (17px) */}
      <Text
        fontFamily="$button"
        fontSize={17}
        lineHeight={19.55}
        fontWeight="535"
        color="$neutral1"
      >
        {token.symbol}
      </Text>

      {/* Chevron — 20px, neutral2 */}
      <ChevronDown size={20} color={theme.neutral2?.val as string} />
    </TokenPill>
  );
});

/**
 * Parse Tailwind gradient classes to CSS gradient colors.
 * e.g. "from-green-400 to-emerald-600" → "#4ade80, #059669"
 */
function getGradientColors(gradient: string): string {
  const colorMap: Record<string, string> = {
    "green-400": "#4ade80",
    "emerald-600": "#059669",
    "blue-400": "#60a5fa",
    "blue-600": "#2563eb",
    "purple-400": "#c084fc",
    "purple-600": "#9333ea",
    "orange-400": "#fb923c",
    "orange-600": "#ea580c",
    "pink-400": "#f472b6",
    "pink-600": "#db2777",
    "yellow-400": "#facc15",
    "yellow-600": "#ca8a04",
    "cyan-400": "#22d3ee",
    "cyan-600": "#0891b2",
    "red-400": "#f87171",
    "red-600": "#dc2626",
    "teal-400": "#2dd4bf",
    "teal-600": "#0d9488",
    "indigo-400": "#818cf8",
    "indigo-600": "#4f46e5",
    "gray-400": "#9ca3af",
    "gray-600": "#4b5563",
  };

  const fromMatch = gradient.match(/from-([a-z]+-\d+)/);
  const toMatch = gradient.match(/to-([a-z]+-\d+)/);

  const from = fromMatch ? colorMap[fromMatch[1]] ?? "#888" : "#888";
  const to = toMatch ? colorMap[toMatch[1]] ?? "#666" : "#666";

  return `${from}, ${to}`;
}
