# DotMX Backend - Quick Start Guide

## Overview

DotMX is a high-performance perpetual futures trading engine built with Bun and TypeScript. The backend consists of three microservices that work together to provide a complete trading platform.

## Architecture

### 🌐 API Server (Port 3000)

The **API Server** is the main gateway for client interactions. It handles:

- **REST API endpoints** for order management (place, cancel, modify orders)
- **User authentication** (registration, login, password management, API keys)
- **Wallet integration** (wallet-based authentication, linking wallets)
- **WebSocket connections** for real-time updates to clients
- **Account management** (balance inquiries, position tracking)
- **Swagger documentation** at `/swagger`

**Key Features:**
- ElysiaJS-based HTTP/WebSocket server
- CORS support for web clients
- Rate limiting and authentication middleware
- Routes for orders, users, markets, and loyalty programs

---

### ⚙️ Engine Server (Port 3001)

The **Engine Server** is the core matching engine. It handles:

- **Order matching** using a high-performance orderbook
- **Trade execution** with deterministic sequencing
- **Position management** and PnL calculations
- **Risk checks** (margin requirements, liquidation thresholds)
- **Order lifecycle** (validation, matching, fills, cancellations)

**Key Features:**
- In-memory orderbook with tick-level precision
- Deterministic event sequencing for auditability
- Fast-path risk checks before order acceptance
- Replay capability from persisted events
- Supports limit orders, market orders, and perpetual contracts

---

### 📊 Market Data Server (Port 3002)

The **Market Data Server** provides real-time market data. It handles:

- **Level 2 orderbook snapshots** (bid/ask depth)
- **Trade stream** (executed trades with price/size/side)
- **Market statistics** (24h volume, open interest, funding rates)
- **Real-time WebSocket feeds** for market data consumers
- **Data fanout** to multiple subscribers

**Key Features:**
- WebSocket-based streaming for low latency
- Aggregated orderbook depth at different price levels
- Trade history and ticker data
- Multiple symbol support (BTC-USD, ETH-USD, etc.)

---

## Quick Start

### Prerequisites

- **Bun** v1.0+ installed ([install Bun](https://bun.sh))
- **PostgreSQL** (optional, for persistence)

### Installation

```bash
cd dotmx-backend
bun install
```

### Running Services

#### Start All Services at Once

```bash
bun run dev:all
```

This starts all three services concurrently with color-coded logs:
- API Server → http://localhost:3000
- Engine Server → http://localhost:8080
- Market Data Server → http://localhost:8080

Press `Ctrl+C` to stop all services.

#### Start Individual Services

```bash
# API Server only
bun run dev:api

# Engine Server only
bun run dev:engine

# Market Data Server only
bun run dev:marketdata
```

---

## Service Communication

```
┌─────────────┐
│   Clients   │
│  (Web/API)  │
└──────┬──────┘
       │
       ▼
┌─────────────────┐      Commands      ┌─────────────────┐
│   API Server    │─────────────────────▶│ Engine Server   │
│   (Port 3000)   │                      │  (Port 3001)    │
│                 │◀─────────────────────│                 │
│  - REST API     │      Events          │  - Orderbook    │
│  - Auth         │                      │  - Matching     │
│  - WebSockets   │                      │  - Risk Checks  │
└────────┬────────┘                      └────────┬────────┘
         │                                        │
         │  Subscribe                             │ Events
         │                                        │
         ▼                                        ▼
┌─────────────────────────────────────────────────────────┐
│              Market Data Server (Port 3002)             │
│                                                          │
│  - Level 2 Depth      - Trade Stream                    │
│  - Market Stats       - WebSocket Feeds                 │
└──────────────────────────────────────────────────────────┘
```

1. **Clients** → Connect to **API Server** for trading
2. **API Server** → Sends commands to **Engine Server**
3. **Engine Server** → Executes trades and emits events
4. **Market Data Server** → Consumes events and broadcasts to subscribers

---

## Testing

```bash
# Run all tests
bun test

# Run specific package tests
bun test:engine
bun test:persistence

# Run integration tests
bun test:integration
```

---

## Additional Commands

```bash
# Type checking
bun run typecheck

# Generate OpenAPI docs
bun run openapi:generate

# Start with Docker
bun run docker:up

# CLI tools (benchmarks, load tests)
bun run cli
bun run bench
bun run throughput
```

---

## API Documentation

Once the API server is running, visit:

**http://localhost:3000/swagger**

This provides interactive API documentation for all available endpoints.

---

## Environment Variables

Create a `.env` file in the `dotmx-backend` directory:

```env
# Server Configuration
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:password@localhost:5432/dotmx

# JWT
JWT_SECRET=your-secret-key-here

# Engine
ENGINE_PORT=3001
MARKETDATA_PORT=3002
```

---

## Next Steps

- Read the [Architecture Documentation](./docs/README.md)
- Explore the [API Documentation](./docs/API.md)
- Review [Deployment Guide](./docs/DEPLOYMENT.md)
- Check [Testing Strategy](./docs/10_TESTING_PERF.md)

---

## Support

For issues or questions, refer to the detailed documentation in the `/docs` folder or check the [README.md](./README.md).
