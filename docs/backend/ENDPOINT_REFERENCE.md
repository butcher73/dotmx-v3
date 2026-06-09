# DotMX Endpoint & Port Reference

> **Development setup** — Nginx reverse proxy on `:8080`. For production, see
> [START HERE](START_HERE.md) which uses Kong API Gateway on `:80/443`.

---

## Architecture Overview

```
Frontend (Next.js)        Nginx Gateway            Backend (Bun/Elysia)
  localhost:3000    →    localhost:8080    →       localhost:3003
                         /api/*  → :3003 (strips /api/)
                         /marketdata/*  → :3002 (strips /marketdata/)
                         /engine/*  → :3001 (strips /engine/)
                         /admin/*  → :3004 (strips /admin/)
```

## The Golden Rule

**Frontend NEVER calls backend ports directly.** Everything goes through nginx at `:8080`.

- Frontend `NEXT_PUBLIC_API_URL` = `http://localhost:8080/api`
- ApiClient prepends this to every endpoint path
- Nginx location `/api/` has `proxy_pass http://api_server/` (trailing `/` strips the `/api/` prefix)

**Therefore:** If ApiClient calls path `/v1/orders`, the full URL is:
```
http://localhost:8080/api/v1/orders
                     ^^^^ ^^^^^^^^^^
                     nginx   path
                     strips
                     this
```
Nginx forwards `GET /v1/orders` to `http://127.0.0.1:3003/v1/orders`.

**Never put `/api` in the ApiClient endpoint path** — it's already in the base URL.

---

## Port Assignments

| Service | Port | Description |
|---------|------|-------------|
| Frontend (Next.js) | 3000 | Web UI |
| Engine Server | 3001 | Matching engine (internal, NATS communication) |
| Market Data Server | 3002 | Real-time market data + WebSocket |
| API Server (with auth) | 3003 | Main REST API |
| Management Server | 3004 | Admin panel API |
| Nginx Gateway | 8080 | Reverse proxy — **only port frontend talks to** |

---

## Nginx Proxy Rules (`/opt/homebrew/etc/nginx/nginx.conf`)

| Nginx Location | Upstream | Port | Prefix Stripping |
|----------------|----------|------|------------------|
| `/api/` | api_server | 3003 | `/api/` stripped → backend gets `/...` |
| `/marketdata/` | marketdata_server | 3002 | `/marketdata/` stripped |
| `/engine/` | engine_server | 3001 | `/engine/` stripped |
| `/admin/` | management_server | 3004 | `/admin/` stripped |

---

## Frontend Environment Variables (`.env.local`)

```env
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_MARKETDATA_URL=http://localhost:8080/marketdata
NEXT_PUBLIC_MARKETDATA_WS_URL=ws://localhost:8080/marketdata/ws
```

---

## Complete Endpoint Map

All ApiClient paths are relative to `NEXT_PUBLIC_API_URL` (`http://localhost:8080/api`).

### Auth (`/auth/...`)

| Method | ApiClient Path | Backend Path |
|--------|---------------|--------------|
| POST | `/auth/register` | `/auth/register` |
| POST | `/auth/login` | `/auth/login` |
| POST | `/auth/refresh` | `/auth/refresh` |
| POST | `/auth/logout` | `/auth/logout` |
| GET | `/auth/me` | `/auth/me` |
| PATCH | `/auth/me` | `/auth/me` |
| GET | `/auth/api-keys` | `/auth/api-keys` |
| POST | `/auth/api-keys` | `/auth/api-keys` |
| DELETE | `/auth/api-keys/{id}` | `/auth/api-keys/{id}` |
| GET | `/auth/sessions` | `/auth/sessions` |
| DELETE | `/auth/sessions/{id}` | `/auth/sessions/{id}` |
| GET | `/auth/2fa/status` | `/auth/2fa/status` |
| POST | `/auth/2fa/setup` | `/auth/2fa/setup` |
| POST | `/auth/2fa/verify` | `/auth/2fa/verify` |
| POST | `/auth/2fa/disable` | `/auth/2fa/disable` |
| GET | `/auth/whitelist` | `/auth/whitelist` |
| PATCH | `/auth/whitelist/toggle` | `/auth/whitelist/toggle` |
| POST | `/auth/whitelist` | `/auth/whitelist` |
| DELETE | `/auth/whitelist/{id}` | `/auth/whitelist/{id}` |
| POST | `/auth/password/reset/request` | `/auth/password/reset/request` |
| POST | `/auth/password/reset/verify` | `/auth/password/reset/verify` |
| POST | `/auth/password/change` | `/auth/password/change` |

### Trading (`/v1/...`)

| Method | ApiClient Path | Backend Path |
|--------|---------------|--------------|
| POST | `/v1/orders` | `/v1/orders` |
| DELETE | `/v1/orders/{orderId}` | `/v1/orders/{orderId}` |
| GET | `/v1/orders/{orderId}` | `/v1/orders/{orderId}` |
| GET | `/v1/openOrders` | `/v1/openOrders` |
| GET | `/v1/trades` | `/v1/trades` |
| POST | `/v1/orders/leverage` | `/v1/orders/leverage` |
| POST | `/v1/orders/batch` | `/v1/orders/batch` |
| PATCH | `/v1/orders/{orderId}` | `/v1/orders/{orderId}` |

### Positions (`/v1/...`)

| Method | ApiClient Path | Backend Path |
|--------|---------------|--------------|
| GET | `/v1/positions` | `/v1/positions` |
| GET | `/v1/positions/{symbol}` | `/v1/positions/{symbol}` |
| POST | `/v1/positions/{symbol}/close` | `/v1/positions/{symbol}/close` |
| GET | `/v1/portfolio` | `/v1/portfolio` |
| GET | `/v1/funding-history` | `/v1/funding-history` |

### Market Data (`/v1/market/...`)

| Method | ApiClient Path | Backend Path |
|--------|---------------|--------------|
| GET | `/v1/market/ticker/24hr` | `/v1/market/ticker/24hr` |
| GET | `/v1/market/depth` | `/v1/market/depth` |
| GET | `/v1/market/trades/recent` | `/v1/market/trades/recent` |
| GET | `/v1/market/funding-rate/{symbol}` | `/v1/market/funding-rate/{symbol}` |
| GET | `/v1/market/funding-rates` | `/v1/market/funding-rates` |
| GET | `/v1/market/mark-price/{symbol}` | `/v1/market/mark-price/{symbol}` |
| GET | `/v1/market/open-interest/{symbol}` | `/v1/market/open-interest/{symbol}` |

### Assets (`/assets/...`)

| Method | ApiClient Path | Backend Path |
|--------|---------------|--------------|
| GET | `/assets/supported` | `/assets/supported` |
| GET | `/assets/deposit-tokens` | `/assets/deposit-tokens` |
| GET | `/assets/new-listings` | `/assets/new-listings` |
| GET | `/assets/networks` | `/assets/networks` |
| GET | `/assets/balances` | `/assets/balances` |
| GET | `/assets/balances/{symbol}` | `/assets/balances/{symbol}` |
| GET | `/assets/{symbol}/deposit-address/{network}` | `/assets/{symbol}/deposit-address/{network}` |
| GET | `/assets/deposit-addresses` | `/assets/deposit-addresses` |
| POST | `/assets/withdraw` | `/assets/withdraw` |
| GET | `/assets/withdrawals` | `/assets/withdrawals` |
| GET | `/assets/transactions` | `/assets/transactions` |

### Custodial Wallet (`/wallet/...`)

| Method | ApiClient Path | Backend Path |
|--------|---------------|--------------|
| GET | `/wallet/chains` | `/wallet/chains` |
| POST | `/wallet/deposit-address` | `/wallet/deposit-address` |
| GET | `/wallet/deposit-addresses` | `/wallet/deposit-addresses` |
| GET | `/wallet/deposits` | `/wallet/deposits` |
| GET | `/wallet/balances` | `/wallet/balances` |

### Other

| Method | ApiClient Path | Backend Path |
|--------|---------------|--------------|
| GET | `/health` | `/health` |
| GET | `/symbols` | `/symbols` |

---

## Backend Route Prefixes (Elysia)

If adding a new route file, use these prefixes:

| Route Category | Elysia Prefix | Example Backend Path |
|----------------|---------------|---------------------|
| Auth | `/auth` | `/auth/login` |
| Assets | `/assets` | `/assets/balances` |
| Trading | `/v1` | `/v1/orders` |
| Positions | `/v1` | `/v1/positions` |
| Market Data | `/v1/market` | `/v1/market/depth` |
| Wallet | `/wallet` | `/wallet/chains` |
| Webhooks | `/webhooks` | `/webhooks/alchemy/deposits` |
| Export | `/v1/export` | `/v1/export/trades` |
| Webhook Subs | `/v1/webhook-subscriptions` | `/v1/webhook-subscriptions` |
| Loyalty | `/loyalty` | `/loyalty/points` |

**DO NOT use `/api/v1` as a prefix** — the `/api` part comes from nginx, not the backend.

---

## Quick Diagnostic Commands

```bash
# Check what's running on each port
lsof -i :3000 -i :3001 -i :3002 -i :3003 -i :3004 -i :8080

# Test backend directly
curl http://localhost:3003/health
curl http://localhost:3003/v1/orders  # should return "Authentication required"

# Test through nginx (same as what frontend does)
curl http://localhost:8080/api/health
curl http://localhost:8080/api/v1/orders  # should return "Authentication required"

# Check nginx config
nginx -t

# Reload nginx after config change
nginx -s reload
```
