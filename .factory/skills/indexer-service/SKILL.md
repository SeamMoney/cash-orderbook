---
name: indexer-service
description: Aptos indexer patterns from kraken-prediction-market (Rust gRPC processor) and aptos-polymarket (Geomi no-code indexer, RPC failover, WebSocket). Covers event processing, database schema, checkpointing, and real-time data serving.
user-invocable: true
---

# Indexer Service Patterns

Derived from kraken-prediction-market (Rust/PostgreSQL gRPC indexer) and aptos-polymarket (Geomi + multi-source RPC).

## Architecture Options

### Option A: Rust gRPC Processor (from kraken-prediction-market)

Production-grade, processes raw transaction stream:

```
Aptos gRPC Stream → Rust Processor → PostgreSQL → REST/WebSocket API
```

**Stack**: Rust, tokio, tokio-postgres, deadpool, aptos-indexer-processor-sdk

**Config** (YAML):
```yaml
# config.mainnet.yaml
indexer_grpc_data_service_address: "https://grpc.mainnet.aptoslabs.com:443"
auth_token: "${APTOS_INDEXER_AUTH_TOKEN}"
starting_version: 0
database_url: "postgresql://localhost:5432/cash_orderbook"
# Reconnection settings
indexer_grpc_http2_ping_interval_secs: 60
indexer_grpc_http2_ping_timeout_secs: 10
indexer_grpc_reconnection_timeout_secs: 10
indexer_grpc_reconnection_max_retries: 5
```

**Event extraction from protobuf**:
```rust
pub struct Event {
    pub sequence_number: i64,
    pub creation_number: i64,
    pub account_address: String,
    pub transaction_version: i64,
    pub transaction_block_height: i64,
    pub transaction_unix_ms: i64,
    pub type_: String,              // "{pkg}::module::EventName"
    pub data: serde_json::Value,    // Parsed JSON payload
    pub event_index: i64,
}
```

**Event routing (fast string matching)**:
```rust
pub struct EventTypeKeys {
    pub order_placed: String,      // "{pkg}::orderbook::OrderPlaced"
    pub order_cancelled: String,
    pub trade: String,
    pub position_update: String,
    pub liquidation: String,
    pub price_update: String,
}

impl EventTypeKeys {
    pub fn new(package_addr: &str) -> Self {
        let pkg = |s: &str| format!("{package_addr}::{s}");
        Self {
            order_placed: pkg("orderbook::OrderPlaced"),
            trade: pkg("orderbook::Trade"),
            // ...
        }
    }
}
```

**Checkpoint/resume pattern**:
```rust
// Get last processed version from DB
let db_version = db::get_last_processed_version(&pool).await?;
let starting_version = if db_version > 0 { db_version + 1 } else { cfg_version };

// After each batch — only advance forward (idempotency)
db::update_last_processed_version_checked(&pool, end_version).await?;
```

### Option B: Geomi No-Code Indexer (from aptos-polymarket)

Faster to set up, GraphQL API included:

```
Aptos Events → Geomi Processor → GraphQL API → Frontend
```

**Config** (geomi.ts):
```typescript
export const GEOMI_CONFIG = {
  processorId: 'cash-orderbook-processor',
  graphqlUrl: process.env.GEOMI_GRAPHQL_URL,
  apiKey: process.env.GEOMI_API_KEY,
  table: 'trades',
  columns: {
    tx_hash: { type: 'string', primaryKey: true },
    event_index: { type: 'number', primaryKey: true },
    timestamp: { type: 'string', indexed: true },
    market_address: { type: 'string', indexed: true },
    event_type: { type: 'string', indexed: true },
    maker: { type: 'string' },
    taker: { type: 'string' },
    price: { type: 'string' },          // bigint as string
    quantity: { type: 'string' },
    maker_order_id: { type: 'string' },
    taker_order_id: { type: 'string' },
  },
  indexedEvents: [
    `0x{CONTRACT}::orderbook::Trade`,
    `0x{CONTRACT}::orderbook::OrderPlaced`,
    `0x{CONTRACT}::orderbook::OrderCancelled`,
  ],
};
```

**GraphQL queries**:
```graphql
query LatestTrades($market: String!, $limit: Int!) {
  trades(
    where: { market_address: { _eq: $market } }
    order_by: [{ timestamp: desc }, { event_index: desc }]
    limit: $limit
  ) {
    tx_hash event_index timestamp price quantity event_type maker taker
  }
}
```

## Database Schema (PostgreSQL)

From kraken-prediction-market schema.sql, adapted for orderbook:

```sql
-- Orderbook state snapshots
CREATE TABLE markets (
    pair_id BIGINT PRIMARY KEY,
    base_asset VARCHAR(66) NOT NULL,
    quote_asset VARCHAR(66) NOT NULL,
    lot_size BIGINT NOT NULL,
    tick_size BIGINT NOT NULL,
    min_size BIGINT NOT NULL,
    status VARCHAR(20) DEFAULT 'active',
    created_at TIMESTAMP NOT NULL,
    tx_version BIGINT NOT NULL
);

-- All trades (from Trade events)
CREATE TABLE trades (
    id BIGSERIAL PRIMARY KEY,
    pair_id BIGINT REFERENCES markets(pair_id),
    maker_order_id BIGINT NOT NULL,
    taker_order_id BIGINT NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    quantity DECIMAL(20, 8) NOT NULL,
    maker_addr VARCHAR(66) NOT NULL,
    taker_addr VARCHAR(66) NOT NULL,
    maker_fee DECIMAL(20, 8) NOT NULL DEFAULT 0,
    taker_fee DECIMAL(20, 8) NOT NULL DEFAULT 0,
    is_taker_bid BOOLEAN NOT NULL,
    tx_version BIGINT NOT NULL,
    timestamp TIMESTAMP NOT NULL
);
CREATE INDEX idx_trades_pair ON trades(pair_id, timestamp DESC);
CREATE INDEX idx_trades_maker ON trades(maker_addr, timestamp DESC);
CREATE INDEX idx_trades_taker ON trades(taker_addr, timestamp DESC);

-- Order events (place, cancel, fill)
CREATE TABLE orders (
    order_id BIGINT PRIMARY KEY,
    pair_id BIGINT REFERENCES markets(pair_id),
    owner VARCHAR(66) NOT NULL,
    price DECIMAL(20, 8) NOT NULL,
    original_quantity DECIMAL(20, 8) NOT NULL,
    remaining_quantity DECIMAL(20, 8) NOT NULL,
    is_bid BOOLEAN NOT NULL,
    status VARCHAR(20) DEFAULT 'open',  -- open, filled, cancelled, partial
    tx_version BIGINT NOT NULL,
    placed_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL
);
CREATE INDEX idx_orders_pair ON orders(pair_id, status, price);
CREATE INDEX idx_orders_owner ON orders(owner, status);

-- OHLCV candles (aggregated from trades)
CREATE TABLE candles (
    pair_id BIGINT NOT NULL,
    interval VARCHAR(5) NOT NULL,  -- 1m, 5m, 15m, 1h, 4h, 1d
    open_time TIMESTAMP NOT NULL,
    open DECIMAL(20, 8) NOT NULL,
    high DECIMAL(20, 8) NOT NULL,
    low DECIMAL(20, 8) NOT NULL,
    close DECIMAL(20, 8) NOT NULL,
    volume DECIMAL(20, 8) NOT NULL,
    trade_count INT NOT NULL,
    PRIMARY KEY (pair_id, interval, open_time)
);

-- Checkpoint tracking
CREATE TABLE indexer_state (
    id INT PRIMARY KEY DEFAULT 1,
    last_processed_version BIGINT NOT NULL,
    updated_at TIMESTAMP DEFAULT NOW()
);
```

**Key DB operations (idempotent)**:
```rust
// ON CONFLICT for re-processing safety
INSERT INTO trades (...) VALUES (...)
ON CONFLICT (id) DO NOTHING;

// Version guard
UPDATE indexer_state SET last_processed_version = $1
WHERE last_processed_version < $1;
```

## RPC Configuration

From aptos-polymarket multi-provider failover:

```typescript
// Priority order — try custom first, fall back to public
const RPC_ENDPOINTS = [
  process.env.QUICKNODE_URL,                            // Private (fastest, no rate limits)
  'https://aptos.cash.trading/v1',                      // Custom fullnode
  'https://fullnode.mainnet.aptoslabs.com/v1',          // Aptos Labs (rate limited)
  'https://api.mainnet.aptoslabs.com/v1',               // Aptos Labs API
];

// Rate limiter (from aptos-polymarket)
const rateLimiter = createRateLimiter({ minInterval: 500 }); // 500ms between calls

// Failover pattern
async function aptosCall<T>(fn: (client: Aptos) => Promise<T>): Promise<T> {
  for (const endpoint of RPC_ENDPOINTS) {
    try {
      const client = new Aptos(new AptosConfig({ fullnodeUrl: endpoint }));
      return await fn(client);
    } catch (e) {
      continue; // Try next endpoint
    }
  }
  throw new Error('All RPC endpoints failed');
}
```

## WebSocket Real-Time Feed

From kraken-prediction-market WebSocket server:

```typescript
// Server-side
const wss = new WebSocketServer({ port: 8080 });
const clients = new Set<WebSocket>();

wss.on('connection', (ws) => {
  clients.add(ws);
  // Send snapshot on connect
  ws.send(JSON.stringify({
    type: 'snapshot',
    data: { orderbook: currentBook, recentTrades: last100Trades },
  }));
  ws.on('close', () => clients.delete(ws));
});

function broadcast(event: WSEvent) {
  const msg = JSON.stringify(event);
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) client.send(msg);
  }
}

// Protocol messages
type WSMessage =
  | { type: 'snapshot'; data: { orderbook: OrderBookSnapshot; recentTrades: Trade[] } }
  | { type: 'delta'; data: { side: 'bid' | 'ask'; price: string; qty: string } }
  | { type: 'trade'; data: { price: string; qty: string; side: 'buy' | 'sell'; ts: number } }
  | { type: 'subscribe'; channel: 'orderbook' | 'trades'; pair_id: number }
```

```typescript
// Client-side hook (from kraken-prediction-market)
function useWebSocket(url: string) {
  const [connected, setConnected] = useState(false);
  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    const connect = () => {
      ws.current = new WebSocket(url);
      ws.current.onopen = () => setConnected(true);
      ws.current.onclose = () => {
        setConnected(false);
        setTimeout(connect, 3000); // Auto-reconnect
      };
      ws.current.onmessage = (e) => {
        const msg = JSON.parse(e.data);
        // Route by type...
      };
    };
    connect();
    return () => ws.current?.close();
  }, [url]);
}
```

## Polling Intervals (from aptos-polymarket)

| Data | Interval | Source |
|------|----------|--------|
| Prices | 3 seconds | RPC view functions |
| Orderbook | 1 second | WebSocket delta |
| Trades (Geomi) | 30 seconds | GraphQL (budget) |
| Trades (WS) | Real-time | WebSocket |
| Markets | 30 seconds | RPC |
| Candles | 5 seconds | Aggregated from trades |

## Move Option<T> Handling

From kraken-prediction-market custom type:
```rust
// Move's Option<T> is a 0-or-1 element vector
#[derive(Deserialize)]
struct MoveOption<T> {
    vec: Vec<T>,
}
impl<T> MoveOption<T> {
    fn value(&self) -> Option<&T> { self.vec.first() }
}
```

## Transaction Verification (from aptos-polymarket ralphy-verifier)

```typescript
// Multi-pass verification for submitted transactions
async function verifyTransactions(hashes: string[]) {
  const BATCH_SIZE = 50;
  const MAX_ATTEMPTS = 5;
  const BACKOFF_MS = 5000;

  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const pending = hashes.filter(h => !isFinalized(h));
    for (const batch of chunk(pending, BATCH_SIZE)) {
      const results = await Promise.allSettled(
        batch.map(h => aptos.getTransactionByHash({ transactionHash: h }))
      );
      // Mark confirmed, failed, or still pending
    }
    if (allFinalized()) break;
    await sleep(BACKOFF_MS * Math.pow(2, attempt)); // Exponential backoff
  }
}
```
