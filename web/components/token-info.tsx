"use client";

import { useState, useCallback } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { CONTRACT_ADDRESS } from "@/lib/sdk";

const EXPLORER_BASE = "https://explorer.aptoslabs.com/account";
const NETWORK_PARAM = "?network=mainnet";

/**
 * TokenInfo — displays the contract address with copy-to-clipboard and explorer link.
 *
 * Features:
 * - Truncated contract address
 * - Copy button with "Copied!" feedback
 * - Link to Aptos Explorer (opens in new tab)
 */
export function TokenInfo(): React.ReactElement {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async (): Promise<void> => {
    try {
      await navigator.clipboard.writeText(CONTRACT_ADDRESS);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments where clipboard API is not available
      const textArea = document.createElement("textarea");
      textArea.value = CONTRACT_ADDRESS;
      textArea.style.position = "fixed";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand("copy");
      document.body.removeChild(textArea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }, []);

  const truncated =
    CONTRACT_ADDRESS.length > 12
      ? `${CONTRACT_ADDRESS.slice(0, 6)}...${CONTRACT_ADDRESS.slice(-4)}`
      : CONTRACT_ADDRESS;

  const explorerUrl = `${EXPLORER_BASE}/${CONTRACT_ADDRESS}${NETWORK_PARAM}`;

  return (
    <div className="rounded-2xl border border-border bg-card p-4">
      <h3 className="mb-3 text-sm font-medium text-white">Token Info</h3>

      <div className="flex items-center justify-between gap-3">
        {/* Contract Address */}
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-muted">Contract</span>
          <span className="font-mono text-xs text-text-secondary">{truncated}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          {/* Copy Button */}
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
            title="Copy contract address"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-cash-green" />
                <span className="text-cash-green">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" />
                <span>Copy</span>
              </>
            )}
          </button>

          {/* Explorer Link */}
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-text-muted transition-colors hover:bg-surface-hover hover:text-text-secondary"
            title="View on Aptos Explorer"
          >
            <ExternalLink className="h-3 w-3" />
            <span>Explorer</span>
          </a>
        </div>
      </div>
    </div>
  );
}
