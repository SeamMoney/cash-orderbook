"use client";

import { useMemo, useState } from "react";
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { Text, useTheme } from "@tamagui/core";
import { Flex } from "@/components/ui/Flex";
import { Skeleton } from "@/components/ui/skeleton";
import type { TradeEntry } from "@/components/orderbook/trade-ticker";

/**
 * Format a timestamp to a relative time string (e.g., "2m ago").
 */
function timeAgo(timestamp: number): string {
  const diff = Date.now() - timestamp;
  if (diff < 1000) return "now";
  if (diff < 60_000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;
  return `${Math.floor(diff / 86_400_000)}d ago`;
}

/**
 * Format a price for display.
 */
function formatPrice(price: number): string {
  return price.toFixed(6);
}

/**
 * Format a quantity for display.
 */
function formatAmount(qty: number): string {
  if (qty >= 1_000_000) return `${(qty / 1_000_000).toFixed(2)}M`;
  if (qty >= 1_000) return `${(qty / 1_000).toFixed(2)}K`;
  return qty.toFixed(4);
}

/**
 * Truncate an address for display: 0x1234...abcd
 */
function truncateAddr(address: string, chars = 4): string {
  if (!address) return "—";
  if (address.length <= chars * 2 + 2) return address;
  return `${address.slice(0, chars + 2)}...${address.slice(-chars)}`;
}

/** Sort icon component for column headers */
function SortIcon({ column }: { column: { getIsSorted: () => false | "asc" | "desc" } }): React.ReactElement {
  const sorted = column.getIsSorted();
  if (sorted === "asc") return <ArrowUp className="ml-1 inline h-3 w-3" />;
  if (sorted === "desc") return <ArrowDown className="ml-1 inline h-3 w-3" />;
  return <ArrowUpDown className="ml-1 inline h-3 w-3 opacity-40" />;
}

interface TransactionsTableProps {
  /** Trade entries from use-realtime-trades hook. */
  trades: TradeEntry[];
  /** Whether data is still loading. */
  loading: boolean;
}

/**
 * TransactionsTable — recent trades table using @tanstack/react-table.
 *
 * Migrated to Tamagui matching Uniswap's ActivitySection pattern:
 * - Section heading: Text heading3 (25px/30px), neutral1
 * - Table headers: Text body4 (13px), neutral2 color
 * - Table cells: Text body4 (13px), neutral1 for values
 * - Row height: ~52px (paddingVertical ~18px)
 * - Row borders: surface3
 * - Buy/sell: statusSuccess / statusCritical
 *
 * Preserves @tanstack/react-table, sort, and animated row entry.
 */
export function TransactionsTable({
  trades,
  loading,
}: TransactionsTableProps): React.ReactElement {
  const theme = useTheme();
  const surface3Val = theme.surface3?.val as string;
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<TradeEntry>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: "Time",
        cell: ({ getValue }) => (
          <Text
            fontFamily="$body"
            fontSize={13}
            lineHeight={16}
            fontWeight="485"
            color="$neutral2"
            data-testid="cell-time"
          >
            {timeAgo(getValue<number>())}
          </Text>
        ),
        sortingFn: "basic",
      },
      {
        accessorKey: "side",
        header: "Type",
        cell: ({ getValue }) => {
          const side = getValue<"buy" | "sell">();
          return (
            <Text
              fontFamily="$body"
              fontSize={13}
              lineHeight={16}
              fontWeight="535"
              color={side === "buy" ? "$statusSuccess" : "$statusCritical"}
              data-testid="cell-type"
            >
              {side === "buy" ? "Buy" : "Sell"}
            </Text>
          );
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ getValue }) => (
          <Text
            fontFamily="$body"
            fontSize={13}
            lineHeight={16}
            fontWeight="485"
            color="$neutral1"
            data-testid="cell-price"
          >
            {formatPrice(getValue<number>())}
          </Text>
        ),
        sortingFn: "basic",
      },
      {
        accessorKey: "quantity",
        header: "Amount",
        cell: ({ getValue }) => (
          <Text
            fontFamily="$body"
            fontSize={13}
            lineHeight={16}
            fontWeight="485"
            color="$neutral1"
            data-testid="cell-amount"
          >
            {formatAmount(getValue<number>())}
          </Text>
        ),
        sortingFn: "basic",
      },
      {
        id: "address",
        accessorFn: (row) =>
          (row as TradeEntry & { maker?: string; makerAddress?: string })
            .maker ??
          (row as TradeEntry & { maker?: string; makerAddress?: string })
            .makerAddress ??
          null,
        header: "Wallet",
        cell: ({ getValue }) => {
          const addr = getValue<string | null>();
          return (
            <Text
              fontFamily="$body"
              fontSize={13}
              lineHeight={16}
              fontWeight="485"
              color="$neutral2"
              data-testid="cell-wallet"
            >
              {addr ? truncateAddr(addr) : "—"}
            </Text>
          );
        },
        enableSorting: false,
      },
    ],
    [],
  );

  const table = useReactTable({
    data: trades,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
  });

  return (
    <Flex width="100%" data-testid="transactions-section">
      {/* Section heading — heading3: 25px/30px, neutral1 */}
      <Text
        tag="h3"
        fontFamily="$heading"
        fontSize={25}
        lineHeight={30}
        fontWeight="485"
        color="$neutral1"
        marginBottom="$spacing24"
        data-testid="transactions-heading"
      >
        Transactions
      </Text>

      {/* Table */}
      <Flex width="100%" style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", minWidth: 400, borderCollapse: "collapse" }}>
          {/* Column Headers */}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    onClick={header.column.getToggleSortingHandler()}
                    data-testid="table-header"
                    style={{
                      paddingBottom: 8,
                      textAlign:
                        header.id === "price" ||
                        header.id === "quantity" ||
                        header.id === "address"
                          ? "right"
                          : "left",
                      fontWeight: "normal",
                      borderBottom: `1px solid ${surface3Val}`,
                      cursor: header.column.getCanSort() ? "pointer" : "default",
                      userSelect: header.column.getCanSort() ? "none" : "auto",
                    }}
                  >
                    <Text
                      fontFamily="$body"
                      fontSize={13}
                      lineHeight={16}
                      fontWeight="485"
                      color="$neutral2"
                      display="inline"
                      data-testid="header-text"
                    >
                      {flexRender(
                        header.column.columnDef.header,
                        header.getContext(),
                      )}
                    </Text>
                    {header.column.getCanSort() && (
                      <SortIcon column={header.column} />
                    )}
                  </th>
                ))}
              </tr>
            ))}
          </thead>

          {/* Body */}
          <tbody>
            {loading ? (
              /* Loading skeleton rows */
              Array.from({ length: 5 }).map((_, i) => (
                <tr
                  key={`skel-${i}`}
                  style={{
                    borderBottom:
                      i < 4
                        ? `1px solid ${surface3Val}`
                        : "none",
                  }}
                >
                  <td style={{ paddingTop: 18, paddingBottom: 18 }}>
                    <Skeleton className="h-3 w-12 rounded" />
                  </td>
                  <td style={{ paddingTop: 18, paddingBottom: 18 }}>
                    <Skeleton className="h-3 w-8 rounded" />
                  </td>
                  <td style={{ paddingTop: 18, paddingBottom: 18, textAlign: "right" }}>
                    <Skeleton className="h-3 w-14 rounded ml-auto" />
                  </td>
                  <td style={{ paddingTop: 18, paddingBottom: 18, textAlign: "right" }}>
                    <Skeleton className="h-3 w-12 rounded ml-auto" />
                  </td>
                  <td style={{ paddingTop: 18, paddingBottom: 18, textAlign: "right" }}>
                    <Skeleton className="h-3 w-16 rounded ml-auto" />
                  </td>
                </tr>
              ))
            ) : trades.length === 0 ? (
              /* Empty state */
              <tr>
                <td colSpan={5} style={{ paddingTop: 48, paddingBottom: 48, textAlign: "center" }}>
                  <Flex flexDirection="column" alignItems="center" gap="$spacing8">
                    <Text
                      fontFamily="$body"
                      fontSize={15}
                      lineHeight={19.5}
                      fontWeight="485"
                      color="$neutral3"
                    >
                      No recent transactions
                    </Text>
                    <Text
                      fontFamily="$body"
                      fontSize={13}
                      lineHeight={16}
                      fontWeight="485"
                      color="$neutral3"
                      opacity={0.6}
                    >
                      Trades will appear here in real-time
                    </Text>
                  </Flex>
                </td>
              </tr>
            ) : (
              /* Data rows with animation */
              <AnimatePresence initial={false}>
                {table.getRowModel().rows.map((row) => (
                  <motion.tr
                    key={row.original.id}
                    initial={{ opacity: 0, height: 0, y: -10 }}
                    animate={{ opacity: 1, height: "auto", y: 0 }}
                    exit={{ opacity: 0, height: 0 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    style={{
                      borderBottom: `1px solid ${surface3Val}`,
                    }}
                    data-testid="transaction-row"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        data-testid="table-cell"
                        style={{
                          paddingTop: 18,
                          paddingBottom: 18,
                          textAlign:
                            cell.column.id === "price" ||
                            cell.column.id === "quantity" ||
                            cell.column.id === "address"
                              ? "right"
                              : "left",
                        }}
                      >
                        {flexRender(
                          cell.column.columnDef.cell,
                          cell.getContext(),
                        )}
                      </td>
                    ))}
                  </motion.tr>
                ))}
              </AnimatePresence>
            )}
          </tbody>
        </table>
      </Flex>
    </Flex>
  );
}
