"use client";

import { motion } from "framer-motion";
import { ConnectButton } from "@/components/wallet/connect-button";

export type AppView = "swap" | "orderbook";

interface NavProps {
  activeView: AppView;
  onViewChange: (view: AppView) => void;
}

const NAV_ITEMS: { id: AppView; label: string }[] = [
  { id: "swap", label: "Swap" },
  { id: "orderbook", label: "Orderbook" },
];

/**
 * Nav — top navigation bar with view tabs and wallet connect.
 */
export function Nav({
  activeView,
  onViewChange,
}: NavProps): React.ReactElement {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#2A2A2A] bg-[#212121]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Left: Logo + Nav Tabs */}
        <div className="flex items-center gap-4">
          <span className="text-lg font-semibold tracking-tight text-white">
            CASH
          </span>
          <span className="hidden sm:inline-block text-xs font-medium text-[#888888] border-l border-[#2A2A2A] pl-3">
            Orderbook
          </span>

          {/* View Tabs */}
          <div className="relative ml-4 flex items-center gap-0 rounded-lg bg-[#1A1A1A] p-1">
            {NAV_ITEMS.map((item) => (
              <button
                key={item.id}
                onClick={() => onViewChange(item.id)}
                className={`relative z-10 px-4 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  activeView === item.id
                    ? "text-white"
                    : "text-[#666666] hover:text-[#888888]"
                }`}
              >
                {activeView === item.id && (
                  <motion.div
                    layoutId="nav-indicator"
                    className="absolute inset-0 rounded-md bg-[#2A2A2A]"
                    transition={{
                      type: "spring",
                      stiffness: 400,
                      damping: 30,
                    }}
                  />
                )}
                <span className="relative z-10">{item.label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: Connect Button */}
        <ConnectButton />
      </div>
    </header>
  );
}

export default Nav;
