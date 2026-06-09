# API Gateway Architecture

## Overview

The **API Server** is the primary gateway for external clients and applications to interact with the DotMX exchange. It handles REST API requests, WebSocket connections, and serves as the command dispatcher for the matching engine.

**Port:** 3000
**Framework:** ElysiaJS (Bun)
**Responsibility:** Request validation, authentication, command dispatch, response formatting

---

## Core Components

### 1. REST API Layer
- **Health Checks**: `/health`, `/health/ready`, `/health/live`
- **Order Management**: `POST /orders`, `DELETE /orders/:id`, `GET /orders/:id`
- **Market Data**: `GET /market/orderbook/:symbol`, `GET /market/tickers`, `GET /market/symbols`
- **Authentication**: `/auth/*` (register, login, wallet auth, API keys)
- **Swagger Documentation**: `/swagger` (auto-generated from Elysia)

### 2. WebSocket Handlers
- **Market Data Stream** (`/ws/market`): Real-time orderbook, trades, tickers
- **User Updates Stream** (`/ws/user`): Order fills, position updates, balance changes

### 3. Middleware Stack
- **Error Handler Plugin**: Centralized error handling and formatting
- **Request Logger Plugin**: Structured logging for debugging
- **CORS Plugin**: Cross-origin request handling
- **Auth Plugin**: JWT and API Key authentication
- **Rate Limiter**: Per-user and per-IP rate limiting

### 4. Service Integration
- **Gateway Adapter**: Routes commands to the Engine Server
- **Command Bus**: In-memory message queue for order commands
- **Shard Router**: Distributes orders across market shards (for scaling)
- **Market Data Fanout**: Broadcasts real-time updates to WebSocket clients

---

## Request Flow

```
Client (REST/WebSocket)
        ↓
   API Server
        ↓
   [Authentication]
        ↓
   [Rate Limiting]
        ↓
   Route Handlers
        ├─ Health Checks
        ├─ Order API
        ├─ Market Data API
        └─ Auth Routes
        ↓
   Gateway Adapter
        ↓
   Command Bus
        ↓
   Engine Server (Port 3001)
```

---

## API Endpoints

### Health Checks
```
GET /
GET /health
GET /health/ready
GET /health/live
```

### Orders
```
POST /orders          - Place new order
GET  /orders/:id      - Get order status
DELETE /orders/:id    - Cancel order
GET  /orders          - List user's orders (protected)
```

### Market Data
```
GET /market/orderbook/:symbol   - Get L2 orderbook
GET /market/symbols             - List trading pairs
GET /market/ticker/:symbol      - Get 24h ticker
GET /market/tickers             - Get all tickers
```

### Authentication
```
POST /auth/register              - User registration
POST /auth/login                 - User login
POST /auth/wallet/challenge      - Start wallet auth
POST /auth/wallet/verify         - Complete wallet auth
POST /auth/password/change       - Change password
POST /auth/password/reset        - Request password reset
POST /auth/api-keys              - Create API key
GET  /auth/api-keys              - List API keys
DELETE /auth/api-keys/:id        - Delete API key
POST /auth/wallets               - Link wallet
DELETE /auth/wallets/:id         - Unlink wallet
PUT  /auth/wallets/:id/primary   - Set primary wallet
```

---

## WebSocket Subscriptions

### Market Data (`/ws/market`)

**Subscribe:**
```json
{
  "action": "subscribe",
  "symbols": ["BTC-USD", "ETH-USD"]
}
```

**Messages:**
- `snapshot`: Full L2 orderbook snapshot
- `delta`: Incremental orderbook update
- `trade`: Executed trade
- `ticker`: 24h price statistics

### User Updates (`/ws/user`)

Requires JWT authentication token in query: `?token=YOUR_TOKEN`

**Messages:**
- `order_accepted`: Order was accepted by engine
- `order_filled`: Order was completely filled
- `order_partially_filled`: Partial fill
- `order_canceled`: Order was canceled
- `fill`: Individual trade notification
- `position_update`: Position or balance change

---

## Authentication Methods

### 1. JWT (Email/Password)
- Register with email and password
- Receive access token (valid 15 min) and refresh token (valid 7 days)
- Include token in `Authorization: Bearer {token}` header

### 2. Wallet Authentication
- Request challenge for wallet address
- Sign challenge with wallet private key
- Verify signature to complete authentication
- Creates session without centralized password

### 3. API Keys
- Generate unique API key (format: `dmx_...`)
- API key prefix visible, full key shown once at creation
- Set expiration or leave perpetual
- Use in `X-API-Key` header for requests
- Each key has separate permissions

---

## Error Handling

All errors return JSON with consistent format:

```json
{
  "error": {
    "code": "INVALID_ORDER",
    "message": "Order price must be positive",
    "status": 400
  }
}
```

Common error codes:
- `INVALID_ORDER`: Order validation failed
- `INSUFFICIENT_BALANCE`: Account balance too low
- `RATE_LIMITED`: Request rate limit exceeded
- `AUTHENTICATION_REQUIRED`: Request needs authentication
- `INVALID_TOKEN`: Token is expired or invalid
- `NOT_FOUND`: Resource doesn't exist
- `INTERNAL_ERROR`: Server error

---

## Performance Characteristics

- **Throughput**: ~10,000 orders/sec (limited by downstream engine)
- **Latency**: <100ms p99 for order submission
- **WebSocket Scalability**: 50K+ concurrent connections per instance
- **Rate Limits**:
  - 100 requests/minute per user (authenticated)
  - 10 requests/minute per IP (unauthenticated)

---

## Configuration

Environment variables:

```env
# Server
PORT=3000
HOST=0.0.0.0

# Database
DATABASE_URL=postgresql://user:pass@localhost/dotmx

# JWT
JWT_SECRET=your-secret-key
JWT_ACCESS_EXPIRY=900        # 15 minutes
JWT_REFRESH_EXPIRY=604800    # 7 days

# CORS
CORS_ORIGINS=http://localhost:3000,https://app.example.com
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_WINDOW_MS=60000   # 1 minute
RATE_LIMIT_MAX_REQUESTS=100

# Password Policy
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBERS=true
PASSWORD_REQUIRE_SPECIAL=true

# Optional Services
VEREXBASE_API_KEY=optional-external-service-key
```

---

## Running the API Server

```bash
# Single server mode
bun run dev:api

# With authentication
bun run dev:api-with-auth

# All services together
bun run dev:all
```

---

## Related Documentation

- [Authentication System](../security/AUTHENTICATION.md)
- [Market Data Streaming](../architecture/Market-Data-Streaming.md)
- [Matching Engine](./Matching-Engine.md)
- [API Reference](../api/API.md)
