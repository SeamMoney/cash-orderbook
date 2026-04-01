import type { Metadata } from "next";
import { GeistSans } from "geist/font/sans";
import { GeistMono } from "geist/font/mono";
import { WalletProvider } from "@/components/wallet/wallet-provider";
import { TamaguiProvider } from "@/components/providers/tamagui-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "CASH Orderbook",
  description:
    "The Fastest CASH Swap Ever. True Zero-Slippage Atomic On-Chain Orderbook.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}): React.ReactElement {
  return (
    <html lang="en" className="dark">
      <body
        className={`${GeistSans.variable} ${GeistMono.variable} antialiased bg-[#131313] text-foreground min-h-screen`}
      >
        <WalletProvider>
          <TamaguiProvider>{children}</TamaguiProvider>
        </WalletProvider>
      </body>
    </html>
  );
}
