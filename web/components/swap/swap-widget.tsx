"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ArrowDownUp, Loader2 } from "lucide-react";
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
import { PriceQuote } from "@/components/swap/price-quote";
import { SwapButton } from "@/components/swap/swap-button";
import { formatBalance } from "@/lib/utils";

/** CASH/USDC token metadata */
const ASSETS = {
  CASH: { symbol: "CASH", name: "CASH", decimals: 6 },
  USDC: { symbol: "USDC", name: "USDC", decimals: 6 },
} as const;

/**
 * SwapWidget — the main swap interface component.
 *
 * Shows from/to asset display, amount input with max button,
 * direction toggle, price quote, and swap execution button.
 */
export function SwapWidget(): React.ReactElement {
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const { depth, loading: depthLoading } = useDepth(3000);

  const walletAddress = connected && account?.address
    ? account.address.toString()
    : undefined;
  const { balances, updateBalances } = useBalances(walletAddress);

  // Subscribe to WS account channel for real-time balance updates
  useAccountSubscription(walletAddress, updateBalances);

  // Direction: "sell" = CASH → USDC, "buy" = USDC → CASH
  const [direction, setDirection] = useState<SwapDirection>("sell");
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<SwapQuote | null>(null);
  const [isSwapping, setIsSwapping] = useState(false);

  // Debounce timer ref
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const fromAsset = direction === "sell" ? ASSETS.CASH : ASSETS.USDC;
  const toAsset = direction === "sell" ? ASSETS.USDC : ASSETS.CASH;

  // Determine user's available balance for the "from" asset
  const fromBalance = balances
    ? direction === "sell"
      ? balances.cash.available
      : balances.usdc.available
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
  }, []);

  const handleInputChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const value = e.target.value;
      // Allow empty, digits, and one decimal point
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setInputAmount(value);
      }
    },
    [],
  );

  const handleMaxClick = useCallback((): void => {
    if (!connected || fromBalance === null || fromBalance <= 0) {
      toast.info("Max balance not available — connect wallet first");
      return;
    }
    setInputAmount(fromBalance.toString());
  }, [connected, fromBalance]);

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
      // Build market order payload via SDK helper
      const payload = buildPlaceOrderPayload({
        pairId: 0,
        price: 0, // ignored for Market orders
        quantity: amount,
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

      // Reset form
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

  return (
    <div className="w-full max-w-md mx-auto">
      <div className="rounded-2xl border border-[#2A2A2A] bg-[#1A1A1A] p-5 shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-white">Swap</h2>
          <span className="font-mono text-xs text-[#666666]">
            CASH / USDC
          </span>
        </div>

        {/* From Input */}
        <div className="rounded-xl bg-[#212121] border border-[#2A2A2A] p-4 mb-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#888888]">From</span>
            <button
              onClick={handleMaxClick}
              className="text-xs text-emerald-500 hover:text-emerald-400 transition-colors font-medium"
            >
              MAX
            </button>
          </div>
          <div className="flex items-center gap-3">
            <input
              type="text"
              inputMode="decimal"
              placeholder="0.00"
              value={inputAmount}
              onChange={handleInputChange}
              className="flex-1 bg-transparent text-2xl font-mono text-white placeholder:text-[#555555] outline-none"
            />
            <div className="flex items-center gap-2 rounded-lg bg-[#2A2A2A] px-3 py-2 shrink-0">
              <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 flex items-center justify-center">
                <span className="text-[10px] font-bold text-white">
                  {fromAsset.symbol[0]}
                </span>
              </div>
              <span className="font-medium text-sm text-white">
                {fromAsset.symbol}
              </span>
            </div>
          </div>
        </div>

        {/* Direction Toggle */}
        <div className="flex justify-center -my-3 relative z-10">
          <motion.button
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9, rotate: 180 }}
            onClick={handleDirectionToggle}
            className="rounded-xl border border-[#2A2A2A] bg-[#1A1A1A] p-2 text-[#888888] hover:text-white hover:border-[#555555] transition-colors"
          >
            <ArrowDownUp className="h-4 w-4" />
          </motion.button>
        </div>

        {/* To Output */}
        <div className="rounded-xl bg-[#212121] border border-[#2A2A2A] p-4 mt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-[#888888]">To (estimated)</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <AnimatePresence mode="wait">
                <motion.p
                  key={quote?.outputAmount ?? "empty"}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="text-2xl font-mono text-white"
                >
                  {quote
                    ? formatBalance(quote.outputAmount, 6)
                    : "0.00"}
                </motion.p>
              </AnimatePresence>
            </div>
            <div className="flex items-center gap-2 rounded-lg bg-[#2A2A2A] px-3 py-2 shrink-0">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center ${
                  toAsset.symbol === "USDC"
                    ? "bg-gradient-to-br from-blue-400 to-blue-600"
                    : "bg-gradient-to-br from-emerald-400 to-emerald-600"
                }`}
              >
                <span className="text-[10px] font-bold text-white">
                  {toAsset.symbol[0]}
                </span>
              </div>
              <span className="font-medium text-sm text-white">
                {toAsset.symbol}
              </span>
            </div>
          </div>
        </div>

        {/* Price Quote Details */}
        <PriceQuote
          quote={quote}
          direction={direction}
          loading={depthLoading}
        />

        {/* Swap Button */}
        <SwapButton
          connected={connected}
          hasQuote={quote !== null}
          hasInput={inputAmount !== "" && parseFloat(inputAmount) > 0}
          sufficientLiquidity={quote?.sufficientLiquidity ?? true}
          insufficientBalance={!!insufficientBalance}
          isSwapping={isSwapping}
          onSwap={handleSwap}
        />
      </div>
    </div>
  );
}
