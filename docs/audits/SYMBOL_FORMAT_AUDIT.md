# Symbol Format Audit Report

> **Date**: 2026-02-09  
> **Scope**: `dotmx-frontend/` and `dotmx-backend/` codebases  
> **Formats identified**:
> - **Slash** `BTC/USDT` — database canonical format  
> - **Dash** `BTC-USD` or `BTC-USDC` — frontend internal/display format  
> - **Flat** `BTCUSDT` — Bitget API & WS subscription format  
> - **Suffixed** `BTCUSDT_UMCBL` — legacy Bitget v1 futures identifier  

---

## Summary of Inconsistencies

| Layer | Primary Format | Issue |
|-------|---------------|-------|
| Database (seed/schema) | `BTC/USDT` (slash) | Canonical source of truth |
| Backend marketdata-server | All 4 formats handled ad-hoc | Heavy `.replace()` normalization everywhere |
| Backend API routes | Whatever comes in (no normalization) | Stores `body.symbol` directly from frontend |
| Frontend fallback data | `BTC-USD` (dash) | Uses `-USD` collateral instead of actual DB collateral |
| Frontend URL params | `BTCUSDT` (flat/bitgetSymbol) | Different from `currentPair.symbol` (`BTC-USD`) |
| Frontend order placement | `currentPair.symbol` (`BTC-USD` dash) | Sent to API which stores it as-is |
| Frontend config/perps.ts | `BTCUSDC` flat keys, `BTC-USDC` display | Yet another collateral variant |
| WS channels | `BTCUSDT` (flat) | Consistent with Bitget format |

---

## File-by-File Findings

---

### 1. `dotmx-backend/scripts/db/schema.sql`

| Line | Format | Context |
|------|--------|---------|
| L976 | `BTC/USDT` (slash) | Column comment: `symbol VARCHAR(20) NOT NULL UNIQUE, -- BTC/USDT` |

**Role**: Schema defines slash as DB canonical format.

---

### 2. `dotmx-backend/scripts/db/seed.sql`

| Line | Format | Context |
|------|--------|---------|
| L196-208 | `BTC/USDT`, `ETH/USDT`, `BTC/USDC`, etc. (slash) | `INSERT INTO trading_pairs` seed data |
| L290-297 | `BTC/USDT`, `WBTC/USDT` (slash) | Perpetual config seed data |

**Role**: Database seeds use slash format throughout.

---

### 3. `dotmx-backend/scripts/db/_archive/init-db.sql`

| Line | Format | Context |
|------|--------|---------|
| L91-92 | `BTCUSDT` (flat) | **INCONSISTENCY** – Old init used flat format for `trading_pairs.symbol`, vs current seed which uses slash |

**Role**: Archived migration — flat format was legacy DB format.

---

### 4. `dotmx-backend/apps/marketdata-server.ts`

| Line | Format | Context |
|------|--------|---------|
| L57-58 | N/A | `SYMBOL_MAP` and `REVERSE_SYMBOL_MAP` declarations (populated runtime) |
| L60-65 | **Conversion**: internal → flat | `toBitgetSymbol()`: strips `USD[CT]?$` and `-.*$`, appends `USDT` |
| L67-69 | **Conversion**: flat → internal | `fromBitgetSymbol()`: reverse lookup |
| L76-90 | **Multi-format lookup** | `lookupTicker()`: tries raw, dash→slash, remove separators→flat, then mapped Bitget |
| L77 | `_UMCBL` strip | `rawSymbol.replace(/_UMCBL$/, "")` |
| L81 | Dash→Slash | `sym.replace("-", "/")` |
| L84 | Any→Flat | `sym.replace(/[-\/]/g, "")` |
| L100 | Dash→Slash | `key.replace("-", "/")` for DB update |
| L201-202 | Slash→Flat | Building `SYMBOL_MAP`: `pair.symbol` (slash from DB) → `${base}USDT` (flat) |
| L223-319 | Internal→Flat | Every fanout/broadcast uses `toBitgetSymbol()` to make WS channel keys flat |
| L361, 426, 451, 483, 522 | `_UMCBL` strip | Multiple REST endpoints strip `_UMCBL` suffix |
| L547, 579, 605 | Any→Flat | `rawSymbol.replace(/[-\/]/g, "")` for REST fallback Bitget fetch |
| L680, 709, 722 | `_UMCBL` strip | WS subscription message handling |
| L390-420 | Slash (from DB) | `/symbols` and `/api/symbols` endpoints return DB format (slash) |

**Key issue**: This file is the primary normalization hub. Symbol format depends on entry point — REST endpoints receive flat from frontend, DB stores slash, Bitget needs flat. Every handler has ad-hoc `.replace()` calls.

---

### 5. `dotmx-backend/apps/api-server-with-auth.ts`

| Line | Format | Context |
|------|--------|---------|
| L254-291 | Slash (from DB) | `/symbols` endpoint queries `trading_pairs` and returns `p.symbol` (slash format from DB) |
| L379-392 | Pass-through | `/market/:symbol` — accepts whatever format the client sends |

---

### 6. `dotmx-backend/packages/marketdata/src/external/index.ts`

| Line | Format | Context |
|------|--------|---------|
| L122-126 | **Type definition** | `SymbolMapping { internal: "BTC-USD", binance: "BTCUSDT", bitget: "BTCUSDT" }` |
| L128-139 | **Dash internal** | `DEFAULT_SYMBOL_MAPPINGS` — internal uses DASH format (`BTC-USD`), NOT slash |
| L141-142 | Dash→Flat fallback | `toBinanceSymbol()`: `internalSymbol.replace("-", "")` |
| L145-146 | Dash→Flat fallback | `toBitgetSymbol()`: `internalSymbol.replace("-", "")` |
| L149-150 | Flat→Dash | `fromBinanceSymbol()`: reverse lookup |
| L153-154 | Flat→Dash | `fromBitgetSymbol()`: reverse lookup |

**Key issue**: This package **assumes `BTC-USD`** as internal format (dash, with `USD` collateral), but the DB uses **`BTC/USDT`** (slash, with `USDT` collateral). The marketdata-server's `toBitgetSymbol()` in the app (L60-65) is a *different function* from the one in this package — they have overlapping names but different behaviors.

---

### 7. `dotmx-backend/packages/api/src/routes/trading.ts`

| Line | Format | Context |
|------|--------|---------|
| L47 | `BTC-USD` (dash) | Default fallback: `orderData.symbol \|\| "BTC-USD"` |
| L85 | Pass-through | `symbol: orderData.symbol || "BTC-USD"` in mock response |
| L166 | Pass-through | `INSERT INTO orders ... symbol` — stores whatever format the client sends |
| L231-247 | Pass-through | `order.symbol` read from DB — depends on what was stored |
| L332 | Pass-through | Returns `order.symbol` from DB |

**Key issue**: Orders table stores `symbol` as whatever the frontend sends (typically `BTC-USD` dash format). But `trading_pairs.symbol` uses slash format. **Mismatch between orders.symbol and trading_pairs.symbol formats.**

---

### 8. `dotmx-backend/packages/api/src/routes/perpetual-market.routes.ts`

| Line | Format | Context |
|------|--------|---------|
| L23-40 | Pass-through | `/funding-rate/:symbol` — queries `WHERE symbol = $1` with whatever format |
| L77, 82 | Pass-through | Param bound directly to SQL query |
| L93-104 | Pass-through | Funding history — `ORDER BY symbol, timestamp DESC` |

**Key issue**: These routes query a `funding_rates` table with `WHERE symbol = $1`. If the frontend sends `BTCUSDT` but the table has `BTC/USDT`, it won't match.

---

### 9. `dotmx-backend/packages/api/src/ws/index.ts`

| Line | Format | Context |
|------|--------|---------|
| L22 | N/A | `connectionsBySymbol` map |
| L58-75 | Pass-through | WS subscribe accepts `msg.symbol` or `msg.symbols` — no normalization |
| L74 | Pass-through | `fanout.subscribe(symbol, ...)` — uses whatever was sent |

---

### 10. `dotmx-backend/packages/api/tests/websocket.test.ts`

| Line | Format | Context |
|------|--------|---------|
| L122-301+ | `BTC-USD` (dash) | All test data uses dash format |

---

### 11. `dotmx-backend/packages/api/tests/trading.routes.test.ts`

| Line | Format | Context |
|------|--------|---------|
| L277 | `BTC-USD` (dash) | `?symbol=BTC-USD` in test query |

---

### 12. `dotmx-backend/packages/engine/src/matching/index.ts`

| Line | Format | Context |
|------|--------|---------|
| L110-401 | Pass-through | `command.symbol`, `book.symbol`, `entry.order.symbol` — uses whatever was provided |
| L380-386 | Pass-through | `entry.order.symbol !== symbol` — exact string comparison, format-sensitive |

**Key issue**: Engine does exact string match on symbols. If orders come in as `BTC-USD` but orderbook was created with `BTC/USDT`, they won't match.

---

### 13. `dotmx-backend/packages/engine/src/shard/index.ts`

| Line | Format | Context |
|------|--------|---------|
| L18-50 | Pass-through | `symbol: string` in config — depends on initialization |

---

### 14. `dotmx-frontend/src/hooks/useData.ts`

| Line | Format | Context |
|------|--------|---------|
| L49-55 | **Type: `PerpSymbol`** | Defines `symbol`, `displayName`, `asset`, `collateral`, `bitgetSymbol` |
| L58-64 | **Type: `StoreMarket`** | `symbol: "ETH-USD"`, `bitgetSymbol: "ETHUSDC"` (comments) |
| L117-156 | `BTC-USD` (dash) | `FALLBACK_SYMBOLS` array — uses dash with `USD` collateral |
| L119 | `bitgetSymbol: "BTCUSDT"` (flat) | Bitget symbol uses USDT, not USD |
| L169-186 | N/A | `ASSET_DISPLAY_NAMES` map |
| L226-227 | **Conversion: Slash→Dash** | `s.symbol.replace("/", "-")` — transforms DB slash to frontend dash |
| L234 | **Dynamic flat** | `bitgetSymbol: \`${asset}${collateral}\`` — builds from actual base/quote (e.g., `BTCUSDT`) |
| L287-306 | `BTC-USD` (dash) | `usePerpSymbols()` defaults to `FALLBACK_SYMBOLS[0]` which is `BTC-USD` |
| L300-301 | Match by `bitgetSymbol` | `FALLBACK_SYMBOLS.find(s => s.bitgetSymbol === defaultSymbol)` |
| L1766-1790 | Pass-through | `useBackendTicker(symbol)` — sends `currentPair.symbol` (dash) to API |
| L1807-1830 | Pass-through | `useFundingRate(symbol)` — sends dash symbol to API |
| L1840-1870 | Pass-through | `useOpenInterest(symbol)` — sends dash symbol to API |

**Key issue**: L226-227 converts slash (from DB) to dash for frontend use. But `FALLBACK_SYMBOLS` use `BTC-USD` (no "T" in collateral), while DB has `BTC/USDT`. The `bitgetSymbol` is built dynamically from `${asset}${collateral}`, so DB's `BTC/USDT` → `BTCUSDT`, which is correct for Bitget, but frontend fallback uses `BTC-USD` → `bitgetSymbol: "BTCUSDT"` where the collateral in symbol (`USD`) doesn't match the actual collateral in bitgetSymbol (`USDT`).

---

### 15. `dotmx-frontend/src/contexts/TradePairContext.tsx`

| Line | Format | Context |
|------|--------|---------|
| L143 | `BTCUSDT` (flat) | URL default: `searchParams.get("symbol") \|\| "BTCUSDT"` |
| L162 | Dash `currentPair.symbol` | `useBackendTicker(currentPair.symbol)` — sends dash to API |
| L165 | Dash | `useFundingRate(currentPair.symbol)` |
| L167 | Dash | `useOpenInterest(currentPair.symbol)` |
| L175 | Flat `bitgetSymbol` | `ws.subscribeTicker(symbol)` where `symbol = currentPair.bitgetSymbol` |
| L212 | Flat in URL | `router.push(\`/trade/perp?symbol=${pair.bitgetSymbol}\`)` |

**Key issue**: URL param uses `bitgetSymbol` (flat `BTCUSDT`), but API calls use `currentPair.symbol` (dash `BTC-USD`). The context uses flat for WS but dash for REST — data flows through different format paths.

---

### 16. `dotmx-frontend/src/config/perps.ts`

| Line | Format | Context |
|------|--------|---------|
| L13 | Flat→Flat | `bitgetSymbol = \`${assetSymbol}USDT\`` — always appends USDT |
| L19 | Flat key, dash display | `symbol: \`${asset}${collateral}\``, `displaySymbol: \`${asset}-${collateral}\`` |
| L29-36 | `BTCUSDC` flat keys | `PERP_CONFIGS` keyed by flat format with USDC collateral |
| L43-58 | **Multi-format parser** | `parseSymbol()` handles slash, dash, and flat formats |
| L86-95 | Dynamic | `getPerpConfig()` returns dash displaySymbol, flat bitgetSymbol (always USDT) |
| L100-107 | Pass-through | Utility functions delegate to `getPerpConfig()` |

**Key issue**: PERP_CONFIGS use `USDC` collateral in keys but `bitgetSymbol` always has `USDT`. Display symbols use dash. Yet another collateral inconsistency (`USD` vs `USDC` vs `USDT`).

---

### 17. `dotmx-frontend/src/services/TradingViewDatafeed.ts`

| Line | Format | Context |
|------|--------|---------|
| L54-56 | **Conversion** | `convertToBitgetSymbol()` — uses `getPerpConfig()` to map any format → flat `BTCUSDT` |
| L138-171 | `BTCUSDT` flat | `searchSymbols()` hardcoded flat symbols with slash descriptions ("Bitcoin / USDT Perpetual") |
| L197-202 | Pass-through | `resolveSymbol()` — uses symbol name as-is for chart display |
| L228 | Internal→Flat | `convertToBitgetSymbol(internalSymbol)` for historical kline fetch |
| L244 | Flat in API URL | `?symbol=${bitgetSymbol}` in REST call to marketdata server |
| L311 | Internal→Flat | `convertToBitgetSymbol(internalSymbol)` for WS subscription |

---

### 18. `dotmx-frontend/src/services/ApiClient.ts`

| Line | Format | Context |
|------|--------|---------|
| L389-394 | Pass-through | `getOpenOrders(symbol?)`, `getTrades(symbol?)` — sends as query param |
| L532-544 | Pass-through | `getMarketTicker(symbol)` — `/v1/market/ticker/24hr?symbol=${symbol}` |
| L580-587 | Pass-through/URL-encoded | `getFundingRate(symbol)` — `/v1/market/funding-rate/${encodeURIComponent(symbol)}` |
| L601+ | Pass-through/URL-encoded | `getMarkPrice(symbol)`, `getOpenInterest(symbol)` |

**Role**: Pure pass-through — sends whatever the caller provides.

---

### 19. `dotmx-frontend/src/services/websocket/MarketDataWebSocketService.ts`

| Line | Format | Context |
|------|--------|---------|
| L11 | N/A | `MarketDataTickerUpdate.symbol` field |
| L202-211 | **Flat** | `subscribeTicker(symbol)` — `{ channel: "ticker", instId: symbol }` where symbol is `bitgetSymbol` (flat) |
| L219-233 | **Flat** | `subscribeKline(symbol, interval)` — same flat format |
| L241+ | **Flat** | `subscribeTrade(symbol)` — same flat format |
| L270-297 | Pass-through | `updateSymbol()` — moves handler maps from old to new symbol |
| L320-330 | **Flat expected** | `handleMessage()` — `msg.symbol` from server is flat (server broadcasts as flat) |

---

### 20. `dotmx-frontend/src/services/websocket/BitgetWebSocketService.ts`

| Line | Format | Context |
|------|--------|---------|
| L13 | Config | `symbol: string` in `BitgetStreamConfig` — expects flat format |
| L196-202 | **Flat, `_UMCBL` strip** | `symbol.replace(/_UMCBL$\|_DMCBL$\|_CMCBL$/i, "")` → `instId` |
| L205 | Flat→WS | `args.push({ instType: "mc", channel, instId })` — sends flat to Bitget |

---

### 21. `dotmx-frontend/src/components/trading/TradingForm.tsx`

| Line | Format | Context |
|------|--------|---------|
| L142 | Dash via context | `const { currentPair, market } = useTradePair()` |
| L151 | N/A | `asset = currentPair.asset` (just the base, e.g., "BTC") |
| L317 | Display | `currentPair.collateral` shown in error message |
| L375 | **Dash sent to API** | `symbol: currentPair.symbol` in `placeOrder()` — sends `BTC-USD` to API |
| L562, 576 | Display | `currentPair.collateral` in UI labels |

**Key issue**: Order placement sends `currentPair.symbol` which is `BTC-USD` (dash). This gets stored in `orders` table. But `trading_pairs` table has `BTC/USDT` (slash). Format mismatch in DB.

---

### 22. `dotmx-frontend/src/components/trading/PositionChartSync.tsx`

| Line | Format | Context |
|------|--------|---------|
| L14 | Flat (comment) | `symbol: string // Current chart symbol (e.g., "BTCUSDC")` |
| L49-53 | **Normalization** | `order.symbol.replace(/[-_]/g, "").toUpperCase()` and `symbol.replace(/[-_]/g, "").toUpperCase()` — strips both dash and underscore for comparison |

**Role**: Correctly normalizes for comparison by reducing to flat format.

---

### 23. `dotmx-frontend/src/components/trading/PriceTicker.tsx`

| Line | Format | Context |
|------|--------|---------|
| L95 | Flat in URL | `router.push(\`/trade/perp?symbol=${sym.bitgetSymbol}\`)` |

---

### 24. `dotmx-frontend/src/components/trading/PositionsTable.tsx`

| Line | Format | Context |
|------|--------|---------|
| L58 | Display | Column header "Symbol" — displays whatever format stored |

---

### 25. `dotmx-frontend/src/hooks/useTradingVolume.ts`

| Line | Format | Context |
|------|--------|---------|
| L61-90 | `BTC-USDC` (dash, USDC collateral) | Hardcoded mock data uses dash with USDC suffix |

**Issue**: Uses `USDC` collateral whereas fallback symbols use `USD` and DB uses `USDT`.

---

### 26. `dotmx-frontend/src/app/portal/orders/page.tsx`

| Line | Format | Context |
|------|--------|---------|
| L63 | `BTC/USDT` (slash) | Mock order data uses slash format |
| L78 | `ETH/USDT` (slash) | Same |
| L262, 308, 352 | Display | `{order.symbol}` and `{position.symbol}` — renders whatever format |

**Issue**: Mock data uses slash format but real orders would have dash format from TradingForm.

---

### 27. `dotmx-frontend/src/app/portal/portfolio/page.tsx`

| Line | Format | Context |
|------|--------|---------|
| L53 | `BTC-USD` (dash) | Display string: "New BTC-USD perpetual futures now available" |

---

### 28. `dotmx-frontend/src/app/portal/notifications/page.tsx`

| Line | Format | Context |
|------|--------|---------|
| L129 | `BTC/USDT` (slash) | Notification text: "Your BTC/USDT long order..." |

---

### 29. `dotmx-frontend/src/app/trade/page.tsx`

| Line | Format | Context |
|------|--------|---------|
| L16 | Bare asset name | `router.replace("/trade/perp?symbol=BTC")` — uses just "BTC", not full pair |

---

### 30. `dotmx-frontend/src/app/api/bitget/ticker/route.ts`

| Line | Format | Context |
|------|--------|---------|
| L38 | `BTCUSDT` (flat) | Default: `searchParams.get("symbol") \|\| "BTCUSDT"` |

---

### 31. `dotmx-frontend/src/app/api/bitget/candlestick/route.ts`

| Line | Format | Context |
|------|--------|---------|
| L44 | `BTCUSDT` (flat) | Default: `searchParams.get("symbol") \|\| "BTCUSDT"` |
| L46 | `_UMCBL` strip | `rawSymbol.replace(/_UMCBL$\|_DMCBL$\|_CMCBL$/i, "")` |

---

### 32. `dotmx-backend/scripts/db/_archive/migrations/005_...sql`

| Line | Format | Context |
|------|--------|---------|
| L156 | `BTC-USDT` (dash) | Comment example: `"symbol": "BTC-USDT"` for circuit breaker config |

---

## Format Flow Diagram

```
                         DATABASE
                   ┌─────────────────┐
                   │ trading_pairs   │
                   │ symbol: BTC/USDT│ ← Slash format (canonical)
                   └────────┬────────┘
                            │
                   ┌────────▼────────┐
                   │ marketdata-srv  │
                   │ /api/symbols    │ → Returns BTC/USDT (slash)
                   └────────┬────────┘
                            │
              ┌─────────────▼──────────────┐
              │  Frontend useStoreMarkets  │
              │  L227: .replace("/", "-")  │ → Converts to BTC-USDT (dash)
              └─────────────┬──────────────┘
                            │
                   ┌────────▼────────┐
                   │  PerpSymbol     │
                   │  symbol: BTC-USDT│ (dash)
                   │  bitgetSymbol:  │
                   │    BTCUSDT      │ (flat, ${base}${quote})
                   └───┬─────────┬──┘
                       │         │
         ┌─────────────▼──┐  ┌──▼──────────────┐
         │ REST API calls │  │ WS subscriptions │
         │ symbol: BTC-USDT│ │ instId: BTCUSDT  │
         │ (dash)         │  │ (flat)           │
         └────────┬───────┘  └──────────────────┘
                  │
         ┌────────▼────────┐
         │ marketdata-srv  │
         │ lookupTicker()  │ ← tries raw, slash, flat, mapped
         │ DB update:      │
         │  .replace("-","/")│ → converts back to slash for DB
         └─────────────────┘
```

**The problem**: FALLBACK_SYMBOLS use `BTC-USD` (collateral=`USD`) but DB has `BTC/USDT` (collateral=`USDT`). When backend returns `BTC/USDT`, the frontend converts to `BTC-USDT` and sets `bitgetSymbol` = `BTCUSDT` — this works, but `currentPair.symbol` is `BTC-USDT` which is sent to REST endpoints. The marketdata-server has `lookupTicker()` that handles this by trying multiple formats, but the API server's trading routes store the dash format directly in the `orders` table, creating a format mismatch with `trading_pairs`.

---

## Critical Issues

### 1. **orders.symbol vs trading_pairs.symbol format mismatch**
- `trading_pairs.symbol` = `BTC/USDT` (slash, DB canonical)
- `orders.symbol` = `BTC-USD` (dash, from frontend `currentPair.symbol`)
- Any JOIN between these tables on `symbol` will fail

### 2. **Collateral inconsistency across layers**
- DB: `USDT`, `USDC` (real quote assets)
- Frontend fallback: `USD` (synthetic)
- Config perps.ts: `USDC` (specific)
- FALLBACK_SYMBOLS: `USD` → bitgetSymbol: `BTCUSDT` (USDT)
- useTradingVolume: `USDC`

### 3. **Duplicate `toBitgetSymbol` functions**
- `dotmx-backend/apps/marketdata-server.ts` L60 — uses SYMBOL_MAP + regex fallback
- `dotmx-backend/packages/marketdata/src/external/index.ts` L145 — uses DEFAULT_SYMBOL_MAPPINGS + `.replace("-", "")`
- Different logic, same name, may produce different results

### 4. **No centralized normalization**
- Each endpoint/handler has its own ad-hoc `.replace()` chains
- 15+ instances of `replace(/_UMCBL$/, "")`
- 6+ instances of `replace(/[-\/]/g, "")`
- 3+ instances of `replace("-", "/")`
- No single `normalizeSymbol()` utility

### 5. **URL parameter format ≠ API call format**
- URL: `?symbol=BTCUSDT` (flat/bitgetSymbol)
- REST calls to backend: `symbol=BTC-USD` (dash, from `currentPair.symbol`)
- These could desync if user manually edits URL

---

## Recommendations

1. **Standardize on slash format as canonical** — match the database
2. **Create a shared `@dotmx/symbol-utils` package** with:
   - `toSlash("BTC-USD") → "BTC/USD"`  
   - `toDash("BTC/USD") → "BTC-USD"`  
   - `toFlat("BTC/USD") → "BTCUSD"`  
   - `toBitget("BTC/USD") → "BTCUSDT"`  
   - `normalize(anyFormat) → canonical`
3. **Fix orders.symbol** to store slash format matching `trading_pairs`
4. **Unify collateral naming** — decide on `USD` vs `USDT` vs `USDC`
5. **Use canonical format in FALLBACK_SYMBOLS** — match actual DB values
6. **Centralize `_UMCBL` stripping** — in one utility, not 15+ locations
