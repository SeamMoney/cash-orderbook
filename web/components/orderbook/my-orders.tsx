"use client";

import { useState, useCallback, useEffect } from "react";
import { useWallet } from "@aptos-labs/wallet-adapter-react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Loader2 } from "lucide-react";
import { toast } from "sonner";

export interface OpenOrder {
  orderId: number;
  price: number;
  quantity: number;
  remaining: number;
  side: "buy" | "sell";
  type: string;
}

interface MyOrdersProps {
  /** Trigger refetch after new order placed */
  refreshTrigger?: number;
}

const API_BASE = "http://localhost:3100";

function formatPrice(price: number): string {
  return price.toFixed(6);
}

function formatQty(qty: number): string {
  return qty.toFixed(2);
}

/**
 * MyOrders — table below order form showing open orders with cancel button.
 */
export function MyOrders({
  refreshTrigger,
}: MyOrdersProps): React.ReactElement {
  const { connected, account, signAndSubmitTransaction } = useWallet();
  const [orders, setOrders] = useState<OpenOrder[]>([]);
  const [loading, setLoading] = useState(false);
  const [cancellingId, setCancellingId] = useState<number | null>(null);

  const fetchOrders = useCallback(async (): Promise<void> => {
    if (!connected || !account?.address) {
      setOrders([]);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(
        `${API_BASE}/orders/${account.address.toString()}`,
      );
      if (!res.ok) {
        setOrders([]);
        return;
      }
      const data = (await res.json()) as OpenOrder[];
      setOrders(data);
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  }, [connected, account]);

  useEffect(() => {
    void fetchOrders();
  }, [fetchOrders, refreshTrigger]);

  const handleCancel = useCallback(
    async (orderId: number): Promise<void> => {
      if (!connected || !account || !signAndSubmitTransaction) {
        toast.error("Please connect your wallet");
        return;
      }

      setCancellingId(orderId);

      try {
        const CONTRACT_ADDRESS =
          process.env.NEXT_PUBLIC_CONTRACT_ADDRESS ?? "0xCAFE";

        const response = await signAndSubmitTransaction({
          data: {
            function: `${CONTRACT_ADDRESS}::cancel::cancel_order`,
            functionArguments: [0, orderId],
          },
        });

        const txHash =
          typeof response === "object" &&
          response !== null &&
          "hash" in response
            ? (response as { hash: string }).hash
            : String(response);

        toast.success("Order cancelled", {
          description: `Tx: ${txHash.slice(0, 10)}...${txHash.slice(-8)}`,
        });

        // Optimistic remove
        setOrders((prev) => prev.filter((o) => o.orderId !== orderId));
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Cancel failed";
        toast.error("Cancel failed", { description: message });
      } finally {
        setCancellingId(null);
      }
    },
    [connected, account, signAndSubmitTransaction],
  );

  if (!connected) {
    return (
      <div className="text-center py-6 text-xs text-[#555555]">
        Connect wallet to view orders
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#2A2A2A]">
        <span className="text-xs font-medium text-[#888888]">My Orders</span>
        <span className="text-[10px] text-[#555555]">
          {orders.length} open
        </span>
      </div>

      {/* Table Header */}
      {orders.length > 0 && (
        <div className="grid grid-cols-[1fr_1fr_1fr_1fr_32px] gap-1 px-3 py-1 text-[10px] text-[#666666] uppercase tracking-wider">
          <span>Side</span>
          <span>Price</span>
          <span>Size</span>
          <span>Filled</span>
          <span />
        </div>
      )}

      {/* Orders */}
      <div className="max-h-48 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-[#555555]" />
          </div>
        ) : orders.length > 0 ? (
          <AnimatePresence initial={false}>
            {orders.map((order) => (
              <motion.div
                key={order.orderId}
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="grid grid-cols-[1fr_1fr_1fr_1fr_32px] gap-1 items-center px-3 py-1.5 hover:bg-[#2A2A2A]/30 font-mono text-xs"
              >
                <span
                  className={
                    order.side === "buy"
                      ? "text-emerald-400"
                      : "text-rose-400"
                  }
                >
                  {order.side === "buy" ? "BUY" : "SELL"}
                </span>
                <span className="text-white">
                  {formatPrice(order.price)}
                </span>
                <span className="text-[#999999]">
                  {formatQty(order.quantity)}
                </span>
                <span className="text-[#666666]">
                  {formatQty(order.quantity - order.remaining)}/
                  {formatQty(order.quantity)}
                </span>
                <button
                  onClick={() => handleCancel(order.orderId)}
                  disabled={cancellingId === order.orderId}
                  className="flex items-center justify-center w-6 h-6 rounded hover:bg-rose-500/20 text-[#666666] hover:text-rose-400 transition-colors disabled:opacity-50"
                  title="Cancel order"
                >
                  {cancellingId === order.orderId ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <X className="h-3 w-3" />
                  )}
                </button>
              </motion.div>
            ))}
          </AnimatePresence>
        ) : (
          <div className="text-center py-6 text-xs text-[#555555]">
            No open orders
          </div>
        )}
      </div>
    </div>
  );
}
