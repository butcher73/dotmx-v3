# DotMX v3 — Documentation

**Last Updated:** June 2026

---

## Quick Navigation

| I want to... | Go here |
|---|---|
| Understand the product | [Product Overview](frontend/PRODUCT_OVERVIEW.md) |
| Set up local dev | [Backend Docs → Quickstart](../dotmx-backend/docs/intro/quickstart.md) |
| See the roadmap | [Roadmap](project/ROADMAP.md) |
| Find an endpoint | [Endpoint Reference](backend/ENDPOINT_REFERENCE.md) |
| Check module status | [Module Status](backend/MODULE_STATUS.md) |
| Read audit reports | [Audits](audits/) |
| Deploy to production | [START HERE](backend/START_HERE.md) |

---

## Architecture at a Glance

```
dotmx-v3/
├── dotmx-backend/          # Core trading engine (Bun/Elysia + Rust)
│   ├── apps/               # Server entry points (api, engine, marketdata, management)
│   ├── packages/           # 10 packages (api, engine, gateway, ledger, management,
│   │                       #   marketdata, persistence, shared, tools, zk)
│   ├── rust-engine/        # Rust matching engine (10.6M ops/sec, 4 crates)
│   ├── scripts/            # DB schema, migrations, deploy scripts
│   ├── docker/             # Dockerfiles, Kong config, nginx dev config
│   └── docs/               # Architecture, API, operations, testing docs
├── dotmx-frontend/         # Trading platform (Next.js 15, React 19, Tailwind 4)
│   └── src/
│       ├── app/            # 33 page routes (trade, portal, landing, legal)
│       ├── components/     # ~107 components (trading, deposit, ui, landing, portfolio)
│       ├── services/       # API clients, TradingView datafeed, WebSocket managers
│       ├── hooks/          # 13 custom hooks (auth, trading, positions, analytics)
│       ├── config/         # Assets, perps, tokens, env config
│       └── libs/           # TradingView charting_library (~2,000 vendor files)
├── dotmx-alfred/           # Admin dashboard (Next.js 16, React 19, Tailwind 4)
│   ├── app/                # 14 pages (users, kyc, chains, tokens, deposits, settings...)
│   ├── components/         # 7 shared components (DataTable, Sidebar, Header...)
│   ├── src/services/       # 16 API service modules
│   └── src/hooks/          # 15 custom hooks (one per service domain)
└── dotmx-mm-bot/           # Market maker bot (Bun/TypeScript)
    └── src/                # 8 modules: engine, price-feed, inventory, risk, config...

Internet → Nginx (:8080) → API Server (:3003)
                          → Market Data (:3002)
                          → Engine (:3001, internal)
                          → Management (:3004)
```

### Key Numbers
| Metric | Value |
|---|---|
| Rust engine tests | 119 passing |
| Matching throughput | 10.6M ops/sec |
| Backend packages | 10 |
| Frontend pages | 33 |
| Alfred pages | 14 |
| Shared services | 21 |
| Audited bugs | 57 business logic + 44 security + schema drift |
| Migration files | 7 (001–007) |

---

## Directory Layout

```
docs/
├── README.md                        # ← you are here
├── project/                         # Project-wide meta docs
│   ├── ROADMAP.md                   # Product & engineering roadmap
│   └── DESIGN_CHANGES.md            # Original design vs. current implementation
├── audits/                          # Audit & review reports
│   ├── BUSINESS_LOGIC_AUDIT.md      # 57 bugs across settlement/fees/liquidation
│   ├── SECURITY_AUDIT.md            # Auth, SQLi, secrets, wallet vulnerabilities
│   ├── SYMBOL_FORMAT_AUDIT.md       # Symbol format inconsistencies
│   └── DB_SCHEMA_AUDIT_REPORT.md    # Schema drift between code and migrations
├── backend/                         # Backend reference docs
│   ├── START_HERE.md                # Production deployment quick start
│   ├── MODULE_STATUS.md             # Feature completeness per module
│   ├── REFACTORING_TASKS.md         # DB schema refactoring tracker
│   ├── ENDPOINT_REFERENCE.md        # Full endpoint + port map
│   └── NGINX_DEV_SETUP.md           # Dev env nginx proxying guide
├── alfred/                          # Admin dashboard (dotmx-alfred)
│   ├── DESIGN_SYSTEM.md             # Component patterns & design tokens
│   └── DESIGN_TOKENS.md             # CSS variable system
├── frontend/                        # Trading platform (dotmx-frontend)
│   ├── PRODUCT_OVERVIEW.md          # User-facing product description
│   ├── IMPLEMENTATION_CHECKLIST.md  # Component library checklist
│   ├── SHARED_UI_COMPONENTS_SUMMARY.md
│   ├── SECURITY_PAGE_DESIGN.md      # Security page design reference
│   └── ui-components/               # Component library docs
│       ├── README.md
│       ├── SHARED_COMPONENTS.md
│       ├── QUICK_REFERENCE.md
│       ├── NEW_COMPONENTS.md
│       └── VISUAL_GUIDE.md
│
└── ../dotmx-backend/docs/           # Core backend docs (kept in place)
    ├── INDEX.md                     # Full documentation index
    ├── README.md                    # Role-based navigation
    ├── intro/                       # Quickstart & product overview
    ├── architecture/                # Engine, matching, orderbook, etc. (13 docs)
    ├── features/                    # Chains, tokens, delta hedging (3 docs)
    ├── api/                         # REST API reference (4 docs)
    ├── security/                    # Auth & account security (2 docs)
    ├── operations/                  # Deployment, DB, Kong, CI/CD (12 docs)
    ├── testing/                     # Test guides & checklists (5 docs)
    └── reference/                   # OpenAPI spec, port config, fees (4 docs)
```

## Key Docs by Role

### Everyone
- [Product Overview](frontend/PRODUCT_OVERVIEW.md)
- [Roadmap](project/ROADMAP.md)
- [Design Changes](project/DESIGN_CHANGES.md)

### Backend Engineers
- [Backend Docs Index](../dotmx-backend/docs/INDEX.md) — full architecture + API reference
- [Endpoint & Port Reference](backend/ENDPOINT_REFERENCE.md)
- [Module Status](backend/MODULE_STATUS.md)
- [NGINX Dev Setup](backend/NGINX_DEV_SETUP.md)
- [DB Refactoring Tasks](backend/REFACTORING_TASKS.md)

### Frontend Engineers
- [UI Component Library](frontend/ui-components/README.md)
- [Shared Components](frontend/ui-components/SHARED_COMPONENTS.md)
- [Design System (Alfred)](alfred/DESIGN_SYSTEM.md)
- [Security Page Design](frontend/SECURITY_PAGE_DESIGN.md)

### DevOps / SRE
- [START HERE](backend/START_HERE.md) — production deploy
- [Backend Ops → Deployment](../dotmx-backend/docs/operations/DEPLOYMENT.md)
- [NGINX Dev Setup](backend/NGINX_DEV_SETUP.md)

### Auditors / QA
- [Business Logic Audit](audits/BUSINESS_LOGIC_AUDIT.md) — 57 unfixed bugs
- [Security Audit](audits/SECURITY_AUDIT.md) — 44 vulnerabilities
- [Symbol Format Audit](audits/SYMBOL_FORMAT_AUDIT.md) — Format inconsistencies
- [DB Schema Audit](audits/DB_SCHEMA_AUDIT_REPORT.md) — Schema drift
