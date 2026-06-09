# Real-Time Market Data Streaming

## Overview

The **Market Data Server** (Port 3002) provides real-time market information to clients via REST and WebSocket. It maintains live orderbook snapshots, aggregates trades, and broadcasts updates with sub-second latency.

**Framework:** ElysiaJS + Fanout (in-memory or Redis-backed)
**Throughput:** 50K+ concurrent WebSocket clients per instance
**Latency:** <100ms updates to clients

---

## Architecture

### Component Stack

```
Shard Events (from Engine)
        ↓
L2 Book Builder
├─ Aggregates order levels
├─ Calculates mid-price
└─ Detects level changes (deltas)
        ↓
Fanout Service
├─ Maintains subscriptions
├─ Batches updates (50-100ms windows)
└─ Broadcasts to WebSocket clients
        ↓
WebSocket Handler (ElysiaJS)
├─ Connection management
├─ Subscription routing
├─ Message serialization
└─ Rate limiting per client
        ↓
Connected Clients
(Web browsers, mobile apps, trading bots)
```

### Data Flows

**Snapshot Model (Binance-Compatible):**
- Client subscribes → Server sends full L2 snapshot
- Server broadcasts incremental diffs after snapshot
- Client reconstructs orderbook locally using diffs

```json
// Snapshot Message
{
  "type": "snapshot",
  "symbol": "BTC-USD",
  "bids": [[50000, 5], [49990, 2.5]],
  "asks": [[50010, 3], [50020, 1.5]],
  "sequenceId": 12345,
  "timestamp": 1705856400000
}

// Delta Message
{
  "type": "delta",
  "symbol": "BTC-USD",
  "bids": [[50001, 3]],    // Updated quantity at price
  "asks": [[50020, 0]],    // Removed level (qty = 0)
  "sequenceId": 12346,
  "timestamp": 1705856401000
}
```

---

## L2 Orderbook Builder

### Purpose

Converts raw engine events (individual fills, cancellations) into aggregated L2 snapshots:

```typescript
class L2BookBuilder {
  private symbol: string;
  private bids: Map<price, quantity>;  // Red-Black Tree
  private asks: Map<price, quantity>;
  private lastSnapshot: L2Book;

  // Process engine events
  onTrade(trade: Trade) {
    // Update both sides affected
    this.adjustLevel(trade.makerSide, trade.price, -trade.quantity);
    if (maker not filled) {
      this.addLevel(trade.makerSide, trade.price, newQty);
    }
  }

  onOrderAccepted(order: Order) {
    this.addLevel(order.side, order.price, order.quantity);
  }

  onOrderCanceled(orderId: string) {
    this.removeOrder(orderId);  // Adjust affected level
  }

  // Get snapshot for client
  getSnapshot(depth: number): L2Book {
    return {
      symbol: this.symbol,
      bids: this.getBestBids(depth),
      asks: this.getBestAsks(depth),
      sequenceId: this.lastSeq,
      timestamp: now(),
    };
  }
}
```

### Depth Snapshots

```
GET /orderbook/BTC-USD?depth=20

{
  "symbol": "BTC-USD",
  "bids": [
    [50000.00, 5.5],      // price, quantity
    [49990.50, 2.0],
    [49980.25, 10.0],
    ...
  ],
  "asks": [
    [50010.00, 3.0],
    [50020.50, 1.5],
    ...
  ],
  "timestamp": 1705856400000
}
```

---

## WebSocket Protocol

### Connection Lifecycle

```
Client → Server: WebSocket handshake
Server: Connection established (200ms)
        ↓
Client → Server: {"action": "subscribe", "symbols": ["BTC-USD"]}
Server → Client: {"type": "subscribed", "symbols": ["BTC-USD"]}
Server → Client: Full snapshot for BTC-USD
        ↓
[Continuous Updates]
Server → Client: {"type": "delta", ...}  (every 50-100ms)
Server → Client: {"type": "trade", ...}
Server → Client: {"type": "ticker", ...}
        ↓
Client → Server: {"action": "unsubscribe", "symbols": ["BTC-USD"]}
Server → Client: {"type": "unsubscribed", ...}
```

### Message Types

#### Subscribe Request
```json
{
  "action": "subscribe",
  "symbols": ["BTC-USD", "ETH-USD"],
  "channels": ["depth", "trade"]  // optional, defaults to all
}
```

#### Snapshot
```json
{
  "type": "snapshot",
  "symbol": "BTC-USD",
  "bids": [[50000, 5], [49990, 2.5]],
  "asks": [[50010, 3], [50020, 1.5]],
  "sequenceId": 100,
  "timestamp": 1705856400000
}
```

#### Delta Update
```json
{
  "type": "delta",
  "symbol": "BTC-USD",
  "bidDelta": [[50001, 3]],   // [price, new_quantity]
  "askDelta": [[50020, 0]],   // 0 quantity = remove level
  "sequenceId": 101,
  "timestamp": 1705856450000
}
```

#### Trade
```json
{
  "type": "trade",
  "symbol": "BTC-USD",
  "price": 50000.50,
  "quantity": 1.5,
  "side": "BUY",              // taker side
  "timestamp": 1705856451000,
  "sequenceId": 102
}
```

#### Ticker (24h Statistics)
```json
{
  "type": "ticker",
  "symbol": "BTC-USD",
  "lastPrice": 50000.50,
  "priceChange": 1500.00,
  "priceChangePercent": 3.09,
  "highPrice": 51000.00,
  "lowPrice": 48500.00,
  "volume": 1250.5,           // 24h volume in base asset
  "quoteVolume": 62252500,    // 24h volume in quote asset
  "openPrice": 48500.00,
  "timestamp": 1705856451000
}
```

#### Kline (Candlestick)
```json
{
  "type": "kline",
  "symbol": "BTC-USD",
  "interval": "1m",
  "open": 50000.00,
  "high": 50100.00,
  "low": 49900.00,
  "close": 50050.00,
  "volume": 125.3,
  "quoteVolume": 6256750,
  "timestamp": 1705856451000,
  "isFinal": true             // false = still building candle
}
```

### Unsubscribe Request
```json
{
  "action": "unsubscribe",
  "symbols": ["BTC-USD"]
}
```

---

## Fanout Service

### Purpose

Efficiently broadcasts market data updates to many subscribers:

```typescript
interface MarketDataFanout {
  // Subscribe client to symbol updates
  subscribe(
    clientId: string,
    symbol: string,
    handler: (message: MarketDataMessage) => void
  ): void;

  // Unsubscribe client from symbol
  unsubscribe(clientId: string, symbol: string): void;

  // Publish update (called by L2 builder)
  publish(symbol: string, message: MarketDataMessage): void;

  // Get latest snapshot
  getSnapshot(symbol: string, depth?: number): L2Book;

  // Get subscription count for monitoring
  getSubscriptionCount(symbol: string): number;
}
```

### Memory-Based Implementation (Single Server)

```typescript
class MemoryFanout implements MarketDataFanout {
  private subscriptions: Map<
    string,  // symbol
    {
      subscribers: Map<string, Handler>;  // clientId → handler
      lastSnapshot: L2Book;
    }
  > = new Map();

  subscribe(clientId: string, symbol: string, handler: Handler) {
    let sub = this.subscriptions.get(symbol);
    if (!sub) {
      sub = { subscribers: new Map(), lastSnapshot: null };
      this.subscriptions.set(symbol, sub);
    }
    sub.subscribers.set(clientId, handler);
  }

  publish(symbol: string, message: MarketDataMessage) {
    const sub = this.subscriptions.get(symbol);
    if (!sub) return;

    // Broadcast to all subscribers
    for (const [clientId, handler] of sub.subscribers) {
      handler(message);
    }
  }
}
```

### Redis-Based Implementation (Multi-Server)

For horizontal scaling, use Redis Pub/Sub:

```typescript
class RedisFanout implements MarketDataFanout {
  private redis: RedisClient;
  private localSubscriptions: Map<string, Set<Handler>> = new Map();

  async subscribe(clientId: string, symbol: string, handler: Handler) {
    // Local tracking
    let subs = this.localSubscriptions.get(symbol) ?? new Set();
    subs.add(handler);
    this.localSubscriptions.set(symbol, subs);

    // Redis subscription (once per symbol per server)
    if (subs.size === 1) {
      this.redis.subscribe(`md:${symbol}`, (message) => {
        subs.forEach(h => h(message));
      });
    }
  }

  async publish(symbol: string, message: MarketDataMessage) {
    // Publish to all servers' subscribers
    await this.redis.publish(`md:${symbol}`, JSON.stringify(message));
  }
}
```

---

## Performance Optimization

### Update Batching

Instead of sending every single order update:

```
Without batching:
[50ms] Order 1 matched → Send delta
[52ms] Order 2 matched → Send delta
[53ms] Order 3 matched → Send delta
Total: 3 messages in 3ms

With 50ms batching:
[0ms-50ms] Collect all changes
[50ms] Aggregate into single delta → Send to all clients
[100ms] Aggregate next batch → Send
Total: 1 message per 50ms
```

**Benefits:**
- Network bandwidth: 10-100x reduction
- Server CPU: Lower context switches
- Client processing: Fewer re-renders

### Lazy Snapshot Building

```typescript
// Don't recalculate snapshot for every request
let cachedSnapshot: L2Book | null = null;
let lastSnapshotSeq = -1;

onOrderEvent() {
  currentSeq++;
  if (lastSnapshotSeq < currentSeq - SNAPSHOT_INVALIDATION) {
    // Invalidate cache
    cachedSnapshot = null;
  }
}

getSnapshot(depth: number): L2Book {
  if (!cachedSnapshot) {
    // Only rebuild when needed
    cachedSnapshot = this.buildSnapshot(depth);
    lastSnapshotSeq = currentSeq;
  }
  return cachedSnapshot;
}
```

### Connection Pooling

- Reuse connections: ~1ms per message vs 50ms new connection
- Keep-alive: Detect/remove dead clients
- Backpressure: Detect slow clients, limit send rate

---

## Monitoring & Metrics

### Key Metrics

```
Market Data Server Metrics:
├─ Connections
│  ├─ Active WebSocket connections
│  ├─ Connection rate (new/sec)
│  └─ Churn rate (closed/sec)
├─ Messages
│  ├─ Snapshots sent
│  ├─ Deltas sent
│  ├─ Trades sent
│  └─ Bytes per second
├─ Performance
│  ├─ Snapshot generation latency (p50, p99)
│  ├─ Delta generation latency
│  ├─ Message send latency
│  └─ Client receive latency
└─ Health
   ├─ Memory usage
   ├─ CPU utilization
   └─ Error rate
```

---

## Configuration

```env
# Server
PORT=3002
HOST=0.0.0.0

# Market Data
SYMBOLS=BTC-USD,ETH-USD,SOL-USD
DEFAULT_DEPTH=20

# Updates
SNAPSHOT_BATCH_MS=50      # Batch updates every 50ms
THROTTLE_FAST_CLIENTS=true
MAX_MESSAGE_PER_SEC=100

# WebSocket
WS_MAX_CONNECTIONS=50000
WS_SEND_TIMEOUT_MS=5000
IDLE_CONNECTION_TIMEOUT_MS=300000  # 5 minutes

# Fanout
FANOUT_TYPE=memory        # or "redis"
REDIS_URL=redis://localhost:6379
```

---

## Running the Market Data Server

```bash
# Standalone
bun run dev:marketdata

# All services together
bun run dev:all
```

---

## Related Documentation

- [API Gateway](./API-Gateway.md)
- [Matching Engine](./Matching-Engine.md)
[Event Model](Event-Sequencing.md)
