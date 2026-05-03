import { type FC, type ReactNode, useEffect } from 'react'
import { AptosWalletAdapterProvider, type DappConfig } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'

const ACTIVE_NETWORK = Network.TESTNET

/**
 * Cross-chain wallet derivation (Ethereum/Solana → Aptos via signature) is
 * disabled. The Aptos-labs derived wallet packages require ethers v6 and
 * pull in EVM-specific bundle weight we don't need on an Aptos-only app.
 * Native Aptos wallets (Petra, Nightly, Backpack) and Aptos Connect
 * (Google/Apple) work without these.
 */
function initXChainWallets(): void {
  // intentional no-op
}

// Get dapp image URI for Aptos Connect
function getDappImageURI(): string | undefined {
  if (typeof window !== 'undefined') {
    return `${window.location.origin}/favicon.ico`
  }
  return undefined
}

export const AptosWalletProvider: FC<{ children: ReactNode }> = ({ children }) => {
  // Initialize X-Chain derivation lazily (won't crash if ethers v6 is missing)
  useEffect(() => {
    initXChainWallets()
  }, [])

  const dappConfig: DappConfig = {
    network: ACTIVE_NETWORK,
    // Enable cross-chain wallets (Phantom Solana, MetaMask Ethereum, etc.)
    crossChainWallets: true,
    // Aptos Connect configuration for keyless wallets (Google/Apple login)
    aptosConnect: {
      dappId: '57fa42a9-29c6-4f1e-939c-4eefa36d9ff5',
      dappImageURI: getDappImageURI(),
    },
  }

  return (
    <AptosWalletAdapterProvider
      autoConnect={true}
      dappConfig={dappConfig}
      onError={(error: unknown) => {
        console.error('Wallet adapter error:', error)
      }}
    >
      {children}
    </AptosWalletAdapterProvider>
  )
}
