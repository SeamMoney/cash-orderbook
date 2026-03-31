"use client";

import { useState } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { Wallet, LogOut, Copy, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import { WalletSelector } from "@/components/wallet/wallet-selector";
import { truncateAddress, formatBalance } from "@/lib/utils";
import { useBalances } from "@/hooks/use-balances";
import { useAccountSubscription } from "@/hooks/use-account-subscription";

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
    return (
      <>
        <Button
          onClick={() => setSelectorOpen(true)}
          className="bg-white text-black hover:bg-gray-200 font-medium text-sm gap-2"
        >
          <Wallet className="h-4 w-4" />
          Connect Wallet
        </Button>
        <WalletSelector
          isOpen={selectorOpen}
          onClose={() => setSelectorOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="relative">
      <Button
        variant="outline"
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="border-[#2A2A2A] bg-[#1A1A1A] hover:bg-[#2A2A2A] text-white gap-2 font-mono text-sm"
      >
        {wallet?.icon && (
          <img
            src={wallet.icon}
            alt={wallet.name}
            className="w-4 h-4 rounded-sm"
          />
        )}
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
                <span className="text-xs text-[#888888]">USDC</span>
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
