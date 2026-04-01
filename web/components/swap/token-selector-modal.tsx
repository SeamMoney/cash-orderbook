"use client";

import {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useSyncExternalStore,
  type CSSProperties,
  type ReactElement,
} from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import { List, type RowComponentProps } from "react-window";
import { AutoSizer } from "react-virtualized-auto-sizer";
import { STABLECOINS, CASH_DECIMALS } from "@cash/shared";
import type { UserBalances } from "@cash/shared";
import { formatBalance } from "@/lib/utils";

/** Token metadata used throughout the selector */
export interface TokenInfo {
  symbol: string;
  name: string;
  decimals: number;
  gradient: string;
}

/** Hook to detect if viewport is at least 640px wide (sm breakpoint) */
function useIsDesktop(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mql = window.matchMedia("(min-width: 640px)");
      mql.addEventListener("change", cb);
      return () => mql.removeEventListener("change", cb);
    },
    () => window.matchMedia("(min-width: 640px)").matches,
    () => true, // SSR default: treat as desktop
  );
}

/** All supported tokens — CASH first, then stablecoins sorted: USD1, USDC, USDT, USDe, GHO */
export const SUPPORTED_TOKENS: TokenInfo[] = [
  {
    symbol: "CASH",
    name: "CASH",
    decimals: CASH_DECIMALS,
    gradient: "from-green-400 to-emerald-600",
  },
  ...STABLECOINS.map((s) => ({
    symbol: s.symbol,
    name: s.name,
    decimals: s.decimals,
    gradient: s.gradient,
  })),
];

/** Popular token symbols shown at the top (top 4) */
const POPULAR_SYMBOLS = ["CASH", "USD1", "USDC", "USDT"];

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
  /** Ref to the trigger button — focus is restored here on modal close */
  triggerRef?: React.RefObject<HTMLButtonElement | null>;
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
        className={`flex w-full items-center gap-3 rounded-xl px-3 py-2.5 min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card ${
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
        <span className="text-sm font-sans text-text-secondary">
          {balance !== null ? formatBalance(balance, 4) : "—"}
        </span>
      </button>
    </div>
  );
}

/**
 * TokenSelectorModal — modal dialog for selecting a token.
 *
 * Features:
 * - Search input that filters by name/ticker
 * - Popular tokens row (CASH, USD1, USDC, USDT)
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
  triggerRef,
}: TokenSelectorModalProps): React.ReactElement {
  const [search, setSearch] = useState("");
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isDesktop = useIsDesktop();

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

  // Popular tokens — top 4: CASH, USD1, USDC, USDT
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
      // Tokens without a balance endpoint show '—' (return null)
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
              onCloseAutoFocus={(e) => {
                e.preventDefault();
                triggerRef?.current?.focus();
              }}
            >
              <motion.div
                className="token-selector-dialog fixed z-50 border border-border bg-card shadow-2xl outline-none"
                style={isDesktop ? { x: "-50%", y: "-50%" } : undefined}
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
                  <DialogPrimitive.Close className="rounded-lg p-2 min-h-[44px] min-w-[44px] flex items-center justify-center text-text-muted transition-colors hover:bg-surface-hover hover:text-white focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card">
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
                      className="w-full rounded-xl border border-border bg-background py-3 min-h-[44px] pl-10 pr-4 text-sm text-white placeholder:text-text-muted outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary"
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
                            className={`flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 min-h-[44px] text-sm transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-card ${
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
                <div className="h-[300px] sm:h-[300px] flex-1 sm:flex-initial">
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
