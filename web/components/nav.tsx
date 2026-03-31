"use client";

import { ConnectButton } from "@/components/wallet/connect-button";

export function Nav(): React.ReactElement {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-[#2A2A2A] bg-[#212121]/90 backdrop-blur-md">
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        {/* Logo / Brand */}
        <div className="flex items-center gap-3">
          <span className="text-lg font-semibold tracking-tight text-white">
            CASH
          </span>
          <span className="hidden sm:inline-block text-xs font-medium text-[#888888] border-l border-[#2A2A2A] pl-3">
            Orderbook
          </span>
        </div>

        {/* Connect Button */}
        <ConnectButton />
      </div>
    </header>
  );
}

export default Nav;
