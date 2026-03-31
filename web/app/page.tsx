"use client";

import { Nav } from "@/components/nav";
import { ConnectButton } from "@/components/wallet/connect-button";

export default function Home(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col bg-[#212121]">
      <Nav />

      {/* Hero / Main Content */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 text-center">
        <div className="max-w-2xl space-y-6">
          {/* Tagline */}
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl md:text-5xl">
            The Fastest CASH Swap Ever.
          </h1>
          <p className="text-lg text-[#888888] sm:text-xl">
            True Zero-Slippage Atomic On-Chain Orderbook.
          </p>

          {/* CTA */}
          <div className="flex items-center justify-center gap-4 pt-4">
            <ConnectButton />
          </div>

          {/* Stats placeholder */}
          <div className="grid grid-cols-3 gap-6 pt-10">
            <div className="space-y-1">
              <p className="font-mono text-xl font-semibold text-white">
                $0.00
              </p>
              <p className="text-xs text-[#666666]">24h Volume</p>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-xl font-semibold text-white">0</p>
              <p className="text-xs text-[#666666]">Total Trades</p>
            </div>
            <div className="space-y-1">
              <p className="font-mono text-xl font-semibold text-emerald-500">
                0%
              </p>
              <p className="text-xs text-[#666666]">Slippage</p>
            </div>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-[#2A2A2A] py-4">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 flex items-center justify-between">
          <p className="text-xs text-[#555555]">
            Built on Aptos · Powered by Move
          </p>
          <p className="font-mono text-xs text-[#555555]">CASH / USDC</p>
        </div>
      </footer>
    </div>
  );
}
