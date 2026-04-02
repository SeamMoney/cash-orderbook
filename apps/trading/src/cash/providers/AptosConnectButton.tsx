import { useState, useCallback } from 'react'
import { useWallet } from '@aptos-labs/wallet-adapter-react'
import { truncateAddress, formatBalance } from '../lib/utils'
import { useBalances } from '../hooks/use-balances'
import { useAccountSubscription } from '../hooks/use-account-subscription'
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

  const { balances, updateBalances } = useBalances(walletAddress)

  // Subscribe to WS account channel for real-time balance updates
  useAccountSubscription(walletAddress, updateBalances)

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

  // Connected state: show address with dropdown
  return (
    <div style={{ position: 'relative' }}>
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        data-testid="aptos-connected-button"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '8px 12px',
          borderRadius: 20,
          border: '1px solid #2A2A2A',
          backgroundColor: '#1A1A1A',
          color: 'white',
          fontFamily: 'monospace',
          fontSize: 14,
          cursor: 'pointer',
          transition: 'background-color 0.15s',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.backgroundColor = '#2A2A2A'
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.backgroundColor = '#1A1A1A'
        }}
      >
        {badge && (
          <span
            style={{
              padding: '2px 6px',
              fontSize: 10,
              fontWeight: 600,
              borderRadius: 999,
              backgroundColor: badge === 'X-Chain' ? 'rgba(249, 115, 22, 0.2)' : 'rgba(59, 130, 246, 0.2)',
              color: badge === 'X-Chain' ? '#F97316' : '#3B82F6',
            }}
          >
            {badge}
          </span>
        )}
        {wallet?.icon && (
          <img src={wallet.icon} alt={wallet.name} style={{ width: 16, height: 16, borderRadius: 4 }} />
        )}
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            backgroundColor: '#10B981',
            animation: 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
          }}
        />
        <span style={{ fontFamily: 'monospace' }}>{truncateAddress(account.address.toString())}</span>
        <svg
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
          {/* Backdrop */}
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 9998 }}
            onClick={() => setDropdownOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              right: 0,
              top: '100%',
              marginTop: 8,
              zIndex: 9999,
              width: 224,
              borderRadius: 12,
              border: '1px solid #2A2A2A',
              backgroundColor: '#1A1A1A',
              boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
              padding: '4px 0',
            }}
          >
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
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>CASH</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'white' }}>
                  {balances ? formatBalance(balances.cash.available, 2) : '—'}
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 12, color: 'rgba(255,255,255,0.65)' }}>USD1</span>
                <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'white' }}>
                  {balances ? formatBalance(balances.usdc.available, 2) : '—'}
                </span>
              </div>
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
