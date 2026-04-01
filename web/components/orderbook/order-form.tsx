"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { buildPlaceOrderPayload } from "@/lib/sdk";

type OrderSide = "buy" | "sell";
type OrderType = "market" | "limit";

interface OrderFormProps {
  /** Pre-filled price from clicking an orderbook row */
  prefillPrice: number | null;
  onOrderPlaced?: () => void;
}

/**
 * OrderForm — Buy/Sell toggle with animated indicator (emerald for buy, rose for sell).
 * Order type selector (Market/Limit). Price input (for limit), amount input.
 * Submit button. Uses SDK to place orders.
 */
export function OrderForm({
  prefillPrice,
  onOrderPlaced,
}: OrderFormProps): React.ReactElement {
  const { connected, account, signAndSubmitTransaction } = useWallet();

  const [side, setSide] = useState<OrderSide>("buy");
  const [orderType, setOrderType] = useState<OrderType>("limit");
  const [price, setPrice] = useState("");
  const [amount, setAmount] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const prevPrefillRef = useRef<number | null>(null);

  // Apply prefill price when it changes (via effect to avoid set-state-during-render)
  useEffect(() => {
    if (prefillPrice !== null && prefillPrice !== prevPrefillRef.current) {
      prevPrefillRef.current = prefillPrice;
      setPrice(prefillPrice.toFixed(6));
      setOrderType("limit");
    }
  }, [prefillPrice]);

  const handlePriceChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const value = e.target.value;
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setPrice(value);
      }
    },
    [],
  );

  const handleAmountChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>): void => {
      const value = e.target.value;
      if (value === "" || /^\d*\.?\d*$/.test(value)) {
        setAmount(value);
      }
    },
    [],
  );

  const estimatedTotal =
    orderType === "limit" && price && amount
      ? (parseFloat(price) * parseFloat(amount)).toFixed(6)
      : null;

  const handleSubmit = useCallback(async (): Promise<void> => {
    if (!connected || !account || !signAndSubmitTransaction) {
      toast.error("Please connect your wallet first");
      return;
    }

    const amountNum = parseFloat(amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (orderType === "limit") {
      const priceNum = parseFloat(price);
      if (isNaN(priceNum) || priceNum <= 0) {
        toast.error("Please enter a valid price");
        return;
      }
    }

    setIsSubmitting(true);

    try {
      // Build order payload via SDK helper
      const sdkOrderType = orderType === "market" ? "Market" : "GTC";
      const priceNum = orderType === "limit" ? parseFloat(price) : 0;

      const payload = buildPlaceOrderPayload({
        pairId: 0,
        price: priceNum,
        quantity: amountNum,
        side,
        orderType: sdkOrderType,
      });

      const response = await signAndSubmitTransaction({
        data: payload,
      });

      const txHash =
        typeof response === "object" &&
        response !== null &&
        "hash" in response
          ? (response as { hash: string }).hash
          : String(response);

      if (orderType === "market") {
        toast.success(`Market ${side} order placed`, {
          description: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
          duration: 6000,
        });
      } else {
        toast.success(`Limit ${side} order placed`, {
          description: `${amount} CASH @ ${price} — Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
          duration: 6000,
        });
      }

      setAmount("");
      if (orderType === "market") setPrice("");
      onOrderPlaced?.();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Transaction failed";
      toast.error("Order failed", {
        description: message,
        duration: 8000,
        action: {
          label: "Retry",
          onClick: () => void handleSubmit(),
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  }, [
    connected,
    account,
    signAndSubmitTransaction,
    side,
    orderType,
    price,
    amount,
    onOrderPlaced,
  ]);

  const submitLabel = isSubmitting
    ? "Submitting..."
    : !connected
      ? "Connect Wallet"
      : !amount
        ? "Enter Amount"
        : orderType === "limit" && !price
          ? "Enter Price"
          : `${side === "buy" ? "Buy" : "Sell"} CASH`;

  const isDisabled =
    !connected ||
    isSubmitting ||
    !amount ||
    parseFloat(amount) <= 0 ||
    (orderType === "limit" && (!price || parseFloat(price) <= 0));

  return (
    <div className="flex flex-col gap-3">
      {/* Buy/Sell Toggle */}
      <div className="relative flex rounded-lg bg-[#212121] p-1">
        <motion.div
          className="absolute inset-y-1 w-[calc(50%-4px)] rounded-md"
          animate={{
            x: side === "buy" ? 4 : "calc(100% + 4px)",
            backgroundColor: side === "buy" ? "#10b981" : "#f43f5e",
          }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
        {(["buy", "sell"] as const).map((s) => (
          <button
            key={s}
            onClick={() => setSide(s)}
            className={`relative z-10 flex-1 py-2 text-sm font-semibold transition-colors ${
              side === s ? "text-white" : "text-[#666666]"
            }`}
          >
            {s === "buy" ? "Buy" : "Sell"}
          </button>
        ))}
      </div>

      {/* Order Type Selector */}
      <div className="flex gap-1 rounded-lg bg-[#212121] p-1">
        {(["limit", "market"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setOrderType(t)}
            className={`flex-1 rounded-md py-1.5 text-xs font-medium transition-colors ${
              orderType === t
                ? "bg-[#2A2A2A] text-white"
                : "text-[#666666] hover:text-white/65"
            }`}
          >
            {t === "limit" ? "Limit" : "Market"}
          </button>
        ))}
      </div>

      {/* Price Input (limit only) */}
      {orderType === "limit" && (
        <div className="rounded-lg bg-[#212121] border border-[#2A2A2A] p-3">
          <label className="text-[10px] text-[#666666] uppercase tracking-wider">
            Price (USDC)
          </label>
          <input
            type="text"
            inputMode="decimal"
            placeholder="0.000000"
            value={price}
            onChange={handlePriceChange}
            className="mt-1 w-full bg-transparent text-lg font-mono text-white placeholder:text-white/38 outline-none"
          />
        </div>
      )}

      {/* Amount Input */}
      <div className="rounded-lg bg-[#212121] border border-[#2A2A2A] p-3">
        <label className="text-[10px] text-[#666666] uppercase tracking-wider">
          Amount (CASH)
        </label>
        <input
          type="text"
          inputMode="decimal"
          placeholder="0.00"
          value={amount}
          onChange={handleAmountChange}
          className="mt-1 w-full bg-transparent text-lg font-mono text-white placeholder:text-white/38 outline-none"
        />
      </div>

      {/* Estimated Total */}
      {estimatedTotal && (
        <div className="flex items-center justify-between px-1 text-xs">
          <span className="text-[#666666]">Est. Total</span>
          <span className="font-mono text-white/65">
            {estimatedTotal} USDC
          </span>
        </div>
      )}

      {/* Submit Button */}
      <button
        onClick={handleSubmit}
        disabled={isDisabled}
        className={`w-full rounded-lg py-3 text-sm font-semibold transition-all ${
          isDisabled
            ? "bg-[#2A2A2A] text-white/38 cursor-not-allowed"
            : side === "buy"
              ? "bg-emerald-500 text-white hover:bg-emerald-600 active:bg-emerald-700"
              : "bg-rose-500 text-white hover:bg-rose-600 active:bg-rose-700"
        }`}
      >
        {isSubmitting ? (
          <span className="flex items-center justify-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin" />
            {submitLabel}
          </span>
        ) : (
          submitLabel
        )}
      </button>
    </div>
  );
}
