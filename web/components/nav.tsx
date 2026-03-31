"use client";

import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { ConnectButton } from "@/components/wallet/connect-button";

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
 * Logo "CASH" left, Trade/Explore tabs center, search + Connect Wallet right.
 */
export function Nav({
  activeTab = "trade",
  onTabChange,
}: NavProps): React.ReactElement {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#1A1A1A] bg-[#000000]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-[1400px] items-center justify-between px-4 sm:px-6">
        {/* Left: Logo */}
        <div className="flex items-center gap-6">
          <span className="text-xl font-bold tracking-tight text-white">
            CASH
          </span>
        </div>

        {/* Center: Navigation Tabs */}
        <nav className="hidden sm:flex items-center gap-1">
          {NAV_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => onTabChange?.(tab.id)}
              className={`relative px-4 py-1.5 text-sm font-medium rounded-full transition-colors ${
                activeTab === tab.id
                  ? "text-white"
                  : "text-[#888888] hover:text-white"
              }`}
            >
              {activeTab === tab.id && (
                <motion.div
                  layoutId="nav-tab-indicator"
                  className="absolute inset-0 rounded-full bg-[#1A1A1A]"
                  transition={{
                    type: "spring",
                    stiffness: 400,
                    damping: 30,
                  }}
                />
              )}
              <span className="relative z-10">{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Right: Search + Connect */}
        <div className="flex items-center gap-3">
          {/* Search placeholder */}
          <div className="hidden md:flex items-center gap-2 rounded-full bg-[#111111] border border-[#1A1A1A] px-3 py-1.5 text-sm text-[#555555] w-[200px] cursor-pointer hover:border-[#333333] transition-colors">
            <Search className="h-3.5 w-3.5" />
            <span>Search tokens</span>
          </div>

          {/* Connect Wallet */}
          <ConnectButton />
        </div>
      </div>
    </header>
  );
}

export default Nav;
