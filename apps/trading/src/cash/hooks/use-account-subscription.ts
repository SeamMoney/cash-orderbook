import { useMemo, useCallback } from "react";
import { useWebSocket, type WsMessage } from "./use-websocket";
import type { UserBalances } from "@cash/shared";

/**
 * Hook that subscribes to the 'account:{address}' WebSocket channel
 * when a wallet is connected. On balance update messages, calls the
 * provided callback to update displayed balances.
 *
 * Returns the WS status for the account subscription.
 */
export function useAccountSubscription(
  address: string | undefined,
  onBalanceUpdate?: (balances: UserBalances) => void,
): { wsStatus: "connecting" | "connected" | "disconnected" | "reconnecting" } {
  const channels = useMemo(() => {
    if (!address) return [];
    return [`account:${address}`];
  }, [address]);

  const handleMessage = useCallback(
    (msg: WsMessage): void => {
      if (!address) return;
      if (msg.channel !== `account:${address}`) return;

      // The WS server sends balance updates with shape:
      // { channel: "account:0x...", data: { cash: { available, locked }, usdc: { available, locked } }, timestamp }
      const data = msg.data as UserBalances;
      if (data && typeof data === "object" && "cash" in data && "usdc" in data) {
        onBalanceUpdate?.(data);
      }
    },
    [address, onBalanceUpdate],
  );

  const { status } = useWebSocket({
    channels,
    onMessage: handleMessage,
    enabled: !!address,
  });

  return { wsStatus: status };
}
