# DotMX Exchange API Documentation

OpenAPI 3.1.0 specification for the DotMX perpetual futures exchange.

## Viewing the Documentation

### Option 1: Swagger UI (Interactive)

Start the API server with Swagger UI enabled:

```bash
pnpm dev:api
```

Then visit: **http://localhost:3000/swagger**

The interactive Swagger UI allows you to:
- Browse all API endpoints
- View request/response schemas
- Test API calls directly in your browser
- Download the OpenAPI spec

### Option 2: Redoc (Clean Reading)

Use Redoc for a clean, readable documentation format:

```bash
# Install Redoc CLI globally
npm install -g redoc-cli

# Serve the documentation
redoc-cli serve docs/openapi.json --port 8080
```

Then visit: **http://localhost:8080**

### Option 3: VS Code Extension

Install the "OpenAPI (Swagger) Editor" extension in VS Code:

1. Install extension: `42Crunch.vscode-openapi`
2. Open `docs/openapi.json`
3. Use the preview pane to view rendered documentation

### Option 4: Online Viewers

Upload `docs/openapi.json` to any of these online viewers:
- [Swagger Editor](https://editor.swagger.io/)
- [Redoc Try](https://redocly.github.io/redoc/)
- [Stoplight](https://stoplight.io/)

## API Overview

### Base URLs

- **Development**: `http://localhost:3000`
- **Production**: `https://api.dotmx.xyz`

### Authentication

The API uses JWT Bearer tokens for authentication:

```bash
# Obtain token via login
curl -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "yourpassword"
  }'

# Use token in requests
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "symbol": "BTC-USD",
    "side": "BUY",
    "type": "LIMIT",
    "price": 50000,
    "quantity": 1.5,
    "timeInForce": "GTC"
  }'

# Place a stop-limit order
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "symbol": "BTC-USD",
    "side": "SELL",
    "type": "STOP_LIMIT",
    "price": 48000,
    "stopPrice": 49000,
    "quantity": 1.5
  }'

# Place a post-only order (maker only)
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer YOUR_ACCESS_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "symbol": "BTC-USD",
    "side": "BUY",
    "type": "LIMIT",
    "price": 49500,
    "quantity": 1.5,
    "timeInForce": "POST_ONLY"
  }'
```

### Order Types

The API supports the following order types:

#### Standard Orders
- **LIMIT** - Place order at specified price, rest on book if not immediately filled
- **MARKET** - Execute immediately at best available price; unfilled remainder cancelled

#### Advanced Orders
- **STOP_LIMIT** - Trigger limit order when market price crosses stop price
  - BUY: Triggers when trade price ≥ stopPrice
  - SELL: Triggers when trade price ≤ stopPrice
- **STOP_MARKET** - Trigger market order when market price crosses stop price (same trigger logic)

### Time-in-Force Options

- **GTC** (Good-Till-Cancel) - Order rests on book until matched or cancelled
- **IOC** (Immediate-Or-Cancel) - Matches what's available immediately; cancels unfilled remainder
- **FOK** (Fill-Or-Kill) - Rejects entirely if not fully fillable immediately
- **POST_ONLY** - Rejects if order would immediately cross the spread (maker-only)

### API Endpoints

#### Health Checks
- `GET /` - API information
- `GET /health` - Basic health check
- `GET /health/ready` - Readiness check
- `GET /health/live` - Liveness check

#### Orders
- `POST /orders` - Place a new order (supports LIMIT, MARKET, STOP_LIMIT, STOP_MARKET)
- `GET /orders/:orderId` - Get order status
- `DELETE /orders/:orderId` - Cancel an order
- `PATCH /orders/:orderId` - Modify an open order (cancel-replace)

#### Advanced Orders
- `POST /orders/batch` - Submit up to 20 orders in one request
- `POST /orders/leverage` - Place leveraged perpetual order (1×–50×)

#### Market Data
- `GET /market/orderbook/:symbol` - Get order book
- `GET /market/symbols` - List all trading pairs
- `GET /market/ticker/:symbol` - Get 24h ticker for symbol
- `GET /market/tickers` - Get all tickers

### WebSocket Feeds

Real-time market data and user updates via WebSocket:

```javascript
// Market data feed
const ws = new WebSocket('ws://localhost:3000/ws/market');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('Market update:', data);
};

// Subscribe to specific symbol
ws.send(JSON.stringify({
  type: 'subscribe',
  symbol: 'BTC-USD'
}));
```

```javascript
// User updates feed (requires authentication)
const ws = new WebSocket('ws://localhost:3000/ws/user?token=YOUR_ACCESS_TOKEN');

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);
  console.log('User update:', data);
};
```

## Fee Structure

DotMX uses a Binance Futures-style fee structure:

### Transaction Fees (10 VIP Tiers)

| Tier | Maker Fee | Taker Fee | 30D Volume | DMX Holding |
|------|-----------|-----------|------------|-------------|
| 0 (Regular) | **-0.005%** (rebate) | 0.035% | $0 | 0 |
| 1 (Bronze) | **-0.006%** | 0.034% | $50K | 500 |
| 2 (Silver) | **-0.008%** | 0.032% | $250K | 2.5K |
| 3 (Gold) | **-0.010%** | 0.030% | $1M | 10K |
| 5 (Diamond) | **-0.015%** | 0.025% | $15M | 150K |
| 9 (Legendary) | **-0.025%** | 0.015% | $1.5B | 15M |

**DMX Token Discount**: Pay fees with DMX for 25% discount on taker fees

### Funding Fees

- **Interval**: Every 8 hours (00:00, 08:00, 16:00 UTC)
- **Rate Cap**: ±0.015%
- **Model**: Smoothed tanh based on open interest skew
- **Tier Discounts**: 5-50% for payers

### Liquidation Penalty

- **Base Rate**: 0.4% of liquidated notional
- **Distribution**: 50% insurance fund, 50% liquidator reward
- **Progressive**: 25% partial liquidation before full
- **Tier Discounts**: 5-50%

## Rate Limits

- **Public endpoints**: 1200 requests/minute
- **Authenticated endpoints**: 2400 requests/minute
- **Order placement**: 100 orders/second

Rate limit headers:
```
X-RateLimit-Limit: 2400
X-RateLimit-Remaining: 2350
X-RateLimit-Reset: 1737390060
```

## Error Codes

| Code | Description |
|------|-------------|
| 400 | Bad Request - Invalid parameters |
| 401 | Unauthorized - Missing or invalid token |
| 403 | Forbidden - Insufficient permissions |
| 404 | Not Found - Resource doesn't exist |
| 429 | Too Many Requests - Rate limit exceeded |
| 500 | Internal Server Error |
| 503 | Service Unavailable |

Example error response:
```json
{
  "error": "Insufficient balance",
  "code": "INSUFFICIENT_BALANCE",
  "details": {
    "required": 50000,
    "available": 30000
  }
}
```

## Code Examples

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const api = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json'
  }
});

// Login
const { data } = await api.post('/auth/login', {
  email: 'user@example.com',
  password: 'password123'
});

// Set token for subsequent requests
api.defaults.headers.common['Authorization'] = `Bearer ${data.tokens.access_token}`;

// Place order
const order = await api.post('/orders', {
  userId: 'user_123',
  symbol: 'BTC-USD',
  side: 'BUY',
  type: 'LIMIT',
  price: 50000,
  quantity: 1.5
});

console.log('Order ID:', order.data.orderId);
```

### Python

```python
import requests

BASE_URL = 'http://localhost:3000'

# Login
response = requests.post(f'{BASE_URL}/auth/login', json={
    'email': 'user@example.com',
    'password': 'password123'
})

token = response.json()['tokens']['access_token']

# Place order
headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

order = requests.post(f'{BASE_URL}/orders', json={
    'userId': 'user_123',
    'symbol': 'BTC-USD',
    'side': 'BUY',
    'type': 'LIMIT',
    'price': 50000,
    'quantity': 1.5
}, headers=headers)

print(f"Order ID: {order.json()['orderId']}")
```

### cURL

```bash
# Login
TOKEN=$(curl -s -X POST http://localhost:3000/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123"}' \
  | jq -r '.tokens.access_token')

# Place order
curl -X POST http://localhost:3000/orders \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user_123",
    "symbol": "BTC-USD",
    "side": "BUY",
    "type": "LIMIT",
    "price": 50000,
    "quantity": 1.5
  }'
```

## Generating Client SDKs

Use the OpenAPI spec to generate client libraries in any language:

```bash
# Install OpenAPI Generator
npm install -g @openapitools/openapi-generator-cli

# Generate TypeScript client
openapi-generator-cli generate \
  -i docs/openapi.json \
  -g typescript-axios \
  -o clients/typescript

# Generate Python client
openapi-generator-cli generate \
  -i docs/openapi.json \
  -g python \
  -o clients/python

# Generate Go client
openapi-generator-cli generate \
  -i docs/openapi.json \
  -g go \
  -o clients/go
```

Supported languages: TypeScript, Python, Go, Java, Rust, PHP, Ruby, C#, Swift, Kotlin, and many more.

## Support

- **Documentation**: https://docs.dotmx.xyz
- **API Status**: https://status.dotmx.xyz
- **Discord**: https://discord.gg/dotmx
- **Email**: api@dotmx.xyz

## Changelog

### v1.0.0 (2026-01-20)
- Initial OpenAPI specification
- Core trading endpoints (orders, market data)
- Binance Futures-style fee structure
- WebSocket real-time feeds
- JWT authentication
