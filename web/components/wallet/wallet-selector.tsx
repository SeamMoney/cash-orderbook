"use client";

import { useState, useEffect, useMemo } from "react";
import {
  useWallet,
  WalletItem,
  isInstallRequired,
} from "@aptos-labs/wallet-adapter-react";
import {
  groupAndSortWallets,
  WalletReadyState,
  type AdapterWallet,
  type AdapterNotDetectedWallet,
} from "@aptos-labs/wallet-adapter-core";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

// ─── Icons ─────────────────────────────────────────────────────────────────

function GoogleIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        fill="black"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="black"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="black"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="black"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  );
}

// ─── Chain tab type ─────────────────────────────────────────────────────────

type ChainTab = "Aptos" | "Solana" | "Ethereum";

// ─── Allowed wallets ────────────────────────────────────────────────────────

const ALLOWED_WALLETS = [
  "rainbow",
  "metamask",
  "rabby",
  "phantom",
  "backpack",
  "petra",
  "nightly",
  "coinbase",
];

// ─── Wallet Row ─────────────────────────────────────────────────────────────

function WalletListRow({
  wallet,
}: {
  wallet: AdapterWallet | AdapterNotDetectedWallet;
}): React.ReactElement {
  const needsInstall = isInstallRequired(wallet);
  const displayName = wallet.name
    .replace(" (Solana)", "")
    .replace(" (Ethereum)", "");

  if (needsInstall) {
    return (
      <a
        href={wallet.url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center justify-between py-3 px-3 rounded-md hover:bg-[#2A2A2A] transition-colors"
      >
        <div className="flex items-center gap-3">
          {wallet.icon ? (
            <img
              src={wallet.icon}
              alt={wallet.name}
              className="w-9 h-9 rounded-lg"
            />
          ) : (
            <div className="w-9 h-9 rounded-lg bg-[#2A2A2A] flex items-center justify-center">
              <span className="text-white font-bold text-sm">
                {displayName[0]}
              </span>
            </div>
          )}
          <span className="text-white font-medium text-sm">{displayName}</span>
        </div>
        <span className="text-xs px-3 py-1.5 bg-white text-black rounded-md font-medium">
          Install
        </span>
      </a>
    );
  }

  return (
    <WalletItem wallet={wallet}>
      <WalletItem.ConnectButton asChild>
        <button className="w-full flex items-center justify-between py-3 px-3 rounded-md hover:bg-[#2A2A2A] transition-colors">
          <div className="flex items-center gap-3">
            {wallet.icon ? (
              <img
                src={wallet.icon}
                alt={wallet.name}
                className="w-9 h-9 rounded-lg"
              />
            ) : (
              <div className="w-9 h-9 rounded-lg bg-[#2A2A2A] flex items-center justify-center">
                <span className="text-white font-bold text-sm">
                  {displayName[0]}
                </span>
              </div>
            )}
            <span className="text-white font-medium text-sm">
              {displayName}
            </span>
          </div>
          <span className="text-xs px-3 py-1.5 bg-white text-black rounded-md font-medium">
            Connect
          </span>
        </button>
      </WalletItem.ConnectButton>
    </WalletItem>
  );
}

// ─── WalletSelector ─────────────────────────────────────────────────────────

interface WalletSelectorProps {
  isOpen: boolean;
  onClose: () => void;
}

export function WalletSelector({
  isOpen,
  onClose,
}: WalletSelectorProps): React.ReactElement | null {
  const { wallets, notDetectedWallets = [], connected } = useWallet();
  const [selectedChain, setSelectedChain] = useState<ChainTab>("Aptos");

  // Close modal when connected
  useEffect(() => {
    if (connected && isOpen) {
      onClose();
    }
  }, [connected, isOpen, onClose]);

  // Memoize wallet grouping
  const { googleWallet, appleWallet, chainWallets } = useMemo(() => {
    const { petraWebWallets, availableWallets, installableWallets } =
      groupAndSortWallets([...(wallets || []), ...notDetectedWallets]);

    // Find Google and Apple wallets from petraWebWallets
    const googleWallet = petraWebWallets.find((w) =>
      w.name.toLowerCase().includes("google"),
    );
    const appleWallet = petraWebWallets.find((w) =>
      w.name.toLowerCase().includes("apple"),
    );

    // Combine all wallets and filter to only allowed ones
    // Exclude Sui wallets — we only support Aptos, Ethereum, Solana chains
    const allWallets = [...availableWallets, ...installableWallets].filter(
      (wallet) => {
        const name = wallet.name.toLowerCase();
        if (name.includes("(sui)")) return false;
        const baseName = name
          .replace(" (solana)", "")
          .replace(" (ethereum)", "");
        return ALLOWED_WALLETS.some((allowed) => baseName.includes(allowed));
      },
    );

    // Categorize wallets by chain with deduplication
    const aptosWallets: (AdapterWallet | AdapterNotDetectedWallet)[] = [];
    const solanaWallets: (AdapterWallet | AdapterNotDetectedWallet)[] = [];
    const ethereumWallets: (AdapterWallet | AdapterNotDetectedWallet)[] = [];
    const seenAptos = new Set<string>();
    const seenSolana = new Set<string>();
    const seenEthereum = new Set<string>();

    allWallets.forEach((wallet) => {
      const name = wallet.name.toLowerCase();
      const baseName = name.replace(" (solana)", "").replace(" (ethereum)", "");

      if (name.includes("(solana)")) {
        if (!seenSolana.has(baseName)) {
          seenSolana.add(baseName);
          solanaWallets.push(wallet);
        }
      } else if (name.includes("(ethereum)")) {
        if (!seenEthereum.has(baseName)) {
          seenEthereum.add(baseName);
          ethereumWallets.push(wallet);
        }
      } else {
        if (!seenAptos.has(baseName)) {
          seenAptos.add(baseName);
          aptosWallets.push(wallet);
        }
      }
    });

    // Minimal SVG placeholder icon (satisfies data URI type constraint)
    const PLACEHOLDER_ICON =
      "data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=" as const;

    // Add fallback wallets to Ethereum tab if not already present
    if (!seenEthereum.has("metamask")) {
      ethereumWallets.push({
        name: "MetaMask (Ethereum)",
        icon: PLACEHOLDER_ICON,
        url: "https://metamask.io/",
        readyState: WalletReadyState.NotDetected,
      } as AdapterNotDetectedWallet);
    }

    // Add fallback wallets to Solana tab if not already present
    if (!seenSolana.has("phantom")) {
      solanaWallets.push({
        name: "Phantom (Solana)",
        icon: PLACEHOLDER_ICON,
        url: "https://phantom.app/",
        readyState: WalletReadyState.NotDetected,
      } as AdapterNotDetectedWallet);
    }

    return {
      googleWallet,
      appleWallet,
      chainWallets: {
        Aptos: aptosWallets,
        Solana: solanaWallets,
        Ethereum: ethereumWallets,
      },
    };
  }, [wallets, notDetectedWallets]);

  const displayWallets = chainWallets[selectedChain];

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="bg-[#1A1A1A] border-[#2A2A2A] text-white max-w-md p-0 overflow-hidden">
        <DialogHeader className="p-6 pb-0">
          <DialogTitle className="text-lg font-semibold text-white">
            Connect Wallet
          </DialogTitle>
          <DialogDescription className="text-sm text-white/65">
            Choose how you want to connect
          </DialogDescription>
        </DialogHeader>

        <div className="px-6 pb-6 space-y-4">
          {/* Social Login Buttons */}
          {googleWallet && (
            <WalletItem wallet={googleWallet}>
              <WalletItem.ConnectButton asChild>
                <button className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-gray-100 transition-colors rounded-lg">
                  <GoogleIcon />
                  <span className="text-black font-medium text-sm">
                    Continue with Google
                  </span>
                </button>
              </WalletItem.ConnectButton>
            </WalletItem>
          )}

          {appleWallet && (
            <WalletItem wallet={appleWallet}>
              <WalletItem.ConnectButton asChild>
                <button className="w-full flex items-center justify-center gap-3 py-3 bg-white hover:bg-gray-100 transition-colors rounded-lg">
                  <AppleIcon />
                  <span className="text-black font-medium text-sm">
                    Continue with Apple
                  </span>
                </button>
              </WalletItem.ConnectButton>
            </WalletItem>
          )}

          {/* Divider */}
          <div className="flex items-center gap-4">
            <div className="flex-1 h-px bg-[#2A2A2A]" />
            <span className="text-xs text-[#666666] font-medium">
              OR CONNECT WALLET
            </span>
            <div className="flex-1 h-px bg-[#2A2A2A]" />
          </div>

          {/* Chain Tabs */}
          <div className="relative flex bg-[#0D0D0D] rounded-lg p-1">
            {(["Aptos", "Solana", "Ethereum"] as ChainTab[]).map((chain) => (
              <button
                key={chain}
                onClick={() => setSelectedChain(chain)}
                className={`relative flex-1 py-2 px-3 text-sm font-medium transition-colors rounded-md z-10 ${
                  selectedChain === chain
                    ? "text-white"
                    : "text-[#666666] hover:text-white/65"
                }`}
              >
                {selectedChain === chain && (
                  <motion.div
                    layoutId="chain-tab-indicator"
                    className="absolute inset-0 bg-[#2A2A2A] rounded-md"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <span className="relative z-10">{chain}</span>
              </button>
            ))}
          </div>

          {/* X-Chain Info */}
          <AnimatePresence mode="wait">
            {(selectedChain === "Solana" ||
              selectedChain === "Ethereum") && (
              <motion.div
                key={selectedChain}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <div className="flex items-center gap-2">
                    <span className="px-1.5 py-0.5 bg-amber-500/20 text-amber-400 text-[10px] font-semibold rounded">
                      X-CHAIN
                    </span>
                    <span className="text-amber-400 text-xs">
                      Use your {selectedChain} wallet on Aptos
                    </span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Wallet List */}
          <div className="max-h-56 overflow-y-auto -mx-2">
            <AnimatePresence mode="wait">
              <motion.div
                key={selectedChain}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={{ duration: 0.15 }}
              >
                {displayWallets.length > 0 ? (
                  displayWallets.map((wallet) => (
                    <WalletListRow key={wallet.name} wallet={wallet} />
                  ))
                ) : (
                  <p className="text-[#666666] text-sm text-center py-6">
                    No {selectedChain} wallets found
                  </p>
                )}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Footer */}
          <div className="flex justify-center gap-2 pt-2 text-xs">
            <span className="text-white/38">Powered by</span>
            <span className="text-white/65">Aptos X-Chain</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default WalletSelector;
