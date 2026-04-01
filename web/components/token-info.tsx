"use client";

import { useState, useCallback } from "react";
import { Copy, Check, ExternalLink, Globe } from "lucide-react";
import { CONTRACT_ADDRESS } from "@/lib/sdk";

const EXPLORER_BASE = "https://explorer.aptoslabs.com/account";
const NETWORK_PARAM = "?network=mainnet";
const WEBSITE_URL = "https://github.com/nicholasgasior/cash-orderbook";

const TOKEN_DESCRIPTION =
  "CASH is a token on the Aptos blockchain powering the CASH Orderbook, a high-performance Central Limit Order Book (CLOB) for zero-slippage trading.";

const TRUNCATE_CHARACTER_COUNT = 300;

/**
 * TokenInfo — About section with token description, contract address pill,
 * and link pills for Explorer and Website.
 */
export function TokenInfo(): React.ReactElement {
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState(false);

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

  const shouldTruncate = TOKEN_DESCRIPTION.length > TRUNCATE_CHARACTER_COUNT;
  const displayDescription =
    shouldTruncate && !expanded
      ? TOKEN_DESCRIPTION.slice(0, TRUNCATE_CHARACTER_COUNT) + "..."
      : TOKEN_DESCRIPTION;

  return (
    <div>
      <h3 className="text-[25px] leading-[30px] font-medium text-white mb-3">About</h3>
      <p className="text-[19px] leading-6 text-white mb-4">
        {displayDescription}
        {shouldTruncate && (
          <button
            onClick={() => setExpanded((prev) => !prev)}
            className="ml-1 text-white/65 hover:text-white transition-colors"
          >
            {expanded ? "Show less" : "Show more"}
          </button>
        )}
      </p>

      {/* Link pills */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Contract pill with copy */}
        <button
          onClick={handleCopy}
          className="flex items-center gap-2 rounded-[20px] px-3 py-2 bg-[#1F1F1F] text-[17px] text-white/65 transition-colors hover:bg-[#242424] hover:text-white"
          title="Copy contract address"
        >
          {copied ? (
            <>
              <Check className="h-4 w-4 text-cash-green" />
              <span className="text-cash-green">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="h-4 w-4" />
              <span>{truncated}</span>
            </>
          )}
        </button>

        {/* Explorer pill */}
        <a
          href={explorerUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-[20px] px-3 py-2 bg-[#1F1F1F] text-[17px] text-white/65 transition-colors hover:bg-[#242424] hover:text-white"
          title="View on Aptos Explorer"
        >
          <ExternalLink className="h-4 w-4" />
          <span>Explorer</span>
        </a>

        {/* Website pill */}
        <a
          href={WEBSITE_URL}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 rounded-[20px] px-3 py-2 bg-[#1F1F1F] text-[17px] text-white/65 transition-colors hover:bg-[#242424] hover:text-white"
          title="Visit website"
        >
          <Globe className="h-4 w-4" />
          <span>Website</span>
        </a>
      </div>
    </div>
  );
}
