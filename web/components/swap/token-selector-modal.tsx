"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type CSSProperties,
  type ReactElement,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { List, type RowComponentProps } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import type { UserBalances } from "@cash/shared";
import { formatBalance } from "@/lib/utils";

/** Token metadata used throughout the selector */
export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  gradient: string;
}

/** All supported tokens */
export const SUPPORTED_TOKENS: TokenInfo[] = [
  {
    symbol: "CASH",
    name: "CASH",
    decimals: 6,
    gradient: "from-emerald-400 to-emerald-600",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    decimals: 6,
    gradient: "from-blue-400 to-blue-600",
  },
];

/** Popular token symbols shown at the top */
const POPULAR_SYMBOLS = ["CASH", "USDC"];

/** Props for the TokenSelectorModal */
interface TokenSelectorModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (token: TokenInfo) => void;
  balances: UserBalances | null;
  /** Token symbol to exclude from the list (the other side of the pair) — kept for API compat but no longer filters the list */
  excludeSymbol?: string;
  /** Token symbol currently selected on this side (disabled / non-selectable) */
  selectedSymbol?: string;
}

/** Height of each row in the virtualized list */
const ROW_HEIGHT = 60;

/** Custom row props passed through react-window's rowProps */
interface TokenRowProps {
  tokens: TokenInfo[];
  getBalance: (symbol: string) => number | null;
  onSelect: (token: TokenInfo) => void;
  /** Symbol of the token already selected on the current side (shown as disabled) */
  selectedSymbol?: string;
}

/** Row component for the virtualized list */
function TokenRow({
  index,
  style,
  tokens,
  getBalance,
  onSelect,
  selectedSymbol,
}: RowComponentProps<TokenRowProps>): ReactElement | null {
  const token = tokens[index];
  if (!token) return null;

  const balance = getBalance(token.symbol);
  const isCurrentSide = token.symbol === selectedSymbol;

  return (
    <div style={style} className="px-2">
      <button
        onClick={() => {
          if (!isCurrentSide) onSelect(token);
        }}
        disabled={isCurrentSide}
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card ${
          isCurrentSide
            ? "opacity-40 cursor-not-allowed"
            : "hover:bg-surface-hover"
        }`}
      >
        <TokenIcon token={token} size="md" />
        <div className="flex flex-1 flex-col items-start min-w-0">
          <span className="text-sm font-medium text-white">{token.name}</span>
          <span className="text-xs text-text-muted">{token.symbol}</span>
        </div>
        {balance !== null && (
          <span className="text-sm font-mono text-text-secondary">
            {formatBalance(balance, 4)}
          </span>
        )}
      </button>
    </div>
  );
}

/**
 * TokenSelectorModal — modal dialog for selecting a token.
 *
 * Features:
 * - Search input that filters by name/ticker
 * - Popular tokens row (CASH, USDC)
 * - Virtualized token list with icon + name + ticker + balance
 * - Framer Motion scale/fade enter/exit animation
 * - Escape closes modal, focus returns to trigger
 * - Visible focus indicators
 */
export function TokenSelectorModal({
  open,
  onOpenChange,
  onSelect,
  balances,
  selectedSymbol,
}: TokenSelectorModalProps): React.ReactElement {
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset search when modal opens
  useEffect(() => {
    if (open) {
      setSearch("");
      // Focus the search input after a short delay for animation
      requestAnimationFrame(() => {
        searchInputRef.current?.focus();
      });
    }
  }, [open]);

  // Filter tokens by search query — all tokens always visible (no exclusion)
  const filteredTokens = useMemo(() => {
    const query = search.toLowerCase().trim();
    return SUPPORTED_TOKENS.filter((token) => {
      if (!query) return true;
      return (
        token.symbol.toLowerCase().includes(query) ||
        token.name.toLowerCase().includes(query)
      );
    });
  }, [search]);

  // Popular tokens — always show both CASH and USDC
  const popularTokens = useMemo(
    () =>
      SUPPORTED_TOKENS.filter((t) => POPULAR_SYMBOLS.includes(t.symbol)),
    [],
  );

  const handleSelect = useCallback(
    (token: TokenInfo): void => {
      onSelect(token);
      onOpenChange(false);
    },
    [onSelect, onOpenChange],
  );

  const getBalance = useCallback(
    (symbol: string): number | null => {
      if (!balances) return null;
      if (symbol === "CASH") return balances.cash.available;
      if (symbol === "USDC") return balances.usdc.available;
      return null;
    },
    [balances],
  );

  // Row props for the virtualized list
  const rowProps: TokenRowProps = useMemo(
    () => ({
      tokens: filteredTokens,
      getBalance,
      onSelect: handleSelect,
      selectedSymbol,
    }),
    [filteredTokens, getBalance, handleSelect, selectedSymbol],
  );

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <AnimatePresence>
        {open && (
          <DialogPrimitive.Portal forceMount>
            {/* Overlay */}
            <DialogPrimitive.Overlay asChild>
              <motion.div
                className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              />
            </DialogPrimitive.Overlay>

            {/* Content */}
            <DialogPrimitive.Content
              asChild
              onOpenAutoFocus={(e) => {
                e.preventDefault();
                searchInputRef.current?.focus();
              }}
            >
              <motion.div
                className="fixed left-1/2 top-1/2 z-50 w-[90vw] max-w-[420px] rounded-2xl border border-border bg-card shadow-2xl outline-none"
                style={{ x: "-50%", y: "-50%" }}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{
                  type: "spring",
                  stiffness: 400,
                  damping: 30,
                  mass: 0.8,
                }}
              >
                {/* Header */}
                <div className="flex items-center justify-between border-b border-border px-5 py-4">
                  <DialogPrimitive.Title className="text-base font-semibold text-white">
                    Select a token
                  </DialogPrimitive.Title>
                  <DialogPrimitive.Close className="rounded-lg p-1.5 text-text-muted transition-colors hover:bg-surface-hover hover:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card">
                    <X className="h-4 w-4" />
                    <span className="sr-only">Close</span>
                  </DialogPrimitive.Close>
                </div>

                {/* Search Input */}
                <div className="px-5 pt-4 pb-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search by name or ticker"
                      className="w-full rounded-xl border border-border bg-background py-2.5 pl-10 pr-4 text-sm text-white placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
                    />
                  </div>
                </div>

                {/* Popular Tokens (only shown when not searching) */}
                {!search && popularTokens.length > 0 && (
                  <div className="px-5 pb-3">
                    <p className="mb-2 text-xs text-text-muted">Popular</p>
                    <div className="flex flex-wrap gap-2">
                      {popularTokens.map((token) => {
                        const isCurrentSide = token.symbol === selectedSymbol;
                        return (
                          <button
                            key={token.symbol}
                            onClick={() => {
                              if (!isCurrentSide) handleSelect(token);
                            }}
                            disabled={isCurrentSide}
                            className={`flex items-center gap-2 rounded-full border border-border bg-background px-3 py-1.5 text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card ${
                              isCurrentSide
                                ? "opacity-40 cursor-not-allowed"
                                : "hover:border-primary hover:bg-surface-hover"
                            }`}
                          >
                            <TokenIcon token={token} size="sm" />
                            <span className="font-medium text-white">
                              {token.symbol}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Divider */}
                <div className="mx-5 border-t border-border" />

                {/* Token List */}
                <div className="h-[300px]">
                  {filteredTokens.length === 0 ? (
                    <div className="flex h-full flex-col items-center justify-center gap-2 text-text-muted">
                      <Search className="h-8 w-8 opacity-40" />
                      <p className="text-sm">No tokens found</p>
                      {search && (
                        <p className="text-xs">
                          No results for &ldquo;{search}&rdquo;
                        </p>
                      )}
                    </div>
                  ) : (
                    <AutoSizer
                      renderProp={({
                        height,
                        width,
                      }: {
                        height: number | undefined;
                        width: number | undefined;
                      }) => {
                        if (!height || !width) return null;
                        return (
                          <List
                            style={
                              { height, width } satisfies CSSProperties
                            }
                            rowCount={filteredTokens.length}
                            rowHeight={ROW_HEIGHT}
                            overscanCount={5}
                            rowComponent={TokenRow}
                            rowProps={rowProps}
                          />
                        );
                      }}
                    />
                  )}
                </div>

                {/* Accessibility: description for screen readers */}
                <DialogPrimitive.Description className="sr-only">
                  Search and select a token for trading
                </DialogPrimitive.Description>
              </motion.div>
            </DialogPrimitive.Content>
          </DialogPrimitive.Portal>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  );
}

/** Token icon component with gradient background */
function TokenIcon({
  token,
  size = "md",
}: {
  token: TokenInfo;
  size?: "sm" | "md";
}): React.ReactElement {
  const sizeClasses = size === "sm" ? "h-5 w-5" : "h-8 w-8";
  const textSize = size === "sm" ? "text-[10px]" : "text-xs";

  return (
    <div
      className={`${sizeClasses} shrink-0 rounded-full bg-gradient-to-br ${token.gradient} flex items-center justify-center`}
    >
      <span className={`${textSize} font-bold text-white`}>
        {token.symbol[0]}
      </span>
    </div>
  );
}
