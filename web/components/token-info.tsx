"use client";

import { useState, useCallback } from "react";
import { Copy, Check, ExternalLink, Globe } from "lucide-react";
import { CONTRACT_ADDRESS } from "@/lib/sdk";

const EXPLORER_BASE = "https://explorer.aptoslabs.com/account";
const NETWORK_PARAM = "?network=mainnet";
const WEBSITE_URL = "https://github.com/nicholasgasior/cash-orderbook";

const TOKEN_DESCRIPTION =
  "CASH is a token on the Aptos blockchain powering the CASH Orderbook, a high-performance Central Limit Order Book (CLOB) for zero-slippage trading.";

/**
 * TokenInfo — About section with token description, contract address pill,
 * and link pills for Explorer and Website.
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
    <div>
      <h3 className="text-lg font-semibold text-white mb-3">About</h3>
      <p className="text-sm text-[#9B9B9B] mb-4 leading-relaxed">
        {TOKEN_DESCRIPTION}
      </p>

      {/* Link pills */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Contract pill with copy */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-[#1A1A1A] text-sm text-[#9B9B9B] transition-colors hover:bg-[#252525] hover:text-white"
          title="Copy contract address"
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-cash-green" />
              <span className="text-cash-green">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>{truncated}</span>
            </>
          )}
        </button>

        {/* Explorer pill */}
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-[#1A1A1A] text-sm text-[#9B9B9B] transition-colors hover:bg-[#252525] hover:text-white"
          title="View on Aptos Explorer"
        >
          <ExternalLink className="h-3.5 w-3.5" />
          <span>Explorer</span>
        </a>

        {/* Website pill */}
        <a
          href={WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 bg-[#1A1A1A] text-sm text-[#9B9B9B] transition-colors hover:bg-[#252525] hover:text-white"
          title="Visit website"
        >
          <Globe className="h-3.5 w-3.5" />
          <span>Website</span>
        </a>
      </div>
    </div>
  );
}
