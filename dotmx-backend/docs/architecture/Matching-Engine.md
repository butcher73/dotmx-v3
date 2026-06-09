# Matching Engine & Order Execution

## Overview

The **Engine Server** (Port 3001) is the core matching engine responsible for:
- Processing incoming order commands
- Matching orders against the orderbook
- Maintaining deterministic order execution
- Emitting events for every state change
- Enabling event replay and recovery

**Architecture:** Per-market shards with FIFO command ordering  
**Language:** TypeScript (with Rust option for performance)  
**Throughput:** ~100K orders/sec per shard

---

## Core Architecture

### Market Shard Structure

Each market symbol (e.g., BTC-USD) runs on a dedicated shard:

```
Shard "BTC-USD"
├── In-Memory Orderbook
│   ├── BID Price Levels (Red-Black Tree)
│   │   └── Orders at each level (FIFO Queue)
│   └── ASK Price Levels (Red-Black Tree)
│       └── Orders at each level (FIFO Queue)
├── Command Queue (FIFO)
├── Event Emitter
└── Risk Validator
```

### Single-Writer Architecture

- Each shard processes commands sequentially (FIFO)
- No locks needed - single event loop
- Guarantees deterministic order
- State is 100% reproducible

---

## Order Processing Pipeline

```
1. Command Validation
   ↓
2. Risk Checks (Fast-Path)
   ├─ Margin requirement
   ├─ Liquidation level
   ├─ Price volatility
   └─ Order quantity limits
   ↓
3. Order Acceptance Event
   ↓
4. Matching Loop
   ├─ Get best bid/ask
   ├─ Check price levels
   ├─ Match at maker price
   ├─ Generate fills
   └─ Update orderbook
   ↓
5. Order State Events
   ├─ OrderFilled (if 100% fill)
   ├─ OrderPartiallyFilled (if partial)
   └─ OrderAccepted (if rest rests on book)
   ↓
6. Event Journal (Persist)
   ↓
7. Broadcast to Market Data
```

---

## Matching Algorithm: Price-Time Priority

### Buy Order Matching

```typescript
function matchBuyOrder(book: Orderbook, order: Order) {
  while (order.remaining > 0) {
    const bestAsk = book.getBestAsk();
    
    // Price check: can only match asks <= order price
    if (bestAsk.price > order.price) break;
    
    // Get first ask at this level (FIFO)
    const makerOrder = bestAsk.orders[0];
    
    // Self-trade prevention
    if (makerOrder.userId === order.userId) {
      // Apply STP mode (cancel maker/taker/both)
    }
    
    // Calculate fill
    const fillQty = min(order.remaining, makerOrder.remaining);
    
    // Execute trade at maker's price
    trade = createTrade(order, makerOrder, fillQty, makerOrder.price);
    
    // Update both orders
    updateOrder(order, fillQty);
    updateOrder(makerOrder, fillQty);
  }
}
```

### Key Principles

1. **Price Priority**: Best priced orders match first
   - BUY orders match lowest ASKs first
   - SELL orders match highest BIDs first

2. **Time Priority**: Within a price level, FIFO
   - Orders at same price match in submission order
   - Never reorder makers

3. **Maker Price**: Trades execute at maker's price, not taker's
   - Ensures price-time priority is fair
   - Market makers are rewarded for liquidity

---

## Order Types Supported

### Limit Orders

```json
{
  "type": "LIMIT",
  "side": "BUY",
  "price": 50000.00,
  "quantity": 1.5,
  "timeInForce": "GTC"  // Good-Till-Canceled
}
```

- Rest on book if not fully matched
- Respected price level
- Can be canceled at any time

### Market Orders

```json
{
  "type": "MARKET",
  "side": "SELL",
  "quantity": 0.5
}
```

- Match immediately at best available prices
- No limit price (sweeps multiple levels)
- Fails if insufficient liquidity

### Time-In-Force Options

- **GTC** (Good-Till-Canceled): Rest until canceled
- **IOC** (Immediate-or-Cancel): Match now, cancel rest
- **FOK** (Fill-or-Kill): Match entire order or reject

---

## Risk Management

### Pre-Acceptance Checks (Fast-Path)

Run before accepting any order to prevent toxic behavior:

1. **Margin Requirement**
   ```
   margin_needed = order.notional / leverage
   if (account.balance < margin_needed) {
     reject(INSUFFICIENT_BALANCE)
   }
   ```

2. **Liquidation Protection**
   ```
   new_leverage = account.leverage + order.leverage_impact
   if (new_leverage > max_leverage) {
     reject(LEVERAGE_TOO_HIGH)
   }
   ```

3. **Price Volatility Check**
   ```
   price_change = abs(order.price - markPrice) / markPrice
   if (price_change > volatility_threshold) {
     reject(PRICE_TOO_FAR)
   }
   ```

4. **Order Quantity Limits**
   ```
   if (order.quantity > max_order_size) {
     reject(ORDER_TOO_LARGE)
   }
   ```

### Post-Matching Checks

After matching completes:

1. **Mark-to-Market Check**: Verify positions don't exceed leverage
2. **Bankruptcy Check**: Ensure account doesn't go below minimum balance
3. **Liquidation Trigger**: Mark account if maintenance margin breached

---

## Self-Trade Prevention (STP)

Prevent same user from being both sides of a trade:

```typescript
// Check when about to match
if (taker.userId === maker.userId) {
  switch (stpMode) {
    case "CANCEL_MAKER":
      // Cancel the passive order, continue matching
      cancelOrder(maker);
      break;
    
    case "CANCEL_TAKER":
      // Cancel the incoming order, stop matching
      reject(order);
      break;
    
    case "CANCEL_BOTH":
      // Cancel both orders
      cancelOrder(maker);
      reject(order);
      break;
    
    case "NONE":
      // Allow self-trades
      executeTrade();
  }
}
```

Configurable per market.

---

## Event Model

Every significant action emits an event (immutable, append-only):

```typescript
type Event = 
  | OrderAcceptedEvent
  | TradeEvent
  | OrderPartiallyFilledEvent
  | OrderFilledEvent
  | OrderCanceledEvent
  | OrderRejectEvent;

interface OrderAcceptedEvent {
  type: "ORDER_ACCEPTED";
  orderId: string;
  userId: string;
  symbol: string;
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  sequenceId: number;
  timestamp: number;
}

interface TradeEvent {
  type: "TRADE";
  tradeId: string;
  makerOrderId: string;
  takerOrderId: string;
  price: number;
  quantity: number;
  sequenceId: number;
  timestamp: number;
}
```

### Event Sequencing

- Each event gets a **sequenceId** (total order across engine)
- Events are **append-only** (no modifications)
- Enables **deterministic replay** for recovery
- Enables **audit trail** for compliance

---

## Orderbook Data Structure

### Price Levels (Red-Black Tree)

```
BID Side                       ASK Side
50000 [qty: 5]                50010 [qty: 3]
49990 [qty: 2.5]              50020 [qty: 1.5]
49980 [qty: 10]               50030 [qty: 5]
...
```

- **O(log n)** insertion/deletion by price
- **O(1)** best bid/ask lookup
- **O(k)** depth snapshot (k = depth)

### Orders at Each Level (Queue)

```
Price Level 50000:
  Order-1 (qty: 2, time: 10:00:00)
  Order-2 (qty: 3, time: 10:00:05)  ← Matches first
```

- FIFO queue ensures time priority
- **O(1)** removal of first order (matched)
- Partial fills update quantity in-place

---

## State Management

### Shard State Snapshot

```typescript
interface ShardState {
  symbol: string;
  sequenceId: number;         // Latest event sequence
  orderCount: number;         // Total active orders
  bidLevels: number;          // Bid price levels
  askLevels: number;          // Ask price levels
  totalBidQty: number;        // Total bid quantity
  totalAskQty: number;        // Total ask quantity
  midPrice: number | null;    // (best bid + best ask) / 2
  timestamp: number;
}
```

### Order State Tracking

```typescript
interface Order {
  orderId: string;
  userId: string;
  symbol: string;
  side: "BUY" | "SELL";
  type: "LIMIT" | "MARKET";
  price: number;
  quantity: number;           // Original quantity
  quantityRemaining: number;  // Not yet matched
  timeInForce: "GTC" | "IOC" | "FOK";
  sequenceId: number;         // When order was accepted
  timestamp: number;          // Order submission time
}
```

---

## Cancellation

```typescript
function cancelOrder(orderId: string): Event {
  const order = book.getOrder(orderId);
  
  if (!order) {
    return emitOrderReject(orderId, "NOT_FOUND");
  }
  
  if (order.quantityRemaining === 0) {
    return emitOrderReject(orderId, "ALREADY_FILLED");
  }
  
  // Remove from book
  removeOrder(book, orderId);
  
  // Emit event
  return emitOrderCanceled(orderId, order.quantityRemaining);
}
```

---

## Performance

### Benchmarks

```
Operation              Latency (μs)    Throughput
─────────────────────────────────────────────────
Order Insertion        5-15            200K orders/s
Orderbook Snapshot     10-50           20K snapshots/s
Order Matching         20-100          50K orders/s
Order Cancellation     3-10            300K cancels/s
```

### Optimization Techniques

1. **Tick-level Precision**: Prices stored as integers (avoids floats)
2. **No Allocations**: Pool orders/trades to avoid GC
3. **SIMD Matching**: Vectorized fill calculations
4. **Lock-free Reads**: Snapshots don't block matching

---

## Recovery & Replay

### Event Journal

Every shard persists events to append-only log:

```
BTC-USD.log:
[seq:1] OrderAccepted(order-123, ...)
[seq:2] TradeEvent(order-123 vs order-456, ...)
[seq:3] OrderPartiallyFilled(order-123, ...)
[seq:4] OrderAccepted(order-789, ...)
...
```

### Recovery Process

```
1. Load latest snapshot
2. Replay all events since snapshot
3. Rebuild in-memory orderbook
4. Resume from last sequence
```

Time: <100ms for typical recovery

---

## Configuration

```env
# Engine
ENGINE_PORT=3001
ENGINE_HOST=0.0.0.0

# Symbols & Shards
SYMBOLS=BTC-USD,ETH-USD,SOL-USD
NUM_SHARDS=4

# Risk
MAX_LEVERAGE=20
MAINTENANCE_MARGIN=0.05
INITIAL_MARGIN=0.1

# Self-Trade Prevention
STP_MODE=CANCEL_MAKER  # or CANCEL_TAKER, CANCEL_BOTH, NONE

# Performance
SNAPSHOT_INTERVAL_MS=60000  # Snapshots every 60s
MAX_ORDER_SIZE=1000
PRICE_VOLATILITY_THRESHOLD=0.1  # 10%

# Persistence
JOURNAL_DIR=/var/lib/dotmx/journal
SNAPSHOT_DIR=/var/lib/dotmx/snapshots
```

---

## Related Documentation

- [Orderbook Data Structures](./Orderbook-Design.md)
- [Event Model & Sequencing](../architecture/06_EVENT_MODEL_SEQUENCING.md)
- [Risk Management](./Risk-Management.md)
- [Persistence & Recovery](../architecture/07_PERSISTENCE_REPLAY.md)
