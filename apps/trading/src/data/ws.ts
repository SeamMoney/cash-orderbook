/**
 * WebSocket client for the CASH real-time feed (port 3101).
 *
 * Supports subscribing to channels: orderbook, trades, account:{address}.
 * Auto-reconnects on disconnect.
 */

/** In dev the Vite proxy forwards /cash-ws → ws://localhost:3101 */
function getWsUrl(): string {
  const loc = typeof window !== 'undefined' ? window.location : undefined
  if (!loc) return 'ws://localhost:3101'
  const protocol = loc.protocol === 'https:' ? 'wss:' : 'ws:'
  return `${protocol}//${loc.host}/cash-ws`
}

const WS_URL = getWsUrl()

type MessageHandler = (data: unknown) => void

interface Subscription {
  channel: string
  handler: MessageHandler
}

class CashWebSocket {
  private ws: WebSocket | null = null
  private subscriptions: Subscription[] = []
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private isConnecting = false

  connect(): void {
    if (this.ws?.readyState === WebSocket.OPEN || this.isConnecting) {
      return
    }

    this.isConnecting = true

    try {
      this.ws = new WebSocket(WS_URL)

      this.ws.onopen = () => {
        this.isConnecting = false
        // Re-subscribe to all channels
        this.subscriptions.forEach((sub) => {
          this.sendSubscribe(sub.channel)
        })
      }

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as { channel: string; data: unknown }
          this.subscriptions
            .filter((sub) => sub.channel === msg.channel)
            .forEach((sub) => sub.handler(msg.data))
        } catch {
          // Ignore malformed messages
        }
      }

      this.ws.onclose = () => {
        this.isConnecting = false
        this.scheduleReconnect()
      }

      this.ws.onerror = () => {
        this.isConnecting = false
        this.ws?.close()
      }
    } catch {
      this.isConnecting = false
      this.scheduleReconnect()
    }
  }

  subscribe(channel: string, handler: MessageHandler): () => void {
    const sub: Subscription = { channel, handler }
    this.subscriptions.push(sub)

    // Connect if not already connected
    this.connect()

    // Send subscribe message if already connected
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.sendSubscribe(channel)
    }

    // Return unsubscribe function
    return () => {
      this.subscriptions = this.subscriptions.filter((s) => s !== sub)
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.sendUnsubscribe(channel)
      }
    }
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    this.subscriptions = []
    this.ws?.close()
    this.ws = null
  }

  private sendSubscribe(channel: string): void {
    this.ws?.send(JSON.stringify({ type: 'subscribe', channel }))
  }

  private sendUnsubscribe(channel: string): void {
    this.ws?.send(JSON.stringify({ type: 'unsubscribe', channel }))
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      if (this.subscriptions.length > 0) {
        this.connect()
      }
    }, 3000)
  }
}

/** Singleton WebSocket client */
export const cashWs = new CashWebSocket()
