"use client";

import { type FC, type ReactNode } from "react";
import {
  AptosWalletAdapterProvider,
  type DappConfig,
} from "@aptos-labs/wallet-adapter-react";
import { Network } from "@aptos-labs/ts-sdk";

const ACTIVE_NETWORK = Network.TESTNET;

// Initialize X-Chain wallet derivation at module level (client-side only)
// This allows Phantom, MetaMask, Rainbow, etc. to derive Aptos accounts
if (typeof window !== "undefined") {
  import("@aptos-labs/derived-wallet-ethereum")
    .then(({ setupAutomaticEthereumWalletDerivation }) => {
      setupAutomaticEthereumWalletDerivation({
        defaultNetwork: ACTIVE_NETWORK,
      });
    })
    .catch(console.error);

  import("@aptos-labs/derived-wallet-solana")
    .then(({ setupAutomaticSolanaWalletDerivation }) => {
      setupAutomaticSolanaWalletDerivation({
        defaultNetwork: ACTIVE_NETWORK,
      });
    })
    .catch(console.error);
}

// Get dapp image URI for Aptos Connect
function getDappImageURI(): string | undefined {
  if (typeof window !== "undefined") {
    return `${window.location.origin}/favicon.ico`;
  }
  return undefined;
}

export const WalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  const dappConfig: DappConfig = {
    network: ACTIVE_NETWORK,
    // Enable cross-chain wallets (Phantom Solana, MetaMask Ethereum, etc.)
    crossChainWallets: true,
    // Aptos Connect configuration for keyless wallets (Google/Apple login)
    aptosConnect: {
      dappId: "57fa42a9-29c6-4f1e-939c-4eefa36d9ff5",
      dappImageURI: getDappImageURI(),
    },
  };

  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={dappConfig}
      onError={(error: unknown) => {
        console.error("Wallet adapter error:", error);
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  );
};
