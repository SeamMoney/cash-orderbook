import { type FC, type ReactNode, useEffect } from 'react'
import { AptosWalletAdapterProvider, type DappConfig } from '@aptos-labs/wallet-adapter-react'
import { Network } from '@aptos-labs/ts-sdk'

const ACTIVE_NETWORK = Network.TESTNET

/**
 * Lazy-initialize X-Chain wallet derivation.
 *
 * @aptos-labs/derived-wallet-ethereum requires ethers v6 (BrowserProvider, etc.),
 * but this project ships ethers v5. The import will fail gracefully at runtime —
 * cross-chain derived wallets won't work, but native Aptos wallets (Petra, Nightly,
 * Backpack) and Aptos Connect (Google/Apple) will work fine.
 */
let xChainInitialized = false
function initXChainWallets(): void {
  if (xChainInitialized) return
  xChainInitialized = true

  // Ethereum-derived wallets (MetaMask, Rainbow, etc.)
  import('@aptos-labs/derived-wallet-ethereum')
    .then(({ setupAutomaticEthereumWalletDerivation }) => {
      setupAutomaticEthereumWalletDerivation({
        defaultNetwork: ACTIVE_NETWORK,
      })
    })
    .catch(() => {
      // Expected: ethers v6 not available in this project
      console.debug('[AptosWallet] Ethereum derived wallets unavailable (ethers v6 required)')
    })

  // Solana-derived wallets (Phantom Solana, etc.)
  import('@aptos-labs/derived-wallet-solana')
    .then(({ setupAutomaticSolanaWalletDerivation }) => {
      setupAutomaticSolanaWalletDerivation({
        defaultNetwork: ACTIVE_NETWORK,
      })
    })
    .catch(() => {
      console.debug('[AptosWallet] Solana derived wallets unavailable')
    })
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
