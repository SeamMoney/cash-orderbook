"use client";

import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";

interface SwapButtonProps {
  connected: boolean;
  hasQuote: boolean;
  hasInput: boolean;
  sufficientLiquidity: boolean;
  insufficientBalance: boolean;
  isSwapping: boolean;
  onSwap: () => void;
}

/**
 * SwapButton — the main action button for the swap widget.
 *
 * States:
 * - Not connected → "Connect Wallet" (disabled)
 * - No input → "Enter Amount" (disabled)
 * - Insufficient balance → "Insufficient balance" (disabled)
 * - No quote → "Fetching Quote..." (disabled)
 * - Insufficient liquidity → "Insufficient Liquidity" (disabled)
 * - Swapping → Loading spinner
 * - Ready → "Swap" (enabled)
 */
export function SwapButton({
  connected,
  hasQuote,
  hasInput,
  sufficientLiquidity,
  insufficientBalance,
  isSwapping,
  onSwap,
}: SwapButtonProps): React.ReactElement {
  const getButtonState = (): {
    label: string;
    disabled: boolean;
  } => {
    if (!connected) {
      return { label: "Connect Wallet", disabled: true };
    }
    if (!hasInput) {
      return { label: "Enter Amount", disabled: true };
    }
    if (insufficientBalance) {
      return { label: "Insufficient balance", disabled: true };
    }
    if (!hasQuote) {
      return { label: "Fetching Quote...", disabled: true };
    }
    if (!sufficientLiquidity) {
      return { label: "Insufficient Liquidity", disabled: true };
    }
    if (isSwapping) {
      return { label: "Swapping...", disabled: true };
    }
    return { label: "Swap", disabled: false };
  };

  const { label, disabled } = getButtonState();

  return (
    <Button
      onClick={onSwap}
      disabled={disabled}
      className="mt-4 w-full h-12 rounded-xl text-base font-semibold transition-all
        bg-white text-black hover:bg-gray-200
        disabled:bg-[#2A2A2A] disabled:text-[#555555] disabled:cursor-not-allowed"
    >
      {isSwapping ? (
        <span className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          {label}
        </span>
      ) : (
        label
      )}
    </Button>
  );
}
