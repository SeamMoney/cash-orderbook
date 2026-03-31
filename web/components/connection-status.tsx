"use client";

import { motion } from "framer-motion";
import type { WsStatus } from "@/hooks/use-websocket";

interface ConnectionStatusProps {
  status: WsStatus;
}

const STATUS_CONFIG: Record<
  WsStatus,
  { color: string; pulseColor: string; label: string }
> = {
  connected: {
    color: "bg-emerald-500",
    pulseColor: "bg-emerald-400",
    label: "Live",
  },
  connecting: {
    color: "bg-amber-500",
    pulseColor: "bg-amber-400",
    label: "Connecting",
  },
  reconnecting: {
    color: "bg-amber-500",
    pulseColor: "bg-amber-400",
    label: "Reconnecting",
  },
  disconnected: {
    color: "bg-rose-500",
    pulseColor: "bg-rose-400",
    label: "Offline",
  },
};

/**
 * ConnectionStatus — shows a colored dot + label indicating WebSocket status.
 * Green pulsing dot for connected, amber for connecting/reconnecting, red for disconnected.
 */
export function ConnectionStatus({
  status,
}: ConnectionStatusProps): React.ReactElement {
  const config = STATUS_CONFIG[status];

  return (
    <div className="flex items-center gap-1.5">
      <span className="relative flex h-2 w-2">
        {status === "connected" && (
          <motion.span
            className={`absolute inline-flex h-full w-full rounded-full ${config.pulseColor} opacity-75`}
            animate={{ scale: [1, 1.5, 1], opacity: [0.75, 0, 0.75] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
          />
        )}
        <span
          className={`relative inline-flex h-2 w-2 rounded-full ${config.color}`}
        />
      </span>
      <span className="text-[10px] text-[#666666] font-medium">
        {config.label}
      </span>
    </div>
  );
}
