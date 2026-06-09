# DotMX v3 — Documentation

## Quick Navigation

| I want to... | Go here |
|---|---|
| Understand the product | [Product Overview](frontend/PRODUCT_OVERVIEW.md) |
| Set up local dev | [Backend Docs → Quickstart](../dotmx-backend/docs/intro/quickstart.md) |
| See the roadmap | [Roadmap](project/ROADMAP.md) |
| Find an endpoint | [Endpoint Reference](backend/ENDPOINT_REFERENCE.md) |
| Check module status | [Module Status](backend/MODULE_STATUS.md) |
| Read audit reports | [Audits](audits/) |
| Deploy to production | [Backend Docs → Deployment](../dotmx-backend/docs/operations/DEPLOYMENT.md) |

---

## Directory Layout

```
docs/
├── README.md                        # ← you are here
├── project/                         # Project-wide docs
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
    ├── architecture/                # Engine, matching, orderbook, etc.
    ├── features/                    # Chains, tokens, delta hedging
    ├── api/                         # REST API reference
    ├── security/                    # Auth & account security
    ├── operations/                  # Deployment, DB, Kong, CI/CD
    ├── testing/                     # Test guides & checklists
    └── reference/                   # OpenAPI spec, port config, fees
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

### Frontend Engineers
- [UI Component Library](frontend/ui-components/README.md)
- [Shared Components](frontend/ui-components/SHARED_COMPONENTS.md)
- [Design System (Alfred)](alfred/DESIGN_SYSTEM.md)

### DevOps / SRE
- [START HERE](backend/START_HERE.md) — production deploy
- [Backend Ops → Deployment](../dotmx-backend/docs/operations/DEPLOYMENT.md)

### Auditors / QA
- [Business Logic Audit](audits/BUSINESS_LOGIC_AUDIT.md)
- [Security Audit](audits/SECURITY_AUDIT.md)
- [Symbol Format Audit](audits/SYMBOL_FORMAT_AUDIT.md)
- [DB Schema Audit](audits/DB_SCHEMA_AUDIT_REPORT.md)
