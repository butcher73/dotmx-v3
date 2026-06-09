# Market Data Implementation Guide

**Last Updated:** February 1, 2026  
**Status:** ✅ Core Components Complete

---

## 📋 Overview

The market data system provides real-time market information for the trading platform. Since internal orderbooks may have low liquidity initially, we integrate with external exchanges (Binance, Bitget) to provide professional-looking market data.

---

## 🎯 Core Features

### 1. Mark Price Calculation

Mark price is the "fair price" used for liquidations and funding rate calculations:

```
┌─────────────────────────────────────────────────────────────────┐
│                    MARK PRICE CALCULATION                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Internal Orderbook          External Exchanges                │
│   ────────────────           ──────────────────                 │
│   • Mid Price                 • Binance Mark Price              │
│   • Spread                    • Bitget Mark Price               │
│   • Depth                     • Index Price                     │
│   • Last Trade                • Funding Rate                    │
│          │                              │                        │
│          └──────────────┬───────────────┘                        │
│                         ▼                                        │
│              ┌─────────────────────┐                            │
│              │  Mark Price Service │                            │
│              │                     │                            │
│              │  Hybrid Calculation:│                            │
│              │  30% internal       │                            │
│              │  70% external       │                            │
│              │  (when book healthy)│                            │
│              └─────────────────────┘                            │
│                         │                                        │
│                         ▼                                        │
│   Used For: Liquidations, Funding Rate, Risk Checks             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 2. External Price Feeds

Fetches real-time data from major exchanges:

- **Binance Futures**: Mark price, index price, 24h ticker, orderbook, trades, klines
- **Bitget Futures**: Mark price, index price, 24h ticker, orderbook, trades, klines

### 3. Ticker Aggregation (24h Stats)

Calculates rolling 24-hour statistics:
- Last price, high, low
- Volume (base + quote)
- Price change & percentage
- VWAP, trade count

### 4. Kline/Candlestick Aggregation

Builds OHLCV candles from trades:
- Intervals: 1m, 5m, 15m, 1h, 4h, 1d, 1w
- Real-time updates
- Historical storage

---

## ✅ Implementation Status

### Core Components

| Component | Status | Location | Description |
|-----------|--------|----------|-------------|
| L2 Book Builder | ✅ Complete | `packages/marketdata/src/builder/` | Aggregates orderbook from events |
| Fanout Service | ✅ Complete | `packages/marketdata/src/fanout/` | Memory/Redis pub-sub for WebSocket |
| Throttle | ✅ Complete | `packages/marketdata/src/throttle/` | Rate limiting, batching |
| External Price Feed | ✅ Complete | `packages/marketdata/src/external/` | Binance/Bitget WebSocket + REST |
| Ticker Aggregator | ✅ Complete | `packages/marketdata/src/ticker/` | 24h stats calculation |
| Kline Aggregator | ✅ Complete | `packages/marketdata/src/kline/` | OHLCV candlestick builder |
| Mark Price Service | ✅ Complete | `packages/marketdata/src/markprice/` | Hybrid price calculation |

### API Endpoints

| Endpoint | Status | Description |
|----------|--------|-------------|
| `GET /orderbook/:symbol` | ✅ Complete | L2 orderbook snapshot |
| `GET /symbols` | ✅ Complete | List trading pairs |
| `GET /v1/depth` | 🔲 TODO | Standard depth endpoint |
| `GET /v1/ticker/24hr` | 🔲 TODO | 24h ticker stats |
| `GET /v1/ticker/price` | 🔲 TODO | Current price |
| `GET /v1/klines` | 🔲 TODO | Historical candlesticks |
| `GET /v1/trades` | 🔲 TODO | Recent trades |
| `GET /v1/markPrice` | 🔲 TODO | Mark & index price |
| `GET /v1/fundingRate` | 🔲 TODO | Funding rate info |

### WebSocket Streams

| Stream | Status | Description |
|--------|--------|-------------|
| Orderbook snapshot | ✅ Complete | Initial L2 state |
| Orderbook deltas | ✅ Complete | Incremental updates |
| Trades | 🔲 TODO | Real-time trades |
| Ticker | 🔲 TODO | 24h rolling stats |
| Klines | 🔲 TODO | Real-time candles |
| Mark Price | 🔲 TODO | Mark/index/funding |

---

## 🔄 Integration Guide

### Step 1: Initialize External Feeds

```typescript
// apps/marketdata-server.ts

import {
  createBinanceFeed,
  createBitgetFeed,
  createPriceFeedManager,
  createMarkPriceService,
  createTickerStore,
  createKlineStore,
} from "@dotmx/marketdata";

// Initialize external price feeds
const feedManager = createPriceFeedManager();
feedManager.addFeed(createBinanceFeed());
feedManager.addFeed(createBitgetFeed());

// Initialize mark price service
const markPriceService = createMarkPriceService({
  internalWeight: 0.3,          // 30% internal
  minOrderbookDepth: 10000,     // $10k depth required
  maxSpread: 0.005,             // 0.5% max spread
  externalPriceTtl: 10000,      // 10s TTL
});

// Initialize ticker store
const tickerStore = createTickerStore();
tickerStore.start();

// Initialize kline store
const klineStore = createKlineStore({
  intervals: ["1m", "5m", "15m", "1h", "4h", "1d"],
  maxCandlesPerInterval: 500,
});
klineStore.start();

// Connect feeds to mark price
feedManager.onPriceUpdate((data) => {
  markPriceService.updateExternalPrice(data);
  
  // Also update ticker with external data
  tickerStore.setExternalTicker(data.symbol, {
    lastPrice: data.lastPrice,
    high24h: data.high24h,
    low24h: data.low24h,
    volume24h: data.volume24h,
    priceChange24h: data.priceChange24h,
    priceChangePercent24h: data.priceChangePercent24h,
  });
});

// Start feeds for all symbols
await feedManager.start(["BTC-USD", "ETH-USD", "SOL-USD"]);
```

### Step 2: Update Engine with Mark Price

```typescript
// Update matching engine shards with mark price for risk checks
markPriceService.onUpdate((data) => {
  const shard = shardManager.getShard(data.symbol);
  if (shard) {
    shard.setMarkPrice(data.markPrice);
  }
});
```

### Step 3: Connect Internal Trades

```typescript
// When trades execute in matching engine
function onTradeExecuted(trade: Trade) {
  // Update mark price with internal data
  markPriceService.updateLastTrade(
    trade.symbol,
    trade.price,
    trade.timestamp
  );
  
  // Update ticker aggregator
  tickerStore.onTrade(trade.symbol, {
    symbol: trade.symbol,
    price: trade.price,
    quantity: trade.quantity,
    timestamp: trade.timestamp,
  });
  
  // Update kline aggregator
  klineStore.onTrade(trade.symbol, {
    symbol: trade.symbol,
    price: trade.price,
    quantity: trade.quantity,
    timestamp: trade.timestamp,
  });
}
```

### Step 4: Add REST API Endpoints

```typescript
// GET /v1/ticker/24hr
app.get("/v1/ticker/24hr", async ({ query }) => {
  const { symbol } = query;
  
  // Try internal ticker first, fallback to external
  const ticker = tickerStore.getTicker(symbol);
  
  if (!ticker) {
    return { error: "Symbol not found" };
  }
  
  return {
    symbol: ticker.symbol,
    lastPrice: ticker.lastPrice.toString(),
    high24h: ticker.high24h.toString(),
    low24h: ticker.low24h.toString(),
    volume: ticker.volume24h.toString(),
    volumeQuote: ticker.volumeQuote24h.toString(),
    priceChange: ticker.priceChange24h.toString(),
    priceChangePercent: ticker.priceChangePercent24h.toFixed(2) + "%",
    vwap: ticker.vwap24h.toString(),
    trades: ticker.trades24h,
  };
});

// GET /v1/ticker/price
app.get("/v1/ticker/price", async ({ query }) => {
  const { symbol } = query;
  const ticker = tickerStore.getTicker(symbol);
  
  return {
    symbol,
    price: ticker?.lastPrice.toString() ?? "0",
  };
});

// GET /v1/markPrice
app.get("/v1/markPrice", async ({ query }) => {
  const { symbol } = query;
  const data = markPriceService.getMarkPriceData(symbol);
  
  if (!data) {
    return { error: "Symbol not found" };
  }
  
  return {
    symbol: data.symbol,
    markPrice: data.markPrice.toString(),
    indexPrice: data.indexPrice.toString(),
    lastPrice: data.lastPrice.toString(),
    fundingRate: data.fundingRate.toString(),
    nextFundingTime: data.nextFundingTime,
    source: data.source,
    confidence: data.confidence,
  };
});

// GET /v1/klines
app.get("/v1/klines", async ({ query }) => {
  const { symbol, interval, limit = 100 } = query;
  
  // Get internal klines
  let klines = klineStore.getCandles(symbol, interval, limit);
  
  // If not enough internal data, fetch from external
  if (klines.length < limit / 2) {
    const external = await feedManager.feeds.get("binance")
      ?.fetchKlines(symbol, interval, limit);
    
    if (external) {
      // Merge internal and external (prefer internal for recent)
      klines = [...external, ...klines]
        .sort((a, b) => a.openTime - b.openTime)
        .slice(-limit);
    }
  }
  
  return klines.map((k) => [
    k.openTime,
    k.open.toString(),
    k.high.toString(),
    k.low.toString(),
    k.close.toString(),
    k.volume.toString(),
    k.closeTime,
    k.volumeQuote?.toString() ?? "0",
    k.trades,
  ]);
});

// GET /v1/fundingRate
app.get("/v1/fundingRate", async ({ query }) => {
  const { symbol } = query;
  const markData = markPriceService.getMarkPriceData(symbol);
  
  return {
    symbol,
    fundingRate: markData?.fundingRate.toString() ?? "0",
    fundingTime: markData?.nextFundingTime ?? 0,
    markPrice: markData?.markPrice.toString() ?? "0",
    indexPrice: markData?.indexPrice.toString() ?? "0",
  };
});
```

### Step 5: Add WebSocket Streams

```typescript
// WebSocket connection handler
ws.onmessage = (message) => {
  const msg = JSON.parse(message.data);
  
  if (msg.action === "subscribe") {
    const { symbol, streams } = msg;
    
    // Subscribe to requested streams
    if (streams.includes("ticker")) {
      // Send ticker updates
      const sendTicker = () => {
        const ticker = tickerStore.getTicker(symbol);
        if (ticker) {
          ws.send(JSON.stringify({
            stream: "ticker",
            data: ticker,
          }));
        }
      };
      
      const tickerInterval = setInterval(sendTicker, 1000);
      subscriptions.set(`ticker:${symbol}`, tickerInterval);
    }
    
    if (streams.includes("markPrice")) {
      markPriceService.onUpdate((data) => {
        if (data.symbol === symbol) {
          ws.send(JSON.stringify({
            stream: "markPrice",
            data,
          }));
        }
      });
    }
    
    if (streams.includes("kline_1m")) {
      klineStore.onUpdate(symbol, "1m", (kline) => {
        ws.send(JSON.stringify({
          stream: "kline_1m",
          data: kline,
        }));
      });
    }
  }
};
```

---

## 📊 Data Flow

```
External Exchanges                Internal Engine
────────────────                 ────────────────
Binance, Bitget                  Matching Engine
     │                                  │
     │ WebSocket                        │ Trades
     │ Ticker, Mark, Index              │
     ▼                                  ▼
┌────────────────┐             ┌────────────────┐
│ Price Feed     │             │ Trade Events   │
│ Manager        │             │                │
└────────┬───────┘             └────────┬───────┘
         │                              │
         └──────────┬───────────────────┘
                    ▼
         ┌──────────────────────┐
         │  Mark Price Service  │
         │  • Hybrid calc       │
         │  • 30% internal      │
         │  • 70% external      │
         └──────────┬───────────┘
                    │
         ┌──────────┼──────────┐
         ▼          ▼          ▼
    ┌────────┐ ┌────────┐ ┌────────┐
    │ Ticker │ │ Klines │ │ Engine │
    │ Store  │ │ Store  │ │ Shards │
    └────┬───┘ └────┬───┘ └────┬───┘
         │          │          │
         └──────────┼──────────┘
                    ▼
         ┌──────────────────────┐
         │  Market Data Server  │
         │  • REST API          │
         │  • WebSocket         │
         └──────────────────────┘
                    │
                    ▼
              ┌──────────┐
              │ Clients  │
              └──────────┘
```

---

## 🧪 Testing

```typescript
// Test external feed connection
const feed = createBinanceFeed();
await feed.connect();
feed.subscribeTicker("BTC-USD");

feed.onTicker((ticker) => {
  console.log(`${ticker.symbol}: $${ticker.lastPrice}`);
});

// Test mark price calculation
const markPrice = createMarkPriceService();

// Update with internal book
markPrice.updateOrderbook({
  symbol: "BTC-USD",
  bids: [[50000, 1.5], [49990, 2.0]],
  asks: [[50010, 1.2], [50020, 1.8]],
  lastUpdateId: 123,
  timestamp: Date.now(),
});

// Update with external data
markPrice.updateExternalPrice({
  symbol: "BTC-USD",
  markPrice: 50005,
  indexPrice: 50000,
  lastPrice: 50005,
  // ... other fields
});

const result = markPrice.getMarkPrice("BTC-USD");
console.log(`Mark Price: $${result}`);
```

---

## 🚀 Next Steps

### Phase 1: Complete REST Endpoints (High Priority)
- [ ] Implement `/v1/ticker/24hr`
- [ ] Implement `/v1/markPrice`
- [ ] Implement `/v1/klines`
- [ ] Test with frontend

### Phase 2: WebSocket Streams (Medium Priority)
- [ ] Add ticker stream
- [ ] Add mark price stream
- [ ] Add kline streams
- [ ] Test with 1000+ concurrent connections

### Phase 3: Data Persistence (Low Priority)
- [ ] Store klines in database
- [ ] Store 24h ticker snapshots
- [ ] Load historical data on startup

### Phase 4: Monitoring (Low Priority)
- [ ] Add Prometheus metrics
- [ ] Set up alerts for stale external feeds
- [ ] Monitor mark price deviation

---

## 📚 Related Documentation

- [DELTA_HEDGING.md](DELTA_HEDGING.md) - Delta hedging engine (A-Book model)
- [Market-Data-Pipeline.md](architecture/Market-Data-Pipeline.md) - Detailed architecture
- [Market-Data-Streaming.md](architecture/Market-Data-Streaming.md) - WebSocket protocol
- [Engine-Architecture.md](architecture/Engine-Architecture.md) - Matching engine integration

---

**Document Version:** 2.0  
**Author:** DotMX Team


### API Endpoints

| Endpoint | Status | Description |
|----------|--------|-------------|
| `GET /orderbook/:symbol` | ✅ Done | L2 orderbook snapshot |
| `GET /symbols` | ✅ Done | List trading pairs |
| `GET /v1/depth` | 🔲 TODO | Standard depth endpoint |
| `GET /v1/ticker/24hr` | 🔲 TODO | 24h ticker stats |
| `GET /v1/ticker/price` | 🔲 TODO | Current price |
| `GET /v1/klines` | 🔲 TODO | Historical candlesticks |
| `GET /v1/trades` | 🔲 TODO | Recent trades |
| `GET /v1/markPrice` | 🔲 TODO | Mark & index price |
| `GET /v1/fundingRate` | 🔲 TODO | Funding rate info |

### WebSocket Streams

| Stream | Status | Description |
|--------|--------|-------------|
| Orderbook snapshot | ✅ Done | Initial L2 state |
| Orderbook deltas | ✅ Done | Incremental updates |
| Trades | 🔲 TODO | Real-time trades |
| Ticker | 🔲 TODO | 24h rolling stats |
| Klines | 🔲 TODO | Real-time candles |
| Mark Price | 🔲 TODO | Mark/index/funding |

---

## 🔄 Integration Tasks

### 1. Connect External Feeds to Market Data Server

```typescript
// In apps/marketdata-server.ts

import {
  createBinanceFeed,
  createBitgetFeed,
  createPriceFeedManager,
  createMarkPriceService,
  createTickerStore,
  createKlineStore,
} from "@dotmx/marketdata";

// Initialize external price feeds
const feedManager = createPriceFeedManager();
feedManager.addFeed(createBinanceFeed());
feedManager.addFeed(createBitgetFeed());

// Initialize mark price service
const markPriceService = createMarkPriceService();

// Connect feeds to mark price
feedManager.onPriceUpdate((data) => {
  markPriceService.updateExternalPrice(data);
});

// Start feeds for all symbols
await feedManager.start(["BTC-USD", "ETH-USD", "SOL-USD"]);
```

### 2. Update Engine with Mark Price

```typescript
// In engine, update shard mark price from market data
markPriceService.onUpdate((data) => {
  const shard = shardManager.getShard(data.symbol);
  if (shard) {
    shard.setMarkPrice(data.markPrice);
  }
});
```

### 3. Add REST Endpoints

```typescript
// GET /v1/ticker/24hr
app.get("/v1/ticker/24hr", async ({ query }) => {
  const symbol = query.symbol;
  
  // Try internal ticker first
  let ticker = tickerStore.getTicker(symbol);
  
  // Fallback to external
  if (!ticker) {
    const external = feedManager.getTicker(symbol);
    if (external) {
      return {
        symbol,
        lastPrice: external.lastPrice.toString(),
        markPrice: external.markPrice.toString(),
        indexPrice: external.indexPrice.toString(),
        high24h: external.high24h.toString(),
        low24h: external.low24h.toString(),
        volume: external.volume24h.toString(),
        priceChange: external.priceChange24h.toString(),
        priceChangePercent: external.priceChangePercent24h.toString(),
      };
    }
  }
  
  return ticker;
});

// GET /v1/markPrice
app.get("/v1/markPrice", async ({ query }) => {
  const symbol = query.symbol;
  const data = markPriceService.getMarkPriceData(symbol);
  
  return {
    symbol,
    markPrice: data?.markPrice ?? 0,
    indexPrice: data?.indexPrice ?? 0,
    fundingRate: data?.fundingRate ?? 0,
    nextFundingTime: data?.nextFundingTime ?? 0,
    source: data?.source ?? "unknown",
  };
});

// GET /v1/klines
app.get("/v1/klines", async ({ query }) => {
  const { symbol, interval, limit = 100 } = query;
  
  // Try internal klines first
  let klines = klineStore.getCandles(symbol, interval, limit);
  
  // Fallback to external
  if (klines.length < limit / 2) {
    const binance = feedManager.feeds.get("binance");
    if (binance) {
      const external = await binance.fetchKlines(symbol, interval, limit);
      // Merge with internal
      klines = mergeKlines(klines, external);
    }
  }
  
  return klines;
});
```

---

## 📊 Data Flow

```
                    ┌─────────────────────────────────┐
                    │     External Exchanges           │
                    │  (Binance, Bitget WebSocket)     │
                    └──────────────┬──────────────────┘
                                   │
                                   ▼
┌──────────────────────────────────────────────────────────────┐
│                    Price Feed Manager                         │
│  • Aggregates prices from multiple sources                   │
│  • Calculates median mark price                              │
│  • Detects stale/bad data                                    │
└─────────────────────────────┬────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              │               │               │
              ▼               ▼               ▼
      ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
      │ Mark Price   │ │ Ticker Store │ │ Kline Store  │
      │ Service      │ │ (24h stats)  │ │ (OHLCV)      │
      └──────┬───────┘ └──────┬───────┘ └──────┬───────┘
             │                │                │
             └────────────────┼────────────────┘
                              │
                              ▼
┌──────────────────────────────────────────────────────────────┐
│                    Market Data Server                         │
│  • REST API endpoints                                        │
│  • WebSocket broadcasting                                    │
│  • Throttled updates                                         │
└──────────────────────────────────────────────────────────────┘
                              │
                              ▼
                       ┌──────────────┐
                       │   Clients    │
                       │  (Web, API)  │
                       └──────────────┘
```

---

## 🛠️ Next Steps

### Phase 1: Basic Integration (Priority: HIGH)
- [ ] Update `marketdata-server.ts` to use new components
- [ ] Add external price feed initialization
- [ ] Connect mark price to engine shards
- [ ] Add `/v1/ticker/24hr` endpoint with external fallback

### Phase 2: Complete WebSocket Streams (Priority: MEDIUM)
- [ ] Add trade stream to WebSocket
- [ ] Add ticker stream to WebSocket
- [ ] Add kline stream to WebSocket
- [ ] Add mark price stream to WebSocket

### Phase 3: Historical Data (Priority: LOW)
- [ ] Persist klines to database
- [ ] Load historical klines on startup
- [ ] Add historical trade query endpoint

### Phase 4: Advanced Features (Priority: LOW)
- [ ] Add more exchanges (Bybit, OKX)
- [ ] Implement circuit breaker for external feeds
- [ ] Add price deviation alerts
- [ ] Implement data quality monitoring

---

## 🧪 Testing Checklist

- [ ] Unit tests for TickerAggregator
- [ ] Unit tests for KlineAggregator
- [ ] Unit tests for MarkPriceService
- [ ] Integration test: External feed connection
- [ ] Integration test: Mark price calculation
- [ ] E2E test: WebSocket streaming
- [ ] Load test: 50K concurrent WebSocket connections

---

## 📚 Usage Examples

### Initialize External Feeds

```typescript
import {
  createBinanceFeed,
  createBitgetFeed,
  createPriceFeedManager,
} from "@dotmx/marketdata";

const manager = createPriceFeedManager();
manager.addFeed(createBinanceFeed());
manager.addFeed(createBitgetFeed());

// Subscribe to price updates
manager.onPriceUpdate((data) => {
  console.log(`${data.symbol}: Mark=${data.markPrice}, Index=${data.indexPrice}`);
});

// Start for symbols
await manager.start(["BTC-USD", "ETH-USD"]);
```

### Get Mark Price with Hybrid Calculation

```typescript
import { createMarkPriceService } from "@dotmx/marketdata";

const markPrice = createMarkPriceService({
  internalWeight: 0.3, // 30% internal, 70% external
  minOrderbookDepth: 10000, // Require $10k depth
  maxSpread: 0.005, // Max 0.5% spread for "healthy" book
});

// Update from internal orderbook
markPrice.updateOrderbook(book);

// Update from external feed
markPrice.updateExternalPrice(externalData);

// Get result
const price = markPrice.getMarkPrice("BTC-USD");
const fullData = markPrice.getMarkPriceData("BTC-USD");
```

### Aggregate Ticker from Trades

```typescript
import { createTickerStore } from "@dotmx/marketdata";

const tickers = createTickerStore();
tickers.start();

// On each trade
tickers.onTrade("BTC-USD", {
  symbol: "BTC-USD",
  price: 50000,
  quantity: 1.5,
  timestamp: Date.now(),
});

// Get 24h stats
const ticker = tickers.getTicker("BTC-USD");
console.log(`24h Volume: ${ticker.volume24h}, Change: ${ticker.priceChangePercent24h}%`);
```

### Build Klines from Trades

```typescript
import { createKlineStore } from "@dotmx/marketdata";

const klines = createKlineStore({
  intervals: ["1m", "5m", "15m", "1h", "4h", "1d"],
  maxCandlesPerInterval: 500,
});

klines.start();

// On each trade
klines.onTrade("BTC-USD", {
  symbol: "BTC-USD",
  price: 50000,
  quantity: 1.5,
  timestamp: Date.now(),
});

// Get candles
const hourlyCandles = klines.getCandles("BTC-USD", "1h", 100);
```

---

## 🔗 Related Documentation

- [Market-Data-Pipeline.md](../docs/architecture/Market-Data-Pipeline.md) - Full architecture
- [Market-Data-Streaming.md](../docs/architecture/Market-Data-Streaming.md) - WebSocket protocol
- [Engine-Architecture.md](../docs/architecture/Engine-Architecture.md) - Matching engine

---

**Document Version:** 1.0  
**Author:** DotMX Team
