# DotMX v3 - AI Coding Agent Instructions

## Project Overview
DotMX is a high-performance cryptocurrency exchange platform with a **monorepo structure** consisting of:
- **dotmx-backend/** - Core trading engine (Rust + TypeScript microservices)
- **dotmx-alfred/** - Admin management dashboard (Next.js)
- **dotmx-frontend/** - User-facing trading platform (Next.js)

## Critical Architecture Principles

### Service Communication Pattern
**All external traffic flows through Kong API Gateway** - backend services are NOT directly exposed:
```
Internet → Kong (:80/443) → Internal Services (3001-3004)
```
- API Server: Port 3003 (via `/api`)
- MarketData: Port 3002 (via `/market`)
- Management: Port 3004 (via `/api/management`)
- Engine: Port 3001 (internal only, NATS communication)

**Never expose backend ports directly** - Kong handles CORS, rate limiting, IP restrictions, and authentication.

### Backend Route Creation Pattern (Elysia.js)
All backend routes follow the **function factory pattern** with dependency injection:

```typescript
// packages/{api,management}/src/routes/feature.routes.ts
export function createFeatureRoutes(db: DatabaseService, otherDeps?) {
  return new Elysia({ prefix: '/feature' })
    .get('/', async ({ query }) => { /* ... */ })
    .post('/', async ({ body }) => { /* ... */ }, {
      body: t.Object({ /* validation schema */ }),
      detail: { tags: ['feature'], summary: 'Description' }
    });
}
```

Wire routes in server entry point (e.g., `apps/api-server-with-auth.ts`):
```typescript
app.use(createFeatureRoutes(db, dependencies))
```

### Database Schema Conventions

**Two-Database Architecture:**
- `dotmx_users` - User authentication, profiles, KYC, audit logs, sessions
- `dotmx` - Trading engine, orders, trades, positions, balances, market data
- Separation for security and scalability - user data isolated from trading data

**Table & Column Naming:**
- Tables: `snake_case` plural (e.g., `users`, `deposit_addresses`, `withdrawal_requests`)
- Columns: `snake_case` (e.g., `created_at`, `user_id`, `password_hash`)
- Foreign keys: `{table_singular}_id` pattern (e.g., `user_id`, `chain_id`, `token_id`)
- Junction tables: `{table1}_{table2}` (e.g., `user_sessions`)

**Standard Column Patterns:**
```sql
-- Primary key (ALL tables)
id UUID PRIMARY KEY DEFAULT gen_random_uuid()

-- Timestamps (required on all tables)
created_at TIMESTAMPTZ DEFAULT NOW()
updated_at TIMESTAMPTZ DEFAULT NOW()

-- Soft deletes (when applicable)
deleted_at TIMESTAMPTZ

-- Status enums with constraints
status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'suspended'))

-- Flexible metadata
metadata JSONB DEFAULT '{}'
```

**Foreign Key Conventions:**
- Always use explicit `REFERENCES` with `ON DELETE CASCADE` for dependent data
- Use `ON DELETE SET NULL` for optional references
```sql
user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE
chain_id UUID REFERENCES chains(id) ON DELETE SET NULL
```

**Index Naming:**
- Single column: `idx_{table}_{column}` (e.g., `idx_users_email`)
- Multi-column: `idx_{table}_{col1}_{col2}` (e.g., `idx_deposits_user_status`)
- Unique constraints: `UNIQUE(col1, col2)` with descriptive comment

**Migration File Pattern:**
Location: `dotmx-backend/scripts/db/migrations/`

```sql
-- {Description of migration purpose}
-- Migration {number}: {What it does}

BEGIN;

-- ============================================
-- {Table/Feature Name}
-- ============================================
CREATE TABLE IF NOT EXISTS table_name (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    -- columns...
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_table_column ON table_name(column);

COMMIT;
```

**Migration Numbering:**
- Format: `{NNN}_{descriptive_name}.sql` (e.g., `001_users.sql`, `003_custodial_wallet_system.sql`)
- Run sequentially - numbers ensure order
- Never modify old migrations - create new ones for changes

**Query Patterns:**
- **No ORM** - write raw SQL with parameterized queries
- Always use `$1`, `$2` placeholders (never string concatenation)
- Check soft deletes: `WHERE deleted_at IS NULL`
- Check status: `WHERE status = 'active'` (or appropriate states)
- Users query: `WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`

**Data Type Standards:**
- IDs: `UUID` (always use full UUID in queries - never truncate for lookups)
- Money/decimals: `DECIMAL(36, 18)` for crypto amounts
- Strings: `VARCHAR(N)` with appropriate length limits
- Text: `TEXT` for unlimited content
- Booleans: `BOOLEAN DEFAULT FALSE`
- Timestamps: `TIMESTAMPTZ` (with timezone)
- JSON: `JSONB` (binary, not JSON)

**Case Transformation:**
- Backend returns `snake_case` from DB
- Frontend transforms to `camelCase` in service layer
- Keep SQL queries in `snake_case`

**Database Connection:**
- Uses two databases: `dotmx_users` (user/auth) and `dotmx` (exchange/trading)
- Connection via environment variables:
  ```bash
  DB_HOST=localhost
  DB_PORT=5432
  DB_USER=kowito
  DB_PASSWORD=
  USER_DB_NAME=dotmx_users
  EXCHANGE_DB_NAME=dotmx
  ```
- No connection pooling lib - uses native PostgreSQL client
- Query execution: `db.queryOne()`, `db.query()` with parameterized values

**Running Migrations:**
```bash
# Apply specific migration
./scripts/db/run-migration.sh 001_users

# Deploy all migrations (with seed data)
./scripts/db/deploy-db.sh development

# Reset database completely (caution!)
./scripts/db/reset-and-seed.sh
```

**Creating New Migrations:**
1. Create file: `scripts/db/migrations/{NNN}_{description}.sql`
2. Use next available number (check existing migrations)
3. Wrap in `BEGIN; ... COMMIT;`
4. Include rollback comments if complex
5. Test with `./scripts/db/run-migration.sh {NNN}_{description}`

**Common Query Patterns in Code:**
```typescript
// Single row with type safety
const user = await db.queryOne<UserType>(
  'SELECT * FROM users WHERE id = $1 AND deleted_at IS NULL',
  [userId]
);

// Multiple rows
const users = await db.query<UserType>(
  'SELECT * FROM users WHERE status = $1 ORDER BY created_at DESC LIMIT $2',
  ['active', 10]
);

// Insert returning ID
const result = await db.query(
  'INSERT INTO table_name (col1, col2) VALUES ($1, $2) RETURNING id',
  [value1, value2]
);

// Update with timestamp
await db.query(
  'UPDATE users SET email = $1, updated_at = NOW() WHERE id = $2',
  [email, userId]
);

// Conditional update (dynamic WHERE)
const updates: string[] = [];
const values: any[] = [];
let paramIndex = 1;

if (email) {
  updates.push(`email = $${paramIndex++}`);
  values.push(email);
}
if (updates.length > 0) {
  updates.push(`updated_at = NOW()`);
  values.push(userId);
  await db.query(
    `UPDATE users SET ${updates.join(', ')} WHERE id = $${paramIndex}`,
    values
  );
}
```

## Development Workflows

### Running Services Locally
```bash
# Backend (from dotmx-backend/)
pnpm run dev:api          # API server on :3003
pnpm run dev:management   # Management API on :3004
pnpm run dev:marketdata   # Market data on :3002
pnpm run dev:engine       # Engine server on :3001
./deploy-production.sh    # Full stack with Kong

# Frontend (from dotmx-alfred/)
npm run dev               # Runs on :3310

# Frontend (from dotmx-frontend/)
npm run dev               # Runs on default Next.js port
```

**Package manager**: Use `pnpm` for backend, `npm` for frontends (check package-lock.json/pnpm-lock.yaml).

### Testing Backend
```bash
bun test packages/                          # All tests
bun test packages/api/tests/feature.test.ts # Specific test
bun test packages/*/tests/integration/      # Integration tests only
```

Tests use **Bun's built-in test runner** - no Jest. Pattern: `describe()`, `test()`, `expect()`.

### Rust Engine
Located in `dotmx-backend/rust-engine/` with **10.6M ops/sec** matching capability:
```bash
cd rust-engine
cargo test           # Run tests
cargo bench          # Performance benchmarks
```

Engine communicates via **NATS JetStream** - TypeScript services send commands, Rust processes orders.

## Frontend Conventions (dotmx-alfred)

### App Router Structure
```
app/{route}/page.tsx    # Pages (Next.js 16 App Router)
components/             # Shared components (EditUserModal, DataTable, etc.)
src/services/          # API clients (users.ts, auth.ts)
src/hooks/             # Custom hooks (useUsers, useAuth)
src/libs/api.ts        # Base API client with auth headers
```

### API Service Pattern
Services in `src/services/*.ts` use centralized API client:
```typescript
// src/services/feature.ts
import { api } from '@/libs/api';

export const featureService = {
  get: (id: string) => api.get<Response>(`/feature/${id}`),
  update: (id: string, data: Payload) => api.patch(`/feature/${id}`, data)
};
```

API base URL from env: `NEXT_PUBLIC_MANAGEMENT_API_URL` (defaults to `http://localhost:8080/admin/management`)

### Component Patterns
- **Client components**: Use `'use client'` directive (most components need this)
- **State management**: React hooks (useState, useEffect) - no external state library
- **Styling**: Tailwind CSS 4 with design tokens in `globals.css`
- **Icons**: Lucide React (import from `lucide-react`)

## Common Patterns & Gotchas

### Backend Response Format
Management API endpoints should return full updated objects, not just `{ success: true }`:
```typescript
// ✅ Correct
return { success: true, user: updatedUserObject };

// ❌ Incomplete - frontend expects data
return { success: true };
```

### Authentication Flow
- JWT tokens stored in `localStorage` (key: `alfred_auth_token`)
- Backend validates with `Authorization: Bearer <token>` header
- Use `.derive()` in Elysia for auth middleware (see `packages/api/src/routes/positions.routes.ts`)

### Password Hashing
Backend uses **Bun's built-in Argon2id**:
```typescript
const hash = await Bun.password.hash(password, {
  algorithm: 'argon2id',
  memoryCost: 65536,
  timeCost: 3,
});
```

### TypeScript Typing
- Shared types between frontend/backend via service interfaces
- Backend uses `t.Object()` from `elysia` for runtime validation
- Frontend interfaces often mirror backend but with `camelCase`

## Documentation Navigation
- Architecture: `dotmx-backend/docs/architecture/`
- API Reference: `dotmx-backend/docs/api/`
- Production Setup: `dotmx-backend/PRODUCTION_CONFIG.md`
- Module Status: `docs/backend/MODULE_STATUS.md` (feature completeness tracker)

## Key Files to Reference
- Backend route wiring: `dotmx-backend/apps/api-server-with-auth.ts`
- Management routes: `dotmx-backend/packages/management/src/routes/`
- Shared utilities: `dotmx-backend/packages/shared/src/`
- Frontend API client: `dotmx-alfred/src/libs/api.ts`
- Design system: `dotmx-alfred/DESIGN_SYSTEM.md`

## When Adding New Features
1. **Backend route**: Create `{feature}.routes.ts` with factory function
2. **Types**: Define in route file or `../types/index.ts`
3. **Wire route**: Import and `.use()` in server entry point
4. **Frontend service**: Add methods to `src/services/{feature}.ts`
5. **UI components**: Create page in `app/{route}/page.tsx`
6. **Test**: Add `bun test` for backend, manual test for frontend

## Critical Commands
```bash
# Database setup and migrations
cd dotmx-backend/scripts/db
./setup-test.sh                    # Setup local test database
./run-migration.sh 001_users       # Run specific migration
./deploy-db.sh development         # Deploy all migrations (dev/staging/production)
./reset-and-seed.sh                # Wipe and reseed database

# Development servers
cd dotmx-backend
pnpm run dev:api                   # API server on :3003
pnpm run dev:management            # Management API on :3004
pnpm run dev:marketdata            # Market data on :3002
pnpm run dev:engine                # Engine server on :3001
./deploy-production.sh             # Full stack with Kong

# Production deployment validation
./test-production-config.sh

# Kong config validation
./scripts/validate-kong-config.sh
```
