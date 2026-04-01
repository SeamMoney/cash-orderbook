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
 * Features:
 * - Columns: Time, Type, Price, Amount, Address
 * - Buy rows green, sell rows red
 * - Sortable columns (click header)
 * - New trades animate in via Framer Motion
 * - Empty state when no trades
 * - Monospace font for numbers
 */
export function TransactionsTable({
  trades,
  loading,
}: TransactionsTableProps): React.ReactElement {
  const [sorting, setSorting] = useState<SortingState>([]);

  const columns = useMemo<ColumnDef<TradeEntry>[]>(
    () => [
      {
        accessorKey: "timestamp",
        header: "Time",
        cell: ({ getValue }) => (
          <span className="text-[#9B9B9B]">{timeAgo(getValue<number>())}</span>
        ),
        sortingFn: "basic",
      },
      {
        accessorKey: "side",
        header: "Type",
        cell: ({ getValue }) => {
          const side = getValue<"buy" | "sell">();
          return (
            <span
              className={`font-medium ${
                side === "buy" ? "text-cash-green" : "text-cash-red"
              }`}
            >
              {side === "buy" ? "Buy" : "Sell"}
            </span>
          );
        },
        sortingFn: "basic",
      },
      {
        accessorKey: "price",
        header: "Price",
        cell: ({ getValue }) => (
          <span className="font-sans text-white">{formatPrice(getValue<number>())}</span>
        ),
        sortingFn: "basic",
      },
      {
        accessorKey: "quantity",
        header: "Amount",
        cell: ({ getValue }) => (
          <span className="font-sans text-white">{formatAmount(getValue<number>())}</span>
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
        header: "Address",
        cell: ({ getValue }) => {
          const addr = getValue<string | null>();
          return (
            <span className="font-sans text-[#9B9B9B]">
              {addr ? truncateAddr(addr) : "—"}
            </span>
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
    <div>
      {/* Header */}
      <div className="mb-4">
        <h3 className="text-[25px] leading-[30px] font-medium text-white">Transactions</h3>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[400px] text-[13px]">
          {/* Column Headers */}
          <thead>
            {table.getHeaderGroups().map((headerGroup) => (
              <tr
                key={headerGroup.id}
                className="border-b border-border text-[#9B9B9B]"
              >
                {headerGroup.headers.map((header) => (
                  <th
                    key={header.id}
                    className={`pb-2 text-left font-normal ${
                      header.column.getCanSort()
                        ? "cursor-pointer select-none hover:text-text-secondary transition-colors"
                        : ""
                    } ${
                      header.id === "price" ||
                      header.id === "quantity" ||
                      header.id === "address"
                        ? "text-right"
                        : ""
                    }`}
                    onClick={header.column.getToggleSortingHandler()}
                  >
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext(),
                    )}
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
                  className="border-b border-border/50 last:border-0"
                >
                  <td className="py-3"><Skeleton className="h-3 w-12 rounded" /></td>
                  <td className="py-3"><Skeleton className="h-3 w-8 rounded" /></td>
                  <td className="py-3 text-right"><Skeleton className="h-3 w-14 rounded ml-auto" /></td>
                  <td className="py-3 text-right"><Skeleton className="h-3 w-12 rounded ml-auto" /></td>
                  <td className="py-3 text-right"><Skeleton className="h-3 w-16 rounded ml-auto" /></td>
                </tr>
              ))
            ) : trades.length === 0 ? (
              /* Empty state */
              <tr>
                <td colSpan={5} className="py-12 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <span className="text-sm text-text-muted">No recent transactions</span>
                    <span className="text-xs text-text-muted/60">
                      Trades will appear here in real-time
                    </span>
                  </div>
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
                    className="border-b border-border/50 last:border-0"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td
                        key={cell.id}
                        className={`py-2.5 ${
                          cell.column.id === "price" ||
                          cell.column.id === "quantity" ||
                          cell.column.id === "address"
                            ? "text-right"
                            : ""
                        }`}
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
      </div>
    </div>
  );
}
