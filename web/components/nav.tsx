"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Menu, X } from "lucide-react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { ConnectButton } from "@/components/wallet/connect-button";
import { WalletSelector } from "@/components/wallet/wallet-selector";

export type NavTab = "trade" | "explore";

interface NavProps {
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
}

const NAV_TABS: { id: NavTab; label: string }[] = [
  { id: "trade", label: "Trade" },
  { id: "explore", label: "Explore" },
];

/**
 * Nav — sticky top navigation bar.
 * Logo "CASH" left, Trade/Explore tabs center, wallet actions right.
 * When disconnected: shows "Log In" + "Sign Up" buttons (polymarket style).
 * When connected: shows truncated address with green pulse dot and optional badge.
 * On mobile (<768px): hamburger menu that expands to show tabs + wallet actions.
 */
export function Nav({
  activeTab = "trade",
  onTabChange,
}: NavProps): React.ReactElement {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [selectorOpen, setSelectorOpen] = useState(false);
  const { connected, account, wallet } = useWallet();

  const handleTabChange = useCallback(
    (tab: NavTab): void => {
      onTabChange?.(tab);
      setMobileMenuOpen(false);
    },
    [onTabChange],
  );

  return (
    <>
      <header className="sticky top-0 z-50 w-full bg-background">
        <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
          {/* Left: Logo */}
          <div className="flex items-center gap-6">
            <span className="text-xl font-bold tracking-tight text-white">
              CASH
            </span>
          </div>

          {/* Center: Navigation Tabs (hidden on mobile) */}
          <nav className="hidden md:flex items-center gap-1">
            {NAV_TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => onTabChange?.(tab.id)}
                className={`px-4 py-1.5 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-[#9B9B9B] hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>

          {/* Right: Search + Wallet (desktop) + Hamburger (mobile) */}
          <div className="flex items-center gap-3">
            {/* Search placeholder — hidden on mobile and tablet */}
            <div className="hidden lg:flex items-center gap-2 rounded-full bg-card border border-border px-3 py-1.5 text-sm text-text-muted w-[200px] cursor-pointer hover:border-surface-hover transition-colors">
              <Search className="h-3.5 w-3.5" />
              <span>Search tokens</span>
            </div>

            {/* Wallet area — hidden on mobile, shown in mobile menu instead */}
            <div className="hidden md:flex items-center gap-2">
              {connected && account ? (
                <ConnectButton />
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setSelectorOpen(true)}
                    className="text-[#888888] hover:text-white text-sm font-medium transition-colors px-3 py-1.5"
                  >
                    Log In
                  </button>
                  <button
                    onClick={() => setSelectorOpen(true)}
                    className="px-4 py-1.5 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm rounded-full transition-all"
                  >
                    Sign Up
                  </button>
                </div>
              )}
            </div>

            {/* Hamburger menu toggle — mobile only */}
            <button
              onClick={() => setMobileMenuOpen((prev) => !prev)}
              className="flex md:hidden items-center justify-center h-11 w-11 min-h-[44px] min-w-[44px] rounded-xl text-text-secondary hover:text-white hover:bg-surface-hover transition-colors"
              aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
              aria-expanded={mobileMenuOpen}
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {/* Mobile Menu Drawer */}
        <AnimatePresence>
          {mobileMenuOpen && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="md:hidden overflow-hidden border-t border-border bg-background/95 backdrop-blur-md"
            >
              <div className="px-4 py-4 space-y-3">
                {/* Navigation tabs */}
                <nav className="flex flex-col gap-1">
                  {NAV_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => handleTabChange(tab.id)}
                      className={`flex items-center rounded-xl px-4 py-3 min-h-[44px] text-sm font-medium transition-colors ${
                        activeTab === tab.id
                          ? "bg-secondary text-white"
                          : "text-muted-foreground hover:text-white hover:bg-surface-hover"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </nav>

                {/* Divider */}
                <div className="border-t border-border" />

                {/* Wallet actions — mobile (44px touch target) */}
                <div className="flex items-center [&_button]:min-h-[44px]">
                  {connected && account ? (
                    <ConnectButton />
                  ) : (
                    <div className="flex items-center gap-2 w-full">
                      <button
                        onClick={() => {
                          setSelectorOpen(true);
                          setMobileMenuOpen(false);
                        }}
                        className="text-[#888888] hover:text-white text-sm font-medium transition-colors px-3 py-2"
                      >
                        Log In
                      </button>
                      <button
                        onClick={() => {
                          setSelectorOpen(true);
                          setMobileMenuOpen(false);
                        }}
                        className="px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white font-semibold text-sm rounded-full transition-all"
                      >
                        Sign Up
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Wallet Selector Modal — shared between Log In and Sign Up buttons */}
      <WalletSelector
        isOpen={selectorOpen}
        onClose={() => setSelectorOpen(false)}
      />
    </>
  );
}

export default Nav;
