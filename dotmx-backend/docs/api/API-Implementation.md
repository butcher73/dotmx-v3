# Module 01 — API Service (ElysiaJS)

## Purpose
- External interface for clients and bots
- Auth, rate limiting, request validation
- Submit **commands** to the engine asynchronously
- Provide **read APIs** from read-model DB (orders, trades, positions, balances)

## Non-Goals
- API must **not** run matching logic
- API must **not** be a source of truth for order state (engine is)

## Recommended Endpoints (Phase 1 — Matching Only)
### Trading
- `POST /v1/orders` create new order
- `DELETE /v1/orders/:orderId` cancel order
- `GET /v1/orders/:orderId` order status
- `GET /v1/openOrders?symbol=...`
- `GET /v1/trades?symbol=...&limit=...` (recent trades)

### Market Data
- `GET /v1/depth?symbol=...&limit=...` (L2 snapshot)
- `GET /v1/ticker/24hr?symbol=...` (optional)
- WebSocket:
  - `depth@100ms` (L2 diff)
  - `trade` stream

## Command Delivery
Use a message bus to decouple API from engine:
- NATS, Redis Streams, Kafka, or custom UDP/TCP.
- For Binance-like throughput, keep it simple and fast:
  - NATS or custom TCP is a good default for internal networks.

Command envelope (minimum):
- `requestId`
- `userId`
- `symbol`
- `clientOrderId` (optional)
- `recvWindow` (optional)
- `timestamp`
- payload (side/type/price/qty/tif)

## Rate Limiting / Abuse Controls
- Per API key: order rate, cancel rate, WS subscriptions
- Add **burst** allowance but enforce sustained limits
- Apply **server-side reject** early (before hitting engine)

## Failure Semantics (Important)
- If API can’t enqueue command → return error (do not pretend accepted)
- Engine is async; API returns `orderId` but final state is in engine read model
- Use idempotency: `clientOrderId` + `userId` + `symbol`
