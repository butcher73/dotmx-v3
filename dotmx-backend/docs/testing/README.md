# Test Structure Organization

## Overview

Tests are organized into 4 categories based on execution model and dependencies:

```
dotmx-backend/
├── packages/
│   ├── api/tests/                    ✅ Unit Tests (API routes)
│   ├── engine/tests/                 ✅ Unit Tests (Order matching)
│   ├── gateway/tests/                ✅ Unit Tests (Event bus)
│   ├── ledger/tests/                 ✅ Unit Tests (Ledger/Balance)
│   ├── marketdata/tests/             ✅ Unit Tests (Market data)
│   ├── persistence/tests/            ✅ Unit Tests (DB persistence)
│   ├── shared/tests/                 ✅ Unit Tests (Services)
│   ├── tools/tests/                  ✅ Unit Tests (CLI tools)
│   └── zk/tests/                     ✅ Unit Tests (ZK proofs)
│
└── tests/
    ├── integration.test.ts           📋 Integration Tests
    ├── integration/                  (Optional - for future integration tests)
    ├── performance/load.test.ts      ⚡ Performance Tests (Load, Stress, Benchmarks)
    └── e2e/                          ⚠️  E2E Tests (Requires server)
        ├── auth-workflow.e2e.test.ts
        ├── trading-workflow.e2e.test.ts
        ├── marketdata-workflow.e2e.test.ts
        └── websocket-integration.e2e.test.ts
```

## Test Categories

### 1. Unit Tests (packages/*/tests/)
- **Purpose:** Test individual services and components in isolation
- **Dependencies:** Mocked - no database, no server
- **Speed:** Fast (1-3 seconds total)
- **Command:** `bun test packages/`

**Examples:**
- `packages/shared/tests/auth.service.test.ts` (50 tests)
- `packages/shared/tests/fee-calculation.service.test.ts` (35 tests)
- `packages/engine/tests/orderbook.test.ts` (12 tests)

### 2. Integration Tests (tests/integration/)
- **Purpose:** Test service interactions and database operations
- **Dependencies:** Real database (dotmx_users_test)
- **Speed:** Moderate (30-60 seconds)
- **Command:** `bun test tests/integration/`

**Examples:**
- `tests/integration.test.ts` (1 test - placeholder)

### 3. Performance Tests (tests/performance/)
- **Purpose:** Benchmark throughput, latency, and stress scenarios
- **Dependencies:** None - standalone mock implementations
- **Speed:** Variable (30-60 seconds)
- **Command:** `bun test tests/performance/load.test.ts`

**Includes:**
- Load Testing (10 scenarios)
- Stress Testing (5 scenarios)
- Benchmark Suite (10 metrics)

**Metrics Measured:**
- Throughput (ops/sec)
- Latency (p50, p95, p99)
- Memory efficiency
- Jitter analysis

### 4. E2E Tests (tests/e2e/)
- **Purpose:** Test complete user workflows through real API
- **Dependencies:** ⚠️ **Running server required on localhost:3000**
- **Speed:** Slow (30-60 seconds)
- **Command:** 
  ```bash
  # Terminal 1: Start server
  bun run start-dev
  
  # Terminal 2: Run E2E tests
  bun test tests/e2e/
  ```

**Test Files:**
- `auth-workflow.e2e.test.ts` (30 tests)
  - User registration and login
  - Password reset and change
  - Wallet authentication
  - Multi-session management

- `trading-workflow.e2e.test.ts` (21 tests)
  - Complete trading flow
  - Market order execution
  - Order validation and cancellation

- `marketdata-workflow.e2e.test.ts` (19 tests)
  - Orderbook depth queries
  - Ticker endpoints
  - Performance validation
  - Data consistency checks

- `websocket-integration.e2e.test.ts` (15 tests)
  - WebSocket connections
  - Market data streaming
  - Order updates
  - Multi-connection handling

---

## Running Tests

### Development Workflow

```bash
# 1. Run unit tests first (fastest feedback)
bun test packages/

# 2. Start the server in another terminal
bun run start-dev

# 3. Run E2E tests
bun test tests/e2e/

# 4. Run performance tests
bun test tests/performance/load.test.ts
```

### CI/CD Pipeline

```bash
#!/bin/bash

# Step 1: Run unit tests (parallel, no server needed)
echo "Running unit tests..."
bun test packages/

# Step 2: Start server in background
echo "Starting server..."
bun run start-dev &
SERVER_PID=$!

# Step 3: Wait for server to be ready
sleep 5

# Step 4: Run E2E tests
echo "Running E2E tests..."
bun test tests/e2e/

# Step 5: Run performance tests
echo "Running performance tests..."
bun test tests/performance/

# Step 6: Cleanup
kill $SERVER_PID
```

### By Category

```bash
# Unit tests only (no server)
bun test packages/

# Unit + Integration tests (database required)
bun test packages/ tests/integration/

# Performance tests only (no server)
bun test tests/performance/load.test.ts

# E2E tests only (server required)
bun test tests/e2e/

# All tests (server required)
bun test

# With coverage
bun test --coverage

# With concurrency limit (avoid deadlocks)
bun test packages/ --concurrency 1
```

---

## Test Statistics

### By Category

| Category | Location | Count | Time |
|----------|----------|-------|------|
| Unit Tests | `packages/*/tests/` | 530 | 1-3s |
| Integration | `tests/integration/` | 1 | 10-30s |
| Performance | `tests/performance/` | 25 | 30-60s |
| E2E Tests | `tests/e2e/` | 85 | 30-60s |
| **Total** | | **641** | |

### By Package (Unit Tests)

| Package | Tests | Files |
|---------|-------|-------|
| shared | 359 | 10 files |
| api | 40+ | 5+ files |
| engine | 37 | 3 files |
| gateway | 9 | 1 file |
| persistence | 8 | 1 file |
| ledger | 45 | 2 files |
| marketdata | 5 | 1 file |
| zk | 3 | 1 file |
| tools | 3 | 1 file |

---

## Test Coverage Goals

| Category | Current | Target | Status |
|----------|---------|--------|--------|
| Unit Tests | 530 | 500+ | ✅ EXCEEDS |
| Integration | 1 | 50+ | ⏳ In Progress |
| API Coverage | 172 | 90+ | ✅ EXCEEDS |
| E2E Tests | 85 | 45+ | ✅ EXCEEDS |
| Performance | 25 | 25 | ✅ DONE |
| **Total** | **813** | **750+** | ✅ **EXCEEDS** |

---

## Adding New Tests

### Adding a Unit Test

1. Create test file in package's `tests/` directory
2. Name it following pattern: `feature.test.ts` or `service.test.ts`
3. Example:
   ```typescript
   // packages/api/tests/custom.routes.test.ts
   import { describe, test, expect } from 'bun:test';
   
   describe('Custom Routes', () => {
     test('should handle request', () => {
       expect(true).toBe(true);
     });
   });
   ```
4. Run: `bun test packages/api/tests/custom.routes.test.ts`

### Adding an E2E Test

1. Create test file in `tests/e2e/` directory
2. Name it following pattern: `workflow-name.e2e.test.ts`
3. Use Supertest for HTTP requests and WebSocket clients
4. Example:
   ```typescript
   // tests/e2e/custom-flow.e2e.test.ts
   import { describe, test, expect } from 'bun:test';
   import request from 'supertest';
   
   const api = 'http://localhost:3000';
   
   describe('Custom Workflow', () => {
     test('should complete workflow', async () => {
       const response = await request(api)
         .get('/health')
         .expect(200);
       
       expect(response.body).toBeDefined();
     });
   });
   ```
5. Run: `bun test tests/e2e/custom-flow.e2e.test.ts`

### Adding a Performance Test

1. Create test file in `tests/performance/` directory
2. Use utility functions for timing and statistics
3. Example:
   ```typescript
   // tests/performance/custom-benchmark.test.ts
   import { describe, test, expect } from 'bun:test';
   
   describe('Custom Benchmark', () => {
     test('should complete under 100ms', () => {
       const start = performance.now();
       // operation
       const duration = performance.now() - start;
       
       expect(duration).toBeLessThan(100);
     });
   });
   ```
5. Run: `bun test tests/performance/custom-benchmark.test.ts`

---

## Known Issues & Solutions

### Deadlocks During Parallel Test Execution

**Problem:** PostgreSQL deadlocks when running all unit tests in parallel

**Solution:** Run with concurrency limit
```bash
bun test packages/ --concurrency 1
```

**Affected Tests:**
- `ReferralService > applyReferralCode`
- `ReferralService > handleFirstTrade`
- `VIPTierService > getTierHistory`
- `FeeCalculationService > Fee Recording`

### E2E Tests Fail if Server Not Running

**Problem:** E2E tests expect server on localhost:3000

**Solution:** Start server before running E2E tests
```bash
# Terminal 1
bun run start-dev

# Terminal 2
bun test tests/e2e/
```

### Performance Tests Are Slow

**Problem:** Benchmark tests take 30-60 seconds

**Solution:** Run performance tests separately or on CI
```bash
# Skip in local development
bun test packages/ tests/e2e/
```

---

## Best Practices

✅ **Do:**
- Run unit tests frequently during development
- Run E2E tests before pushing to main
- Use meaningful test names that describe the behavior
- Mock external dependencies in unit tests
- Use fixtures for common test data
- Separate unit, integration, and E2E tests by directory

❌ **Don't:**
- Mix unit and E2E tests in the same file
- Rely on test execution order
- Create hard-coded test data that varies by environment
- Skip tests without documenting why
- Run all tests in parallel if experiencing deadlocks

---

## References

- [Bun Test Documentation](https://bun.sh/docs/test/overview)
- [Supertest Documentation](https://github.com/visionmedia/supertest)
- [TEST_COVERAGE.md](./TEST_COVERAGE.md) - Detailed test statistics
