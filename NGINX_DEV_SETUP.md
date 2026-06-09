# API GATEWAY DEV SETUP - CRITICAL INSTRUCTIONS

## ⚠️ IMPORTANT: DO NOT IGNORE THIS ⚠️

This is a recurring issue that keeps breaking the dev environment. READ THIS CAREFULLY.

## The Problem

In development, we use **NGINX (port 8080)** to proxy API requests, NOT direct connections to backend services.

## ⚠️ CRITICAL: NGINX Path Prefixes ⚠️

**NGINX is configured with specific path prefixes - you MUST include them:**

```nginx
# /opt/homebrew/etc/nginx/nginx.conf
location /marketdata/  → http://127.0.0.1:3002
location /api/         → http://127.0.0.1:3003
location /admin/       → http://127.0.0.1:3004
location /engine/      → http://127.0.0.1:3001
```

**This means ALL requests MUST include the path prefix!**

### ❌ WRONG - Missing NGINX Path Prefixes (BREAKS EVERYTHING)

```env
# WRONG - Missing /api prefix (goes nowhere!)
NEXT_PUBLIC_API_URL=http://localhost:8080

# WRONG - Missing /marketdata prefix (404 error!)
NEXT_PUBLIC_MARKETDATA_URL=http://localhost:8080
NEXT_PUBLIC_MARKETDATA_WS_URL=ws://localhost:8080/ws

# WRONG - Bypassing NGINX entirely
NEXT_PUBLIC_API_URL=http://localhost:3003
NEXT_PUBLIC_MARKETDATA_URL=http://localhost:3002
```

### ✅ CORRECT - Through NGINX with Path Prefixes

**For dotmx-frontend (.env.local):**
```env
# ✅ CORRECT - /api prefix routes to port 3003
NEXT_PUBLIC_API_URL=http://localhost:8080/api

# ✅ CORRECT - /marketdata prefix routes to port 3002
NEXT_PUBLIC_MARKETDATA_URL=http://localhost:8080/marketdata
NEXT_PUBLIC_MARKETDATA_WS_URL=ws://localhost:8080/marketdata/ws
```

**For dotmx-alfred (.env.local):**
```env
# ✅ CORRECT - /admin prefix routes to port 3004
NEXT_PUBLIC_MANAGEMENT_API_URL=http://localhost:8080/admin/management
```

## Why This Matters

**CORRECT ARCHITECTURE:**

1. **Frontend** (dotmx-frontend): Separate Next.js app on `http://localhost:3000` - **Trading interface**
2. **Alfred** (dotmx-alfred): Separate Next.js app on `http://localhost:3310` - **Admin dashboard**
3. **NGINX**: Reverse proxy on `http://localhost:8080` - **API Gateway**
4. **Backend Services** (behind NGINX):
   - Engine API: `localhost:3001` (order matching) → **NGINX path: /engine/**
   - Market Data: `localhost:3002` (klines, ticker, WS) → **NGINX path: /marketdata/**
   - API with Auth: `localhost:3003` (REST API) → **NGINX path: /api/**
   - Management API: `localhost:3004` (admin endpoints) → **NGINX path: /admin/**

**⚠️ CRITICAL: You MUST include the NGINX path prefix in ALL URLs!**

**How it works:**

**For dotmx-frontend (port 3000):**
- Set `NEXT_PUBLIC_API_URL=http://localhost:8080/api` in `.env.local`
- Set `NEXT_PUBLIC_MARKETDATA_URL=http://localhost:8080/marketdata` in `.env.local`
- Frontend makes calls to NGINX at `http://localhost:8080/{path_prefix}/*`
- NGINX strips the prefix and forwards to backend services:
  - `http://localhost:8080/api/v1/orders` → `http://127.0.0.1:3003/v1/orders`
  - `http://localhost:8080/marketdata/api/v1/klines` → `http://127.0.0.1:3002/api/v1/klines`
  - `ws://localhost:8080/marketdata/ws` → `ws://127.0.0.1:3002/ws`

**For dotmx-alfred (port 3310):**
- Set `NEXT_PUBLIC_MANAGEMENT_API_URL=http://localhost:8080/admin/management` in `.env.local`
- Alfred makes API calls to NGINX at `http://localhost:8080/admin/*`
- NGINX forwards: `http://localhost:8080/admin/...` → `http://127.0.0.1:3004/...`

## Setup Instructions

### 1. Configure .env.local Files

**For dotmx-frontend/.env.local:**
```bash
# ✅ CORRECT - Through NGINX Gateway with path prefixes
NEXT_PUBLIC_API_URL=http://localhost:8080/api
NEXT_PUBLIC_MARKETDATA_URL=http://localhost:8080/marketdata
NEXT_PUBLIC_MARKETDATA_WS_URL=ws://localhost:8080/marketdata/ws

# ❌ NEVER DO THIS - Missing path prefixes or bypassing NGINX
# NEXT_PUBLIC_API_URL=http://localhost:8080           # Missing /api prefix!
# NEXT_PUBLIC_MARKETDATA_URL=http://localhost:8080    # Missing /marketdata prefix!
# NEXT_PUBLIC_API_URL=http://localhost:3003           # Bypasses NGINX!
# NEXT_PUBLIC_MARKETDATA_URL=http://localhost:3002    # Bypasses NGINX!
```

**For dotmx-alfred/.env.local:**
```bash
# ✅ CORRECT - Management API through NGINX with /admin prefix
NEXT_PUBLIC_MANAGEMENT_API_URL=http://localhost:8080/admin/management
```

### 2. NGINX Configuration

NGINX runs on port 8080 and routes requests to backend services based on path prefixes.

**NGINX config location:** `/opt/homebrew/etc/nginx/nginx.conf`

**Start NGINX:**

```bash
# Start NGINX
nginx

# Or restart if already running
nginx -s reload

# Check if NGINX is running
ps aux | grep nginx

# Stop NGINX
nginx -s stop
```

**NGINX automatically routes (with path prefix stripping):**
- `/marketdata/` → Market Data Server (port 3002)
  - Example: `http://localhost:8080/marketdata/api/v1/klines` → `http://127.0.0.1:3002/api/v1/klines`
  - Example: `ws://localhost:8080/marketdata/ws` → `ws://127.0.0.1:3002/ws`
- `/api/` → API Server (port 3003)
  - Example: `http://localhost:8080/api/v1/orders` → `http://127.0.0.1:3003/v1/orders`
- `/admin/` → Management API (port 3004)
  - Example: `http://localhost:8080/admin/...` → `http://127.0.0.1:3004/...`
- `/engine/` → Engine API (port 3001)
  - Example: `http://localhost:8080/engine/...` → `http://127.0.0.1:3001/...`

### 3. Start Development

```bash
# 1. Start NGINX
nginx
# Or reload if already running: nginx -s reload

# 2. Start Docker services (Postgres, Redis, NATS)
cd dotmx-backend
docker-compose -f docker-compose.dev.yml up -d postgres redis nats

# 3. Start backend services (SEPARATE terminal)
cd dotmx-backend
# Option A: Start all services
pnpm run dev
# Option B: Start individual services
pnpm run dev:engine    # Engine API on port 3001 (accessed via /engine/)
pnpm run dev:marketdata # Market data on port 3002 (accessed via /marketdata/)
pnpm run dev:api       # API server on port 3003 (accessed via /api/)

# 4. Start frontend Next.js app (SEPARATE terminal, SEPARATE app)
cd dotmx-frontend
pnpm run dev           # Runs on port 3000

# 5. Start Alfred admin interface (SEPARATE terminal, SEPARATE app)
cd dotmx-alfred
pnpm run dev           # Runs on port 3310
```

**NOTE:** Frontend and Alfred are completely independent Next.js applications!

### 4. Access Applications

- **Frontend** (dotmx-frontend): `http://localhost:3000` ← **Main trading interface**
- **Alfred** (dotmx-alfred): `http://localhost:3310` ← **Admin dashboard (SEPARATE APP)**
- **NGINX Gateway**: `http://localhost:8080` ← **API gateway**

**API calls:**
- Frontend at `localhost:3000` makes calls to NGINX:
  - `http://localhost:8080/api/*` → API server
  - `http://localhost:8080/marketdata/*` → Market data server
  - `ws://localhost:8080/marketdata/ws` → Market data WebSocket
- Alfred at `localhost:3310` makes calls to NGINX:
  - `http://localhost:8080/admin/*` → Management server
- NGINX forwards to backend services (3001-3004) with path prefix stripping

## Quick Checklist

1. Verify correct .env.local configuration:

   ```bash
   # For frontend
   cd dotmx-frontend
   cat .env.local | grep -E "API_URL|MARKETDATA"
   ```

2. Should show:

   **For dotmx-frontend:**
   ```
   NEXT_PUBLIC_API_URL=http://localhost:8080/api
   NEXT_PUBLIC_MARKETDATA_URL=http://localhost:8080/marketdata
   NEXT_PUBLIC_MARKETDATA_WS_URL=ws://localhost:8080/marketdata/ws
   ```

   **For dotmx-alfred:**
   ```
   NEXT_PUBLIC_MANAGEMENT_API_URL=http://localhost:8080/admin/management
   ```

   **⚠️ NOTICE THE PATH PREFIXES: /api, /marketdata, /admin - They are REQUIRED!**

3. If it's wrong, FIX IT:

   ```bash
   # Edit .env.local in the appropriate project directory
   # For frontend (dotmx-frontend/.env.local):
   NEXT_PUBLIC_API_URL=http://localhost:8080/api
   NEXT_PUBLIC_MARKETDATA_URL=http://localhost:8080/marketdata
   NEXT_PUBLIC_MARKETDATA_WS_URL=ws://localhost:8080/marketdata/ws
   
   # For alfred (dotmx-alfred/.env.local):
   NEXT_PUBLIC_MANAGEMENT_API_URL=http://localhost:8080/admin/management
   ```

   **⚠️ DO NOT FORGET THE PATH PREFIXES: /api, /marketdata, /admin**

4. Restart Next.js dev server:
   ```bash
   # Kill the server and restart
   pnpm run dev
   ```
## Common Mistakes

### ❌ Mistake #1: Missing NGINX path prefixes

```env
# WRONG! Missing /marketdata prefix
NEXT_PUBLIC_MARKETDATA_URL=http://localhost:8080
NEXT_PUBLIC_MARKETDATA_WS_URL=ws://localhost:8080/ws

# WRONG! Missing /api prefix
NEXT_PUBLIC_API_URL=http://localhost:8080
```

**Why wrong?** NGINX requires path prefixes to route correctly. Without them, requests go to nowhere (404).

**Correct:** 
```env
NEXT_PUBLIC_MARKETDATA_URL=http://localhost:8080/marketdata  # ← /marketdata prefix!
NEXT_PUBLIC_MARKETDATA_WS_URL=ws://localhost:8080/marketdata/ws  # ← /marketdata prefix!
NEXT_PUBLIC_API_URL=http://localhost:8080/api  # ← /api prefix!
```

### ❌ Mistake #2: Bypassing NGINX by connecting directly to backend

```env
NEXT_PUBLIC_API_URL=http://localhost:3003  # WRONG! (bypasses NGINX)
NEXT_PUBLIC_MARKETDATA_URL=http://localhost:3002  # WRONG! (bypasses NGINX)
NEXT_PUBLIC_API_URL=http://localhost:3001  # WRONG! (bypasses NGINX)
```

**Why wrong?** Bypasses NGINX's routing. Always go through NGINX at port 8080 with proper path prefix.

**Correct:** `http://localhost:8080/api`, `http://localhost:8080/marketdata`, etc.

### ❌ Mistake #3: Not restarting Next.js after .env change

Environment variables are only loaded when Next.js starts. After editing `.env.local`, ALWAYS restart:

```bash
# Kill the dev server and restart
pnpm run dev
```

### ❌ Mistake #4: Not starting NGINX

API calls will fail if NGINX isn't running:

```bash
# Check if NGINX is running
ps aux | grep nginx

# Start NGINX if not running
nginx

# Reload NGINX config
nginx -s reload

# Stop NGINX
nginx -s stop
```

## Architecture Summary

```
┌──────────────────────────────────┐   ┌──────────────────────────────────┐
│ Frontend (dotmx-frontend)        │   │ Alfred (dotmx-alfred)            │
│ http://localhost:3000            │   │ http://localhost:3310            │
│ SEPARATE Next.js App             │   │ SEPARATE Next.js App             │
└────────────────┬─────────────────┘   └────────────────┬─────────────────┘
                 │                                       │
                 │ Direct HTTP calls                     │ Direct HTTP calls
                 │ to NGINX Gateway                      │ to NGINX Gateway
                 │                                       │
                 ↓                                       ↓
                ┌────────────────────────────────────────────┐
                │ NGINX Reverse Proxy                        │
                │ http://localhost:8080                      │
                │  - WebSocket support                       │
                │  - Path prefix routing                     │
                │  - Routes (strips prefix):                 │
                │    /marketdata/ → MarketData (3002)        │
                │    /api/ → API Server (3003)               │
                │    /admin/ → Management (3004)             │
                │    /engine/ → Engine (3001)                │
                └───────────────────┬────────────────────────┘
                                    │
                                    ↓
                ┌────────────────────────────────────────────┐
                │ Backend Services                           │
                │  • Engine API: 3001 (order matching)       │
                │  • Market Data: 3002 (klines, ticker, WS)  │
                │  • API w/ Auth: 3003 (REST endpoints)      │
                │  • Management: 3004 (admin)                │
                └────────────────────────────────────────────┘
```

## Remember

**Frontend and Alfred are SEPARATE Next.js applications running independently!**

- **Frontend (dotmx-frontend):** Port 3000
  - Calls `http://localhost:8080/api` → API server
  - Calls `http://localhost:8080/marketdata` → Market data server
- **Alfred (dotmx-alfred):** Port 3310
  - Calls `http://localhost:8080/admin/management` → Management server
- **Always route through NGINX with path prefixes** - never call backend services directly (ports 3001-3004)

**⚠️ REMEMBER: NGINX path prefixes are REQUIRED: /api, /marketdata, /admin, /engine**

---

Last updated: 2026-02-09
