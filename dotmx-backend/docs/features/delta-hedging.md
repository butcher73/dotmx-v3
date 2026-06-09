# Delta Hedging Engine (A-Book Model)

**Last Updated:** February 1, 2026
**Status:** ✅ Implementation Complete

---

## 📋 What is Delta Hedging?

**Delta Hedging** (also called **A-Book execution**) is a risk management strategy where you hedge user positions on external exchanges to:

1. **Stay Delta Neutral** - No market risk from user positions
2. **Profit from Fee Spread** - Collect higher fees from users than you pay for hedging

### Business Model

You profit from the **fee spread** between what users pay you and what you pay for hedging:

```
┌──────────────────────────────────────────────────────────────────┐
│                    PROFIT MODEL                                   │
├──────────────────────────────────────────────────────────────────┤
│                                                                   │
│   USER TRADES ON DOTMX                                           │
│   ─────────────────────                                          │
│   User buys 1 BTC @ $50,000                                      │
│   User pays 0.05% taker fee = $25.00                             │
│                                                                   │
│                         ▼                                         │
│                                                                   │
│   DOTMX HEDGES ON BITGET (VIP)                                   │
│   ────────────────────────────                                    │
│   DotMX sells 1 BTC @ $50,000 on Bitget (opposite side)         │
│   DotMX pays 0.02% VIP fee = $10.00                             │
│                                                                   │
│                         ▼                                         │
│                                                                   │
│   PROFIT CALCULATION                                             │
│   ──────────────────                                             │
│   User Fee Collected:     $25.00                                 │
│   Hedge Fee Paid:        -$10.00                                 │
│   ─────────────────────────────                                  │
│   Net Profit:             $15.00 (0.03% of $50k volume)          │
│                                                                   │
│   🚀 At $10M daily volume = $3,000/day profit from fees!         │
│                                                                   │
└──────────────────────────────────────────────────────────────────┘
```

### Fee Comparison

| Your Bitget VIP Tier | Maker Fee | Taker Fee | Your User Fee | Fee Spread | Profit/Trade |
|---------------------|-----------|-----------|---------------|------------|--------------|
| VIP 1               | 0.017%    | 0.042%    | 0.050%        | 0.008%     | $4/$50k      |
| VIP 2               | 0.014%    | 0.038%    | 0.050%        | 0.012%     | $6/$50k      |
| VIP 3               | 0.012%    | 0.035%    | 0.050%        | 0.015%     | $7.50/$50k   |
| VIP 4               | 0.010%    | 0.032%    | 0.050%        | 0.018%     | $9/$50k      |
| VIP 5               | 0.008%    | 0.028%    | 0.050%        | 0.022%     | $11/$50k     |

**Recommendation:** Use **market orders** (pay taker fee) for instant hedging to minimize market risk.

---

## 🏗️ Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                    DOTMX MATCHING ENGINE                        │
│              (Users trade, fills are executed)                  │
└────────────────────────────┬───────────────────────────────────┘
                             │ Trade Event
                             │ (symbol, side, size, price, fee)
                             ▼
┌────────────────────────────────────────────────────────────────┐
│                      HEDGE ENGINE                               │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  1. EXPOSURE TRACKER                                      │  │
│  │     ───────────────────                                   │  │
│  │     Tracks per symbol:                                    │  │
│  │     - userLongSize (users buying)                         │  │
│  │     - userShortSize (users selling)                       │  │
│  │     - netSize = userLong - userShort                      │  │
│  │     - hedgeSize (our Bitget position)                     │  │
│  │     - unhedgedSize = netSize + hedgeSize                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  2. HEDGE DECISION                                        │  │
│  │     ──────────────                                        │  │
│  │     IF |unhedgedSize * price| > threshold:                │  │
│  │       - Users net LONG → we SHORT on Bitget               │  │
│  │       - Users net SHORT → we LONG on Bitget               │  │
│  │                                                           │  │
│  │     Strategy: Realtime / Threshold / Batched             │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  3. BITGET API CLIENT                                     │  │
│  │     ──────────────────                                    │  │
│  │     - HMAC signature authentication                       │  │
│  │     - Place market/limit orders                           │  │
│  │     - Track order fills and fees                          │  │
│  │     - Sync positions periodically                         │  │
│  │     - Retry failed orders                                 │  │
│  └──────────────────────────────────────────────────────────┘  │
│                             │                                   │
│                             ▼                                   │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │  4. PROFIT TRACKER                                        │  │
│  │     ──────────────                                        │  │
│  │     Per symbol:                                           │  │
│  │     - totalUserFees (collected from users)                │  │
│  │     - totalHedgeFees (paid to Bitget)                     │  │
│  │     - netProfit = userFees - hedgeFees                    │  │
│  │     - hedgeCount, avgHedgeSize                            │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │  BITGET FUTURES  │
                    │  (Hedge Venue)   │
                    └─────────────────┘
```

---

## 🎯 Hedging Strategies

### 1. Real-time (Instant Hedge)

Hedge every single user trade immediately.

**Pros:**
- Zero market risk exposure
- Simple to implement
- Best for high-frequency trading

**Cons:**
- High API call frequency
- More hedge fees (no netting)
- Potential rate limits

**Use Case:** High volume exchange with low latency requirements

```typescript
const hedgeEngine = createHedgeEngine(client, {
  strategy: "realtime",
  minHedgeSize: 0.001,  // Minimum size to hedge
  orderType: "market",   // Fast execution
});
```

### 2. Threshold (Risk-Based)

Hedge only when net exposure exceeds a dollar threshold.

**Pros:**
- Fewer hedge trades (lower fees)
- Natural netting of user positions
- Configurable risk tolerance

**Cons:**
- Temporary market risk exposure
- Requires monitoring

**Use Case:** Medium volume exchange, optimal for most cases

```typescript
const hedgeEngine = createHedgeEngine(client, {
  strategy: "threshold",
  exposureThreshold: 10000,  // Hedge when > $10k unhedged
  minHedgeSize: 0.001,
  orderType: "market",
});
```

### 3. Batched (Time-Based)

Aggregate all trades over a time window, then hedge the net.

**Pros:**
- Minimal hedge trades
- Maximum fee savings
- Predictable API usage

**Cons:**
- Higher temporary market risk
- Delayed hedging

**Use Case:** Lower volume exchange, cost-sensitive

```typescript
const hedgeEngine = createHedgeEngine(client, {
  strategy: "batched",
  batchIntervalMs: 5000,  // Hedge every 5 seconds
  minHedgeSize: 0.001,
  orderType: "market",
});
```

---

## 💻 Implementation

### Step 1: Set Up Environment Variables

```bash
# .env
BITGET_API_KEY=your_api_key_here
BITGET_API_SECRET=your_api_secret_here
BITGET_PASSPHRASE=your_passphrase_here
```

### Step 2: Initialize Hedge Engine

```typescript
// apps/hedge-server.ts (or integrate into engine-server)
import {
  createBitgetHedgeClient,
  createHedgeEngine,
  calculateProfitSummary,
} from "@dotmx/marketdata";

async function main() {
  // Create Bitget client
  const bitgetClient = createBitgetHedgeClient({
    baseUrl: "https://api.bitget.com",
    credentials: {
      apiKey: process.env.BITGET_API_KEY!,
      apiSecret: process.env.BITGET_API_SECRET!,
      passphrase: process.env.BITGET_PASSPHRASE!,
    },
    productType: "USDT-FUTURES",
  });

  // Create hedge engine
  const hedgeEngine = createHedgeEngine(bitgetClient, {
    strategy: "threshold",
    exposureThreshold: 5000,     // $5k triggers hedge
    minHedgeSize: 0.001,         // Min 0.001 BTC
    maxPositionSize: 100,        // Risk limit per symbol
    orderType: "market",         // Fast execution
    retryAttempts: 3,            // Retry failed hedges
    positionSyncIntervalMs: 30000, // Sync every 30s
  });

  // Subscribe to events
  hedgeEngine.onEvent((event) => {
    switch (event.type) {
      case "hedge_executed":
        console.log(
          `✅ Hedged ${event.data.symbol}: ${event.data.side} ${event.data.filledSize} @ ${event.data.avgFillPrice}`
        );
        console.log(`   Fee: $${event.data.fee.toFixed(2)}`);
        break;

      case "hedge_failed":
        console.error(`❌ Hedge failed for ${event.data.symbol}: ${event.data.error}`);
        // Alert admin, retry, or fallback
        break;

      case "exposure_update":
        console.log(
          `📊 ${event.data.symbol} exposure: $${event.data.notionalValue.toFixed(2)} (unhedged: ${event.data.unhedgedSize})`
        );
        break;

      case "pnl_update":
        console.log(`💰 ${event.data.symbol} profit: $${event.data.netProfit.toFixed(2)}`);
        break;
    }
  });

  // Start engine
  await hedgeEngine.start();
  console.log("🚀 Hedge Engine started");

  // Check balance
  const balance = await hedgeEngine.getBalance();
  console.log(`💵 Bitget Balance: $${balance.available.toFixed(2)} available`);
}

main().catch(console.error);
```

### Step 3: Integrate with Matching Engine

```typescript
// In your matching engine, after trade execution:
import { hedgeEngine } from "./hedge-server";

// When a trade is filled
function onTradeExecuted(trade: Trade) {
  // ... existing trade processing ...

  // Send to hedge engine
  hedgeEngine.onUserTrade(
    trade.symbol,      // "BTC-USD"
    trade.takerSide,   // "buy" or "sell"
    trade.quantity,    // 0.5
    trade.price,       // 50000
    trade.takerFee     // 25.00 (user paid fee)
  );
}
```

### Step 4: Monitor Profits

```typescript
// API endpoint to check profits
app.get("/api/hedge/stats", async () => {
  const stats = hedgeEngine.getAllStats();
  const summary = calculateProfitSummary(stats);

  return {
    totalUserFees: summary.totalUserFees,
    totalHedgeFees: summary.totalHedgeFees,
    netProfit: summary.netProfit,
    profitMargin: summary.profitMargin,
    feeSpread: summary.feeSpread,
    bySymbol: summary.bySymbol,
  };
});

app.get("/api/hedge/exposure", async () => {
  return hedgeEngine.getAllExposures();
});

app.get("/api/hedge/positions", async () => {
  return hedgeEngine.getHedgePositions();
});
```

---

## 📊 Example Scenarios

### Scenario 1: Users Go Net Long

```
Time 10:00: User A buys 1 BTC @ $50,000 (pays $25 fee)
Time 10:05: User B buys 0.5 BTC @ $50,100 (pays $12.50 fee)
Time 10:10: User C sells 0.3 BTC @ $50,200 (pays $7.50 fee)

Net User Position:
  Long: 1.5 BTC
  Short: 0.3 BTC
  Net: +1.2 BTC (users are net long)

Notional: 1.2 * $50,150 (avg) = $60,180

Hedge Action (threshold > $10k):
  DotMX sells 1.2 BTC @ $50,150 on Bitget (pays $12 fee)

Result:
  - Users collectively long 1.2 BTC
  - DotMX short 1.2 BTC on Bitget
  - Net exposure: 0 (delta neutral)

Profit:
  User fees: $45
  Hedge fees: $12
  Net profit: $33
```

### Scenario 2: Balanced Trading

```
Time 11:00: User A buys 1 BTC @ $50,000
Time 11:05: User B sells 1 BTC @ $50,050

Net User Position: 0 BTC

Hedge Action: None needed (positions netted)

Profit:
  User fees: $50 ($25 + $25)
  Hedge fees: $0
  Net profit: $50 (100% profit!)
```

---

## 🛡️ Risk Management

### Position Limits

```typescript
const hedgeEngine = createHedgeEngine(client, {
  maxPositionSize: 100,  // Max 100 BTC per symbol
  exposureThreshold: 10000,
});
```

If net user position exceeds `maxPositionSize`, reject new orders or warn admin.

### Balance Monitoring

```typescript
// Check if we have enough margin on Bitget
const balance = await hedgeEngine.getBalance();

if (balance.available < requiredMargin) {
  console.error("⚠️ Insufficient margin on Bitget!");
  // Pause hedging or add funds
}
```

### Hedge Failure Handling

```typescript
hedgeEngine.onEvent((event) => {
  if (event.type === "hedge_failed") {
    // Log to monitoring system
    logger.error("Hedge failed", {
      symbol: event.data.symbol,
      error: event.data.error,
    });

    // Alert admin via Telegram/Discord/Email
    alertAdmin(`Hedge failed for ${event.data.symbol}: ${event.data.error}`);

    // Retry manually or use fallback venue (Binance)
    await retryHedgeOnBinance(event.data.symbol);
  }
});
```

### Circuit Breaker

```typescript
// Pause hedging if too many failures
let failureCount = 0;
const MAX_FAILURES = 5;

hedgeEngine.onEvent((event) => {
  if (event.type === "hedge_failed") {
    failureCount++;
    if (failureCount >= MAX_FAILURES) {
      console.error("🚨 Circuit breaker triggered!");
      hedgeEngine.stop();
      alertAdmin("Hedge engine stopped due to failures");
    }
  }

  if (event.type === "hedge_executed") {
    failureCount = 0; // Reset on success
  }
});
```

---

## 📈 Expected Profitability

### Example: $10M Daily Volume

| Metric | Value |
|--------|-------|
| Daily User Volume | $10,000,000 |
| User Fee Rate | 0.05% |
| User Fees Collected | $5,000/day |
| Hedge Fee Rate (VIP 3) | 0.035% |
| Hedge Fees Paid | $3,500/day |
| **Net Profit** | **$1,500/day** |
| **Monthly Profit** | **$45,000** |
| **Annual Profit** | **$547,500** |

### Scaling with Volume

| Daily Volume | Net Profit/Day | Monthly | Annual |
|--------------|----------------|---------|---------|
| $1M | $150 | $4,500 | $54,750 |
| $5M | $750 | $22,500 | $273,750 |
| $10M | $1,500 | $45,000 | $547,500 |
| $50M | $7,500 | $225,000 | $2,737,500 |
| $100M | $15,000 | $450,000 | $5,475,000 |

**Note:** Assumes 0.015% fee spread (0.05% user - 0.035% hedge VIP 3)

---

## 🔧 Advanced Features

### Multi-Venue Hedging

Use multiple exchanges for redundancy:

```typescript
const bitgetClient = createBitgetHedgeClient(bitgetConfig);
const binanceClient = createBinanceHedgeClient(binanceConfig);

// Primary hedge on Bitget
const primaryHedge = createHedgeEngine(bitgetClient, {
  strategy: "threshold",
  exposureThreshold: 5000,
});

// Fallback hedge on Binance
const fallbackHedge = createHedgeEngine(binanceClient, {
  strategy: "realtime",
});

// If Bitget fails, use Binance
primaryHedge.onEvent((event) => {
  if (event.type === "hedge_failed") {
    fallbackHedge.forceHedge(event.data.symbol);
  }
});
```

### Smart Order Routing

Use limit orders during low volatility for better prices:

```typescript
const hedgeEngine = createHedgeEngine(client, {
  orderType: "limit",
  limitOrderOffset: 0.01,  // 0.01% better than mid

  // Fallback to market if limit not filled in 5s
  limitOrderTimeoutMs: 5000,
});
```

### PnL Reporting

```typescript
// Generate daily report
setInterval(async () => {
  const stats = hedgeEngine.getAllStats();
  const summary = calculateProfitSummary(stats);

  await sendDailyReport({
    date: new Date().toISOString(),
    netProfit: summary.netProfit,
    profitMargin: summary.profitMargin,
    hedgeCount: stats.reduce((sum, s) => sum + s.hedgeCount, 0),
    bySymbol: summary.bySymbol,
  });

  // Reset daily stats (optional)
}, 24 * 60 * 60 * 1000);
```

---

## 🚀 Deployment Checklist

- [ ] Set up Bitget VIP account
- [ ] Generate API keys with futures trading permission
- [ ] Set environment variables
- [ ] Test hedge engine on testnet/small volumes
- [ ] Set up monitoring and alerts
- [ ] Configure circuit breakers
- [ ] Integrate with matching engine
- [ ] Set appropriate thresholds and limits
- [ ] Test failure scenarios
- [ ] Monitor first few hedges closely
- [ ] Set up daily PnL reports
- [ ] Document operational procedures

---

## 📚 Related Documentation

- [Market Data Implementation](market-data-implementation.md) - Market data feeds
- [Engine Architecture](../architecture/Engine-Architecture.md) - Matching engine
- [Risk Management](../architecture/Risk-Management.md) - Risk checks

---

**Document Version:** 1.0
**Author:** DotMX Team
