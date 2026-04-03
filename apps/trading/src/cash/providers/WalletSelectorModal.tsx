import { useState, useEffect, useMemo, useCallback } from 'react'
import { useWallet, WalletItem, isInstallRequired } from '@aptos-labs/wallet-adapter-react'
import {
  groupAndSortWallets,
  WalletReadyState,
  type AdapterWallet,
  type AdapterNotDetectedWallet,
} from '@aptos-labs/wallet-adapter-core'

// ─── Icons ─────────────────────────────────────────────────────────────────

function GoogleIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24">
      <path
        fill="black"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="black"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="black"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="black"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}

function AppleIcon(): React.ReactElement {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="black">
      <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M13 3.5c.73-.83 1.94-1.46 2.94-1.5.13 1.17-.34 2.35-1.04 3.19-.69.85-1.83 1.51-2.95 1.42-.15-1.15.41-2.35 1.05-3.11z" />
    </svg>
  )
}

// ─── Chain tab type ─────────────────────────────────────────────────────────

type ChainTab = 'Aptos' | 'Solana' | 'Ethereum'

// ─── Allowed wallets ────────────────────────────────────────────────────────

const ALLOWED_WALLETS = ['rainbow', 'metamask', 'rabby', 'phantom', 'backpack', 'petra', 'nightly', 'coinbase']

// ─── Minimal SVG placeholder icon ───────────────────────────────────────────

const PLACEHOLDER_ICON =
  'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMSIgaGVpZ2h0PSIxIiB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciLz4=' as `data:image/${string}`

// ─── Wallet Row ─────────────────────────────────────────────────────────────

function WalletListRow({ wallet }: { wallet: AdapterWallet | AdapterNotDetectedWallet }): React.ReactElement {
  const needsInstall = isInstallRequired(wallet)
  const displayName = wallet.name.replace(' (Solana)', '').replace(' (Ethereum)', '')

  if (needsInstall) {
    return (
      <a
        href={wallet.url}
        target="_blank"
        rel="noopener noreferrer"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px',
          borderRadius: '8px',
          textDecoration: 'none',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#2A2A2A'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = 'transparent'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {wallet.icon ? (
            <img src={wallet.icon} alt={wallet.name} style={{ width: 36, height: 36, borderRadius: 8 }} />
          ) : (
            <div
              style={{
                width: 36,
                height: 36,
                borderRadius: 8,
                backgroundColor: '#2A2A2A',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{displayName[0]}</span>
            </div>
          )}
          <span style={{ color: 'white', fontWeight: 500, fontSize: 14 }}>{displayName}</span>
        </div>
        <span
          style={{
            fontSize: 12,
            padding: '6px 12px',
            backgroundColor: 'white',
            color: 'black',
            borderRadius: 6,
            fontWeight: 500,
          }}
        >
          Install
        </span>
      </a>
    )
  }

  return (
    <WalletItem wallet={wallet}>
      <WalletItem.ConnectButton asChild>
        <button
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '12px',
            borderRadius: '8px',
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
            transition: 'background-color 0.15s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.backgroundColor = '#2A2A2A'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.backgroundColor = 'transparent'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {wallet.icon ? (
              <img src={wallet.icon} alt={wallet.name} style={{ width: 36, height: 36, borderRadius: 8 }} />
            ) : (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 8,
                  backgroundColor: '#2A2A2A',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <span style={{ color: 'white', fontWeight: 700, fontSize: 14 }}>{displayName[0]}</span>
              </div>
            )}
            <span style={{ color: 'white', fontWeight: 500, fontSize: 14 }}>{displayName}</span>
          </div>
          <span
            style={{
              fontSize: 12,
              padding: '6px 12px',
              backgroundColor: 'white',
              color: 'black',
              borderRadius: 6,
              fontWeight: 500,
            }}
          >
            Connect
          </span>
        </button>
      </WalletItem.ConnectButton>
    </WalletItem>
  )
}

// ─── WalletSelectorModal ────────────────────────────────────────────────────

interface WalletSelectorModalProps {
  isOpen: boolean
  onClose: () => void
}

export function WalletSelectorModal({ isOpen, onClose }: WalletSelectorModalProps): React.ReactElement | null {
  const { wallets, notDetectedWallets = [], connected } = useWallet()
  const [selectedChain, setSelectedChain] = useState<ChainTab>('Aptos')

  // Close modal when connected
  useEffect(() => {
    if (connected && isOpen) {
      onClose()
    }
  }, [connected, isOpen, onClose])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  // Memoize wallet grouping
  const { googleWallet, appleWallet, chainWallets } = useMemo(() => {
    const { petraWebWallets, availableWallets, installableWallets } = groupAndSortWallets([
      ...(wallets || []),
      ...notDetectedWallets,
    ])

    // Find Google and Apple wallets from petraWebWallets
    const google = petraWebWallets.find((w) => w.name.toLowerCase().includes('google'))
    const apple = petraWebWallets.find((w) => w.name.toLowerCase().includes('apple'))

    // Combine all wallets and filter to only allowed ones
    // Exclude Sui wallets — we only support Aptos, Ethereum, Solana chains
    const allWallets = [...availableWallets, ...installableWallets].filter((wallet) => {
      const name = wallet.name.toLowerCase()
      if (name.includes('(sui)')) return false
      const baseName = name.replace(' (solana)', '').replace(' (ethereum)', '')
      return ALLOWED_WALLETS.some((allowed) => baseName.includes(allowed))
    })

    // Categorize wallets by chain with deduplication
    const aptosWallets: (AdapterWallet | AdapterNotDetectedWallet)[] = []
    const solanaWallets: (AdapterWallet | AdapterNotDetectedWallet)[] = []
    const ethereumWallets: (AdapterWallet | AdapterNotDetectedWallet)[] = []
    const seenAptos = new Set<string>()
    const seenSolana = new Set<string>()
    const seenEthereum = new Set<string>()

    allWallets.forEach((wallet) => {
      const name = wallet.name.toLowerCase()
      const baseName = name.replace(' (solana)', '').replace(' (ethereum)', '')

      if (name.includes('(solana)')) {
        if (!seenSolana.has(baseName)) {
          seenSolana.add(baseName)
          solanaWallets.push(wallet)
        }
      } else if (name.includes('(ethereum)')) {
        if (!seenEthereum.has(baseName)) {
          seenEthereum.add(baseName)
          ethereumWallets.push(wallet)
        }
      } else {
        if (!seenAptos.has(baseName)) {
          seenAptos.add(baseName)
          aptosWallets.push(wallet)
        }
      }
    })

    // Add fallback wallets to Ethereum tab if not already present
    if (!seenEthereum.has('metamask')) {
      ethereumWallets.push({
        name: 'MetaMask (Ethereum)',
        icon: PLACEHOLDER_ICON,
        url: 'https://metamask.io/',
        readyState: WalletReadyState.NotDetected,
      } as AdapterNotDetectedWallet)
    }

    // Add fallback wallets to Solana tab if not already present
    if (!seenSolana.has('phantom')) {
      solanaWallets.push({
        name: 'Phantom (Solana)',
        icon: PLACEHOLDER_ICON,
        url: 'https://phantom.app/',
        readyState: WalletReadyState.NotDetected,
      } as AdapterNotDetectedWallet)
    }

    return {
      googleWallet: google,
      appleWallet: apple,
      chainWallets: {
        Aptos: aptosWallets,
        Solana: solanaWallets,
        Ethereum: ethereumWallets,
      },
    }
  }, [wallets, notDetectedWallets])

  const displayWallets = chainWallets[selectedChain]

  const handleBackdropClick = useCallback(
    (e: React.MouseEvent) => {
      if (e.target === e.currentTarget) onClose()
    },
    [onClose],
  )

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100010,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.60)',
      }}
      onClick={handleBackdropClick}
      data-testid="wallet-selector-modal"
    >
      <div
        style={{
          backgroundColor: '#1A1A1A',
          border: '1px solid #2A2A2A',
          borderRadius: 16,
          maxWidth: 420,
          width: '100%',
          margin: '0 16px',
          overflow: 'hidden',
          animation: 'fadeInUp 0.2s ease-out',
        }}
      >
        {/* Header */}
        <div style={{ padding: '24px 24px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h2 style={{ color: 'white', fontSize: 18, fontWeight: 600, margin: 0 }}>Connect Wallet</h2>
            <button
              onClick={onClose}
              style={{
                background: 'transparent',
                border: 'none',
                color: 'rgba(255,255,255,0.65)',
                cursor: 'pointer',
                padding: 4,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 14, margin: '4px 0 0' }}>
            Choose how you want to connect
          </p>
        </div>

        <div style={{ padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Social Login Buttons */}
          {googleWallet && (
            <WalletItem wallet={googleWallet}>
              <WalletItem.ConnectButton asChild>
                <button
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: '12px',
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f3f3'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white'
                  }}
                >
                  <GoogleIcon />
                  <span style={{ color: 'black', fontWeight: 500, fontSize: 14 }}>Continue with Google</span>
                </button>
              </WalletItem.ConnectButton>
            </WalletItem>
          )}

          {appleWallet && (
            <WalletItem wallet={appleWallet}>
              <WalletItem.ConnectButton asChild>
                <button
                  style={{
                    width: '100%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 12,
                    padding: '12px',
                    backgroundColor: 'white',
                    border: 'none',
                    borderRadius: 8,
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.backgroundColor = '#f3f3f3'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.backgroundColor = 'white'
                  }}
                >
                  <AppleIcon />
                  <span style={{ color: 'black', fontWeight: 500, fontSize: 14 }}>Continue with Apple</span>
                </button>
              </WalletItem.ConnectButton>
            </WalletItem>
          )}

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <div style={{ flex: 1, height: 1, backgroundColor: '#2A2A2A' }} />
            <span style={{ fontSize: 12, color: '#666666', fontWeight: 500 }}>OR CONNECT WALLET</span>
            <div style={{ flex: 1, height: 1, backgroundColor: '#2A2A2A' }} />
          </div>

          {/* Chain Tabs */}
          <div
            style={{
              display: 'flex',
              backgroundColor: '#0D0D0D',
              borderRadius: 8,
              padding: 4,
            }}
          >
            {(['Aptos', 'Solana', 'Ethereum'] as ChainTab[]).map((chain) => (
              <button
                key={chain}
                onClick={() => setSelectedChain(chain)}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: 14,
                  fontWeight: 500,
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                  backgroundColor: selectedChain === chain ? '#2A2A2A' : 'transparent',
                  color: selectedChain === chain ? 'white' : '#666666',
                }}
              >
                {chain}
              </button>
            ))}
          </div>

          {/* X-Chain Info */}
          {(selectedChain === 'Solana' || selectedChain === 'Ethereum') && (
            <div
              style={{
                padding: 12,
                backgroundColor: 'rgba(245, 158, 11, 0.1)',
                border: '1px solid rgba(245, 158, 11, 0.2)',
                borderRadius: 8,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span
                style={{
                  padding: '2px 6px',
                  backgroundColor: 'rgba(245, 158, 11, 0.2)',
                  color: '#F59E0B',
                  fontSize: 10,
                  fontWeight: 600,
                  borderRadius: 4,
                }}
              >
                X-CHAIN
              </span>
              <span style={{ color: '#F59E0B', fontSize: 12 }}>
                Use your {selectedChain} wallet on Aptos
              </span>
            </div>
          )}

          {/* Wallet List */}
          <div style={{ maxHeight: 224, overflowY: 'auto', margin: '0 -8px' }}>
            {displayWallets.length > 0 ? (
              displayWallets.map((wallet) => <WalletListRow key={wallet.name} wallet={wallet} />)
            ) : (
              <p style={{ color: '#666666', fontSize: 14, textAlign: 'center', padding: '24px 0' }}>
                No {selectedChain} wallets found
              </p>
            )}
          </div>

          {/* Footer */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, paddingTop: 8, fontSize: 12 }}>
            <span style={{ color: 'rgba(255,255,255,0.38)' }}>Powered by</span>
            <span style={{ color: 'rgba(255,255,255,0.65)' }}>Aptos X-Chain</span>
          </div>
        </div>
      </div>

      {/* CSS animation for modal entrance */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(8px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  )
}

export default WalletSelectorModal
