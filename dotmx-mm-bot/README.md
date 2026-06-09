# DotMX Market Maker Bot

Automated market-making system for the DotMX exchange. Runs 10 specialized bot accounts that provide liquidity across all 13 trading pairs.

## Architecture

```
┌─────────────────────────────────────────────────┐
│ Binance Price Feed (WebSocket)                  │
│  → Reference mid prices for all pairs           │
└──────────────────────┬──────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────┐
│ MarketMakerEngine (per account)                 │
│                                                 │
│  1. Get reference price                         │
│  2. Compute bid/ask levels (symmetric/skewed)   │
│  3. Cancel stale orders                         │
│  4. Place new POST_ONLY limit orders            │
│  5. Track inventory & skew spreads              │
│                                                 │
│  ┌─────────────┐  ┌──────────────┐              │
│  │ Inventory   │  │ Risk Manager │              │
│  │ Manager     │  │              │              │
│  │ - Net pos   │  │ - Max loss   │              │
│  │ - Skew      │  │ - Position   │              │
│  │ - PnL       │  │ - Rate limit │              │
│  └─────────────┘  └──────────────┘              │
└─────────────────────────────────────────────────┘
                       │
                       ▼
        DotMX Exchange API (localhost:8080)
```

## Bot Accounts

| Bot | Markets | Strategy | Spread | Seed Balance |
|-----|---------|----------|--------|-------------|
| mm-01 | BTC-USDT | symmetric | 30bps | $1,000,000 |
| mm-02 | BTC-USDT, BTC-USDC | skewed | 40bps | $1,000,000 |
| mm-03 | ETH-USDT | symmetric | 30bps | $1,000,000 |
| mm-04 | ETH-USDC, ETH-BTC | symmetric | 50bps | $1,000,000 |
| mm-05 | SOL-USDT, BNB-USDT | symmetric | 50bps | $1,000,000 |
| mm-06 | ARB-USDT, OP-USDT | symmetric | 80bps | $1,000,000 |
| mm-07 | DMX-USDT | skewed | 100bps | $1,000,000 |
| mm-08 | DAI-USDT, WBTC-USDT | passive | 20bps | $1,000,000 |
| mm-09 | DOGE-USDT | symmetric | 80bps | $1,000,000 |
| mm-10 | BTC-USDT, ETH-USDT | passive (reserve) | 60bps | $1,000,000 |

**Total seeded: $10,000,000 across 10 accounts**

## Strategies

- **Symmetric**: Equal spreads on both sides. Best for liquid markets.
- **Skewed**: Adjusts spreads based on inventory. When long, widen bids and tighten asks to attract sells. Best for volatile markets.
- **Passive**: Wider spreads, fewer levels. Used for stablecoin pairs and reserve accounts that provide depth without aggressive quoting.

## Quick Start

### 1. Install dependencies

```bash
cd dotmx-mm-bot
bun install
```

### 2. Seed accounts (requires running PostgreSQL + exchange backend)

```bash
# Create 10 MM accounts in DB, seed $1M USDT each, generate API keys
bun run seed

# To reset and recreate accounts:
bun run seed -- --reset
```

This creates `.mm-credentials.json` with API keys (gitignored).

### 3. Run the bots

```bash
# Run all 10 bots
bun run start

# Dry run (log quotes without placing orders)
bun run start:dry

# Run specific bots only
bun run start -- --bots=mm-01,mm-03

# Development mode with auto-reload
bun run dev
```

### 4. Check status

```bash
bun run status
```

## Configuration

Copy `.env.example` to `.env` and adjust:

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | postgresql://dotmx:dotmx_dev@localhost:5432/dotmx | Direct DB access for seeding |
| `API_BASE_URL` | http://localhost:8080/api | Exchange API via nginx |
| `WS_MARKET_URL` | ws://localhost:8080/api/ws/market | WebSocket for market data |
| `PRICE_SOURCE` | binance | `binance` or `internal` |
| `REFRESH_INTERVAL_MS` | 5000 | How often to refresh all quotes |
| `INVENTORY_SKEW` | 0.3 | Skew sensitivity (0–1) |
| `MAX_LOSS_USD` | 10000 | Max loss before halt |
| `LOG_LEVEL` | info | debug, info, warn, error |

## Risk Controls

1. **Max Loss Circuit Breaker**: Halts all trading when cumulative PnL exceeds `MAX_LOSS_USD`
2. **Per-Market Position Limit**: Each bot has a configurable `maxPositionUsd`
3. **Rate Limiting**: Tracks orders/minute and pauses when approaching limits
4. **POST_ONLY Orders**: All MM orders use POST_ONLY to guarantee maker fees
5. **Inventory Skew**: Automatically adjusts spreads to reduce directional exposure
6. **Graceful Shutdown**: Ctrl+C cancels all open orders before exiting

## File Structure

```
dotmx-mm-bot/
├── src/
│   ├── index.ts          # Main entry point, orchestrator
│   ├── config.ts         # Account definitions & configuration
│   ├── engine.ts         # Core market maker logic per account
│   ├── exchange-client.ts # Typed HTTP client for DotMX API
│   ├── price-feed.ts     # Binance WebSocket price reference
│   ├── inventory.ts      # Position tracking & skew calculation
│   ├── risk.ts           # Risk manager & circuit breakers
│   └── logger.ts         # Structured logging
├── scripts/
│   ├── seed-mm-accounts.ts # Create accounts & seed balances
│   └── check-status.ts    # Query account status
├── .env.example
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```
