"use client";

import { Nav } from "@/components/nav";
import { SwapWidget } from "@/components/swap/swap-widget";
import { Toaster } from "sonner";

export default function Home(): React.ReactElement {
  return (
    <div className="flex min-h-screen flex-col bg-[#212121]">
      <Nav />
      <Toaster
        theme="dark"
        position="top-right"
        toastOptions={{
          style: {
            background: "#1A1A1A",
            border: "1px solid #2A2A2A",
            color: "#FFFFFF",
          },
        }}
      />

      {/* Main Content — Swap Interface */}
      <main className="flex flex-1 flex-col items-center justify-center px-4">
        <div className="w-full max-w-md space-y-6">
          {/* Tagline */}
          <div className="text-center space-y-2 mb-2">
            <h1 className="text-2xl font-bold tracking-tight text-white sm:text-3xl">
              The Fastest CASH Swap Ever.
            </h1>
            <p className="text-sm text-[#888888]">
              True Zero-Slippage Atomic On-Chain Orderbook.
            </p>
          </div>

          {/* Swap Widget */}
          <SwapWidget />

          {/* Stats */}
          <div className="grid grid-cols-3 gap-6 pt-4">
            <div className="space-y-1 text-center">
              <p className="font-mono text-lg font-semibold text-white">
                $0.00
              </p>
              <p className="text-xs text-[#666666]">24h Volume</p>
            </div>
            <div className="space-y-1 text-center">
              <p className="font-mono text-lg font-semibold text-white">0</p>
              <p className="text-xs text-[#666666]">Total Trades</p>
            </div>
            <div className="space-y-1 text-center">
              <p className="font-mono text-lg font-semibold text-emerald-500">
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
