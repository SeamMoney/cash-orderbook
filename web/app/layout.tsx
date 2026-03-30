import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "CASH Orderbook",
  description: "The Fastest CASH Swap Ever. True Zero-Slippage Atomic On-Chain Orderbook.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
