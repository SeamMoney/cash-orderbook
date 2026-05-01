import { useState, useCallback } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { truncateAddress, formatBalance } from '../lib/utils'
import { useAptosWalletBalances } from '../hooks/use-aptos-balances'
import { WalletSelectorModal } from './WalletSelectorModal'

/**
 * Detect wallet type badge:
 * - "X-Chain" for Ethereum/Solana derived wallets
 * - "Keyless" for Google/Apple keyless wallets via Aptos Connect
 * - null for standard Aptos wallets
 */
function getWalletBadge(walletName: string | undefined): string | null {
  if (!walletName) return null
  const name = walletName.toLowerCase()
  if (
    name.includes('ethereum') ||
    name.includes('solana') ||
    name.includes('metamask') ||
    name.includes('phantom') ||
    name.includes('rainbow') ||
    name.includes('coinbase wallet')
  ) {
    return 'X-Chain'
  }
  if (
    name.includes('google') ||
    name.includes('apple') ||
    name.includes('continue with') ||
    name.includes('aptos connect')
  ) {
    return 'Keyless'
  }
  return null
}

/** Deterministic color from a string — used to generate avatar gradients from wallet addresses. */
function stringToColor(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash) % 360
  return `hsl(${hue}, 70%, 55%)`
}

/**
 * AptosConnectButton — Shows either a "Connect" button or connected wallet state.
 *
 * When disconnected: shows a styled "Connect" button that opens the wallet selector.
 * When connected: shows truncated address with a dropdown for balances, copy, and disconnect.
 */
export function AptosConnectButton(): React.ReactElement {
  const { connected, account, disconnect, wallet } = useWallet()
  const [selectorOpen, setSelectorOpen] = useState(false)
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [copied, setCopied] = useState(false)

  const walletAddress = connected && account?.address ? account.address.toString() : undefined

  const aptosBalances = useAptosWalletBalances(walletAddress)

  const badge = getWalletBadge(wallet?.name)

  const handleCopyAddress = useCallback(async (): Promise<void> => {
    if (account?.address) {
      await navigator.clipboard.writeText(account.address.toString())
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [account?.address])

  const handleDisconnect = useCallback(async (): Promise<void> => {
    await disconnect()
    setDropdownOpen(false)
  }, [disconnect])

  // Disconnected state: show "Connect" button
  if (!connected || !account) {
    return (
      <>
        <button
          onClick={() => setSelectorOpen(true)}
          data-testid="aptos-connect-button"
          style={{
            padding: '8px 16px',
            borderRadius: 20,
            border: 'none',
            backgroundColor: '#FF37C7',
            color: 'white',
            fontWeight: 500,
            fontSize: 15,
            cursor: 'pointer',
            transition: 'opacity 0.15s',
            whiteSpace: 'nowrap',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.opacity = '0.85'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.opacity = '1'
          }}
        >
          Connect
        </button>
        <WalletSelectorModal isOpen={selectorOpen} onClose={() => setSelectorOpen(false)} />
      </>
    )
  }

  // Connected state: address pill (desktop) or compact circle (mobile)
  return (
    <div style={{ position: 'relative' }}>
      <style>{`
        .cash-wallet-trigger {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 6px 12px 6px 6px;
          height: 36px;
          border-radius: 999px;
          border: 1px solid rgba(255,255,255,0.12);
          background-color: #1A1A1A;
          color: white;
          font-family: inherit;
          font-size: 14px;
          cursor: pointer;
          transition: background-color 0.15s;
        }
        .cash-wallet-trigger:hover {
          background-color: #2A2A2A;
        }
        .cash-wallet-avatar {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: block;
          flex-shrink: 0;
        }
        .cash-wallet-address {
          font-family: 'Basel', monospace;
          font-size: 13px;
          font-weight: 500;
          letter-spacing: 0;
        }
        @media (max-width: 768px) {
          .cash-wallet-trigger {
            padding: 0;
            border: none;
            background-color: transparent;
            height: auto;
            width: 24px;
            height: 24px;
          }
          .cash-wallet-trigger:hover {
            background-color: transparent;
          }
          .cash-wallet-avatar {
            width: 24px;
            height: 24px;
          }
          .cash-wallet-address,
          .cash-wallet-chevron {
            display: none;
          }
        }
      `}</style>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        data-testid="aptos-connected-button"
        aria-label="Wallet"
        className="cash-wallet-trigger"
      >
        {wallet?.icon ? (
          <img
            src={wallet.icon}
            alt={wallet.name}
            className="cash-wallet-avatar"
          />
        ) : (
          <span
            className="cash-wallet-avatar"
            style={{
              background: `linear-gradient(135deg, ${stringToColor(account.address.toString())} 0%, ${stringToColor(account.address.toString().slice(-8))} 100%)`,
            }}
          />
        )}
        <span className="cash-wallet-address">
          {truncateAddress(account.address.toString())}
        </span>
        <svg
          className="cash-wallet-chevron"
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="rgba(255,255,255,0.65)"
          strokeWidth="2"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {/* Dropdown */}
      {dropdownOpen && (
        <>
          {/* Backdrop with subtle scrim on mobile */}
          <div
            className="cash-wallet-backdrop"
            onClick={() => setDropdownOpen(false)}
          />
          <style>{`
            .cash-wallet-backdrop {
              position: fixed;
              inset: 0;
              z-index: 9998;
              background-color: transparent;
            }
            .cash-wallet-dropdown {
              position: absolute;
              right: 0;
              top: 100%;
              margin-top: 8px;
              z-index: 9999;
              width: 280px;
              border-radius: 12px;
              border: 1px solid rgba(255,255,255,0.12);
              background-color: #1A1A1A;
              box-shadow: 0 8px 24px rgba(0,0,0,0.4);
              padding: 4px 0;
            }
            @media (max-width: 640px) {
              .cash-wallet-backdrop {
                background-color: rgba(0, 0, 0, 0.5);
              }
              .cash-wallet-dropdown {
                position: fixed;
                left: 0;
                right: 0;
                bottom: 0;
                top: auto;
                margin: 0;
                width: 100%;
                border-radius: 16px 16px 0 0;
                border-bottom: 0;
                padding: 12px 0 24px;
                animation: cashSheetUp 0.25s ease-out;
              }
              .cash-wallet-handle {
                display: block !important;
              }
            }
            .cash-wallet-handle {
              display: none;
              width: 36px;
              height: 4px;
              border-radius: 999px;
              background-color: rgba(255,255,255,0.2);
              margin: 0 auto 8px;
            }
            @keyframes cashSheetUp {
              from { transform: translateY(100%); }
              to   { transform: translateY(0); }
            }
          `}</style>
          <div className="cash-wallet-dropdown">
            <div className="cash-wallet-handle" />
            {/* Address */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #2A2A2A' }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '0 0 4px' }}>Connected Address</p>
              <p style={{ fontFamily: 'monospace', fontSize: 12, color: 'white', margin: 0 }}>
                {truncateAddress(account.address.toString(), 8)}
              </p>
            </div>

            {/* Balances */}
            <div style={{ padding: '8px 12px', borderBottom: '1px solid #2A2A2A' }}>
              <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)', margin: '0 0 4px' }}>Balances</p>
              {['CASH', 'USD1', 'USDC', 'USDt', 'USDe', 'APT'].map((sym) => {
                const bal = aptosBalances.bySymbol.get(sym)
                return (
                  <div key={sym} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
                    <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>{sym}</span>
                    <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'white' }}>
                      {bal !== undefined ? formatBalance(bal, 2) : '—'}
                    </span>
                  </div>
                )
              })}
            </div>

            {/* Actions */}
            <button
              onClick={handleCopyAddress}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                fontSize: 14,
                color: 'rgba(255,255,255,0.65)',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2A2A2A'
                e.currentTarget.style.color = 'white'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = 'rgba(255,255,255,0.65)'
              }}
            >
              {copied ? (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#10B981" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                  <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                </svg>
              )}
              {copied ? 'Copied!' : 'Copy Address'}
            </button>

            <button
              onClick={handleDisconnect}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '8px 12px',
                fontSize: 14,
                color: '#FB7185',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                transition: 'all 0.15s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#2A2A2A'
                e.currentTarget.style.color = '#FDA4AF'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent'
                e.currentTarget.style.color = '#FB7185'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Disconnect
            </button>
          </div>
        </>
      )}

      {/* Keep selector around for re-opens (e.g. switch wallet) */}
      <WalletSelectorModal isOpen={selectorOpen} onClose={() => setSelectorOpen(false)} />

      {/* Pulse animation */}
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  )
}

export default AptosConnectButton
