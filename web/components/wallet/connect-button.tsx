"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { LogOut, Copy, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletSelector } from "@/components/wallet/wallet-selector";
import { truncateAddress, formatBalance } from "@/lib/utils";
import { useBalances } from "@/hooks/use-balances";
import { useAccountSubscription } from "@/hooks/use-account-subscription";

/**
 * Detect wallet type badge:
 * - "X-Chain" for Ethereum/Solana derived wallets
 * - "Keyless" for Google/Apple keyless wallets via Aptos Connect
 * - null for standard Aptos wallets
 */
function getWalletBadge(walletName: string | undefined): string | null {
  if (!walletName) return null;
  const name = walletName.toLowerCase();
  if (
    name.includes("ethereum") ||
    name.includes("solana") ||
    name.includes("metamask") ||
    name.includes("phantom") ||
    name.includes("rainbow") ||
    name.includes("coinbase wallet")
  ) {
    return "X-Chain";
  }
  if (
    name.includes("google") ||
    name.includes("apple") ||
    name.includes("continue with") ||
    name.includes("aptos connect")
  ) {
    return "Keyless";
  }
  return null;
}

/**
 * ConnectButton — Connected wallet button with dropdown.
 *
 * Shows truncated address with a green pulse dot and optional X-Chain/Keyless badge.
 * Dropdown shows CASH and USD1 balances, copy address, and disconnect.
 *
 * Note: When wallet is NOT connected, the Nav component handles showing
 * "Log In" / "Sign Up" buttons instead. This component is only rendered
 * when a wallet is already connected.
 */
export function ConnectButton(): React.ReactElement {
  const { connected, account, disconnect, wallet } = useWallet();
  const [selectorOpen, setSelectorOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [copied, setCopied] = useState(false);

  const walletAddress = connected && account?.address
    ? account.address.toString()
    : undefined;

  const { balances, updateBalances } = useBalances(walletAddress);

  // Subscribe to WS account channel for real-time balance updates
  useAccountSubscription(walletAddress, updateBalances);

  const badge = getWalletBadge(wallet?.name);

  const handleCopyAddress = async (): Promise<void> => {
    if (account?.address) {
      await navigator.clipboard.writeText(account.address.toString());
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    await disconnect();
    setDropdownOpen(false);
  };

  if (!connected || !account) {
    // Disconnected state is handled by Nav — render nothing here
    return <></>;
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="border-[#2A2A2A] bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white gap-2 font-mono text-sm"
      >
        {badge && (
          <span
            className={`px-1.5 py-0.5 text-[10px] font-semibold rounded-full ${
              badge === "X-Chain"
                ? "bg-orange-500/20 text-orange-400"
                : "bg-blue-500/20 text-blue-400"
            }`}
          >
            {badge}
          </span>
        )}
        {wallet?.icon && (
          <img
            src={wallet.icon}
            alt={wallet.name}
            className="w-4 h-4 rounded-sm"
          />
        )}
        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
        <span className="font-mono">
          {truncateAddress(account.address.toString())}
        </span>
        <ChevronDown className="h-3 w-3 text-[#888888]" />
      </Button>

      {/* Dropdown */}
      {dropdownOpen && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40"
            onClick={() => setDropdownOpen(false)}
          />
          <div className="absolute right-0 top-full mt-2 z-50 w-56 rounded-lg border border-[#2A2A2A] bg-[#1A1A1A] shadow-lg py-1">
            {/* Address */}
            <div className="px-3 py-2 border-b border-[#2A2A2A]">
              <p className="text-xs text-[#888888] mb-1">Connected Address</p>
              <p className="font-mono text-xs text-white">
                {truncateAddress(account.address.toString(), 8)}
              </p>
            </div>

            {/* Balances */}
            <div className="px-3 py-2 border-b border-[#2A2A2A] space-y-1">
              <p className="text-xs text-[#888888] mb-1">Balances</p>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#888888]">CASH</span>
                <span className="font-mono text-xs text-white">
                  {balances ? formatBalance(balances.cash.available, 2) : "—"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-xs text-[#888888]">USD1</span>
                <span className="font-mono text-xs text-white">
                  {balances ? formatBalance(balances.usdc.available, 2) : "—"}
                </span>
              </div>
            </div>

            {/* Actions */}
            <button
              onClick={handleCopyAddress}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#888888] hover:text-white hover:bg-[#2A2A2A] transition-colors"
            >
              {copied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
              {copied ? "Copied!" : "Copy Address"}
            </button>

            <button
              onClick={handleDisconnect}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-rose-400 hover:text-rose-300 hover:bg-[#2A2A2A] transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Disconnect
            </button>
          </div>
        </>
      )}

      {/* Keep selector around for re-opens */}
      <WalletSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
      />
    </div>
  );
}

export default ConnectButton;
