# DotMX v3 — Cryptocurrency Exchange Platform

## Monorepo Structure

```
dotmx-v3/
├── dotmx-backend/     # Core trading engine (Bun/Elysia + Rust)
│   ├── apps/          # Server entry points
│   ├── packages/      # Shared packages (pnpm workspace)
│   ├── rust-engine/   # High-performance matching engine (Rust)
│   └── scripts/       # DB migrations, deployment scripts
├── dotmx-frontend/     # User trading platform (Next.js 15)
├── dotmx-alfred/      # Admin management dashboard (Next.js 16)
└── dotmx-mm-bot/      # Market maker bot (Bun/TypeScript)
```

## Quick Start

```bash
# Install all dependencies
pnpm install

# Start backend
pnpm dev:api

# Start frontends
pnpm dev:frontend   # Trading platform (:3000)
pnpm dev:alfred     # Admin dashboard (:3310)

# Run tests
pnpm test:backend   # TypeScript tests
pnpm test:rust      # Rust engine tests

# Database
pnpm db:reset       # Reset and seed database
```

## Architecture

```
Internet → Kong/Nginx (:8080) → API Server (:3003)
                              → Market Data (:3002)
                              → Management (:3004)
                              → Engine (:3001, internal)

Frontend (Next.js :3000) → Nginx (:8080) → Backend
Alfred (Next.js :3310)   → Nginx (:8080) → Backend
MM Bot                    → Nginx (:8080) → Backend
```

## Key Technologies

- **Backend:** Bun, Elysia.js, TypeScript
- **Engine:** Rust (10.6M ops/sec matching)
- **Frontend:** Next.js 15/16, React 19, Tailwind CSS 4
- **Database:** PostgreSQL (dual DB: dotmx_users + dotmx)
- **Gateway:** Kong / Nginx
- **Infrastructure:** Docker Compose
