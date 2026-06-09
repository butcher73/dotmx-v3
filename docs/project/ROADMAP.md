# DotMX v3 — Product & Engineering Roadmap

**Last Updated:** June 2026
**Status:** Feature-complete, entering launch phase

---

## Current State

All core features are implemented. The Rust engine passes 119 tests at 10.6M ops/sec. The API server, management server, market data pipeline, and custodial wallet system are wired and functional. Two frontends (admin + trading) and a 10-bot market maker system are ready.

**We are at the inflection point between "done building" and "live service."**

---

## Phase 1: Production Launch (Week 1–2)

> **Goal:** Go from code-complete to live on `api.dotmx.xyz` with confidence.

### 1.1 Testing & Validation

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 1.1.1 | End-to-end flow testing (register → deposit → trade → withdraw) | TBD | 3 days | All services running |
| 1.1.2 | Full position lifecycle tests (open, margin check, funding, liquidation) | TBD | 2 days | Perp config in place |
| 1.1.3 | Load test: 10K orders/sec sustained for 10 minutes | TBD | 1 day | Staging env |
| 1.1.4 | WebSocket stress test: 1K concurrent connections, order book fan-out | TBD | 1 day | Market data server |
| 1.1.5 | Failover test: kill engine mid-match, verify WAL recovery | TBD | 1 day | Rust engine WAL |

### 1.2 Security Hardening

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 1.2.1 | Auth audit: JWT rotation, TOTP bypass vectors, session hijacking | TBD | 1 day | — |
| 1.2.2 | SQL injection review: all raw queries in `packages/api/`, `packages/management/` | TBD | 1 day | — |
| 1.2.3 | Custodial wallet: audit HD key derivation, seed encryption at rest | TBD | 1 day | GCP KMS config |
| 1.2.4 | Rate limiting: tune Kong tiers per endpoint (auth vs trading vs public) | TBD | 0.5 day | Kong config |
| 1.2.5 | Penetration test: OWASP Top 10 on API surface | TBD | 1 day | Staging env |

### 1.3 Infrastructure & Deploy

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 1.3.1 | Staging environment: full stack clone with separate DB | TBD | 1 day | Docker Compose |
| 1.3.2 | Production Kong config: rotate secrets, set CORS origins, remove demo consumers | TBD | 0.5 day | DNS ready |
| 1.3.3 | DNS: point `api.dotmx.xyz` → production IP | TBD | 0.5 day | Server IP |
| 1.3.4 | SSL: Let's Encrypt cert, mount in Kong, auto-renew cron | TBD | 0.5 day | DNS propagated |
| 1.3.5 | CI/CD: configure GitHub Actions secrets for `calgary.petaex.com` | TBD | 0.5 day | SSH keys generated |
| 1.3.6 | Database backups: automated `pg_dump` + off-site storage | TBD | 0.5 day | PostgreSQL |
| 1.3.7 | Perpetual config: set funding intervals, liquidation thresholds, margin ratios per symbol | TBD | 0.5 day | Symbol list finalized |

### 1.4 Observability

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 1.4.1 | Prometheus: scrape engine metrics (latency, throughput, queue depth) | TBD | 0.5 day | Metrics endpoints |
| 1.4.2 | Grafana: dashboards for order throughput, funding settlements, liquidation events | TBD | 1 day | Prometheus |
| 1.4.3 | UptimeRobot: public health check on `/health`, `/api/health`, `/market/health` | TBD | 0.5 day | Production live |
| 1.4.4 | Alerting: on-call escalation for engine stall, DB connection loss, sweep failure | TBD | 0.5 day | Monitoring live |
| 1.4.5 | Runbook: incident response, rollback procedure, common failure modes | TBD | 1 day | — |

### 🎯 Phase 1 Exit Criteria

- [ ] All end-to-end flows pass on staging
- [ ] Engine sustains 10K orders/sec for 10 minutes with p99 < 1ms
- [ ] Security audit: zero critical/high findings
- [ ] Staging deploys from CI/CD with zero manual steps
- [ ] `curl https://api.dotmx.xyz/health` returns 200
- [ ] Database backups running and restorable
- [ ] On-call rotation defined and alerted

---

## Phase 2: Ledger & Wallet Completion (Week 3–5)

> **Goal:** Real deposits and withdrawals work end-to-end across all supported chains.

### 2.1 Deposit Pipeline

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 2.1.1 | Alchemy webhook: production verification (signature validation, reorg handling) | TBD | 2 days | Alchemy account |
| 2.1.2 | Deposit deduplication: idempotency key on `tx_hash + vout`, handle mempool vs confirmed | TBD | 1 day | — |
| 2.1.3 | Confirmation threshold: configurable block depth per chain before crediting | TBD | 0.5 day | Chain config |
| 2.1.4 | Deposit notifications: WebSocket push to user when deposit credited | TBD | 1 day | Market data WS |

### 2.2 Sweeper Automation

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 2.2.1 | Sweeper scheduler: cron-based periodic sweep (configurable interval per chain) | TBD | 1 day | — |
| 2.2.2 | Gas estimation: dynamic gas pricing per chain, max-gas-price circuit breaker | TBD | 2 days | Chain RPCs |
| 2.2.3 | Sweep retry logic: exponential backoff on TX failure, nonce management | TBD | 1 day | — |
| 2.2.4 | Warm → cold wallet sweep: configurable threshold, time-of-day restrictions | TBD | 1 day | KMS signing |

### 2.3 Withdrawal Pipeline

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 2.3.1 | Withdrawal batching: group N withdrawals into single TX to save gas | TBD | 2 days | — |
| 2.3.2 | Withdrawal approval flow: admin review for amounts > threshold | TBD | 1 day | Management API |
| 2.3.3 | Gas refund logic: deduct network fee from withdrawal amount correctly | TBD | 1 day | Gas estimation |
| 2.3.4 | Withdrawal status tracking: on-chain confirmation monitoring, user notifications | TBD | 1 day | — |

### 2.4 Reconciliation & Audit

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 2.4.1 | Balance reconciliation: cron job comparing on-chain balance vs internal ledger | TBD | 1 day | Chain RPCs |
| 2.4.2 | Discrepancy alerts: threshold-based alerting when gap exceeds configured amount | TBD | 0.5 day | Alerting |
| 2.4.3 | Audit log dashboard: management UI for `balance_audit_log` and `sweep_transactions` | TBD | 1 day | Alfred frontend |

### 🎯 Phase 2 Exit Criteria

- [ ] Deposit detected, confirmed, credited, and swept — automated, no manual steps
- [ ] Withdrawal requested, batched, broadcast, confirmed — automated, no manual steps
- [ ] Reconciliation runs daily with zero unexplained discrepancies
- [ ] Gas costs tracked per chain and below target thresholds

---

## Phase 3: Multi-Chain Expansion (Week 6–8)

> **Goal:** Support non-EVM chains to expand asset coverage.

### 3.1 Bitcoin (UTXO)

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 3.1.1 | BTC HD wallet derivation: BIP44/SegWit address generation | TBD | 2 days | — |
| 3.1.2 | Bitcoin TX construction: UTXO selection, change outputs, fee estimation | TBD | 3 days | BTC RPC |
| 3.1.3 | BTC deposit detection: block polling or Electrum/Esplora notification | TBD | 2 days | — |

### 3.2 Solana

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 3.2.1 | SOL address derivation: Ed25519 keypair from HD seed | TBD | 1 day | — |
| 3.2.2 | SOL TX construction: SPL token transfers, account creation | TBD | 2 days | Solana RPC |
| 3.2.3 | SOL deposit detection: program log parsing, confirmation depth | TBD | 1 day | — |

### 3.3 Tron

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 3.3.1 | TRX/Tron address derivation and TX construction | TBD | 2 days | Tron RPC |
| 3.3.2 | TRC-20 deposit detection and sweep | TBD | 1 day | — |

### 🎯 Phase 3 Exit Criteria

- [ ] Users can deposit and withdraw BTC, SOL, and TRX
- [ ] Each chain follows the same abstraction: `deposit → confirm → sweep → reconcile`
- [ ] Chain-specific configuration exists in `chains` table

---

## Phase 4: New Product Features (Month 2–4)

> **Goal:** Expand product offering beyond perpetuals.

### 4.1 Spot Margin Trading

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 4.1.1 | Margin account model: borrow/lend balances, interest accrual | TBD | 3 days | DB migration |
| 4.1.2 | Interest rate curves: utilization-based dynamic rates per asset | TBD | 2 days | — |
| 4.1.3 | Margin calls: notification, partial liquidation, full liquidation | TBD | 3 days | Liquidation engine |
| 4.1.4 | Spot margin UI: borrow, repay, margin ratio display | TBD | 3 days | Frontend |

### 4.2 Lending & Borrowing

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 4.2.1 | Lending pool: deposit assets, earn yield proportional to utilization | TBD | 2 days | DB migration |
| 4.2.2 | Collateral management: over-collateralization ratios, multi-asset collateral | TBD | 2 days | — |
| 4.2.3 | Yield dashboard: current APY, earned interest, lending history | TBD | 2 days | Frontend |

### 4.3 Copy Trading

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 4.3.1 | Lead trader registration: performance tracking, P&L attribution | TBD | 2 days | — |
| 4.3.2 | Trade replication: proportional order mirroring to follower accounts | TBD | 3 days | Order engine |
| 4.3.3 | Follower UI: discover leads, allocate capital, view performance | TBD | 3 days | Frontend |
| 4.3.4 | Revenue share: configurable profit split between lead and platform | TBD | 1 day | Fee system |

### 4.4 Advanced Charting

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 4.4.1 | Custom indicators: user-defined scripts, community indicator library | TBD | 3 days | TradingView |
| 4.4.2 | Multi-timeframe layout: sync 4+ charts with independent timeframes | TBD | 2 days | Frontend |
| 4.4.3 | Drawing tools: trend lines, Fibonacci, support/resistance persistence | TBD | 2 days | Frontend |

### 🎯 Phase 4 Exit Criteria

- [ ] Spot margin trading live on BTC and ETH pairs
- [ ] Lending pools active with competitive APY
- [ ] At least 5 lead traders onboarded for copy trading
- [ ] Charting on par with TradingView standalone

---

## Phase 5: Options Trading (Month 3–5)

> **Goal:** Launch European-style crypto options.

### 5.1 Core Options Engine

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 5.1.1 | Options order book: separate instrument type with strike/expiry dimensions | TBD | 5 days | Engine refactor |
| 5.1.2 | Pricing: Black-Scholes with implied vol surface, Greeks calculation | TBD | 5 days | — |
| 5.1.3 | Expiration settlement: auto-exercise ITM, cash settlement at expiry | TBD | 3 days | Mark price feed |
| 5.1.4 | Margin for options: SPAN-like portfolio margining | TBD | 3 days | Risk engine |

### 5.2 Options Frontend

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 5.2.1 | Options chain UI: strike/expiry matrix, bid/ask/IV/Greeks display | TBD | 5 days | Frontend |
| 5.2.2 | P&L chart: payoff diagram at expiration for single and multi-leg positions | TBD | 3 days | Frontend |
| 5.2.3 | Strategy builder: covered call, protective put, straddle, iron condor | TBD | 3 days | Frontend |

### 🎯 Phase 5 Exit Criteria

- [ ] BTC and ETH options live with weekly and monthly expiries
- [ ] Greeks updated in real-time
- [ ] Options volume > 10% of perps volume within 30 days

---

## Phase 6: Mobile Apps (Month 4–6)

> **Goal:** Native trading experience on iOS and Android.

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 6.1 | React Native scaffold: shared code with existing hooks and services | TBD | 3 days | — |
| 6.2 | Trading UI: order entry, position management, chart (lightweight) | TBD | 2 weeks | API stable |
| 6.3 | Wallet UI: deposit address QR, withdrawal flow, transaction history | TBD | 1 week | Wallet APIs |
| 6.4 | Push notifications: price alerts, liquidation warnings, funding settlement | TBD | 1 week | Notification infra |
| 6.5 | Biometric auth: FaceID/TouchID + PIN fallback | TBD | 3 days | — |
| 6.6 | App Store / Play Store submission and review | TBD | 1 week | — |

### 🎯 Phase 6 Exit Criteria

- [ ] Both apps published on App Store and Google Play
- [ ] Mobile MAU > 20% of total within 60 days
- [ ] Crash-free rate > 99.5%

---

## Phase 7: ZK Rollup & L2 Settlement (Month 6–12)

> **Goal:** Deliver on the core promise of zero-knowledge settlement on Ethereum.

### 7.1 ZK Proof System

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 7.1.1 | Proving system selection: evaluate Halo2 vs Plonky3 vs RISC Zero | TBD | 1 week | — |
| 7.1.2 | State transition circuit: prove correctness of batched order matching | TBD | 4 weeks | Proving system |
| 7.1.3 | Proof generation pipeline: batch trades → generate proof → submit to L1 | TBD | 3 weeks | Circuit done |
| 7.1.4 | Proof recursion/aggregation: compress N batch proofs into one L1 submission | TBD | 2 weeks | — |

### 7.2 L1 Smart Contracts

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 7.2.1 | State root verifier: Solidity contract accepting ZK proofs, updating state root | TBD | 2 weeks | Proof system |
| 7.2.2 | Deposit bridge: lock ETH/ERC-20 on L1, credit on L2 | TBD | 1 week | — |
| 7.2.3 | Forced withdrawal: L1 exit path if L2 operator is unresponsive | TBD | 1 week | — |
| 7.2.4 | Contract audit: external firm (Trail of Bits, OpenZeppelin, etc.) | TBD | 3 weeks | Contracts done |
| 7.2.5 | Formal verification: critical paths (bridge, state transition) | TBD | 2 weeks | Audit done |

### 7.3 Data Availability

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 7.3.1 | Calldata posting: post trade batch data to Ethereum | TBD | 1 week | L1 contracts |
| 7.3.2 | DA committee or EigenDA/Celestia integration (if calldata too expensive) | TBD | 2 weeks | Cost analysis |

### 🎯 Phase 7 Exit Criteria

- [ ] ZK proofs generated and verified on Ethereum testnet (Sepolia/Holesky)
- [ ] Deposit → trade → withdraw roundtrip settled on L1
- [ ] Smart contracts audited with zero critical findings
- [ ] L2 throughput > 1K TPS with proof generation < 5 minutes per batch

---

## Phase 8: DeFi & Governance (Month 8–12+)

> **Goal:** Decentralize protocol governance and expand DeFi integrations.

### 8.1 Governance

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 8.1.1 | DMX token contract: ERC-20 with voting delegation (or upgrade existing) | TBD | 1 week | — |
| 8.1.2 | DAO treasury: multi-sig with timelock, proposal submission for fee parameters | TBD | 2 weeks | Token contract |
| 8.1.3 | Voting UI: proposal creation, vote delegation, quorum tracking | TBD | 2 weeks | Frontend |

### 8.2 Cross-Chain Derivatives

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 8.2.1 | Bridge integration: Wormhole or LayerZero for cross-chain messaging | TBD | 3 weeks | L1 contracts |
| 8.2.2 | Cross-chain margin: collateral on one chain, position on another | TBD | 2 weeks | Bridge live |

### 8.3 Trading Bot Marketplace

| # | Task | Owner | Effort | Dependencies |
|---|---|---|---|---|
| 8.3.1 | Sandboxed strategy execution environment | TBD | 3 weeks | — |
| 8.3.2 | Backtesting engine: historical data replay, performance metrics | TBD | 2 weeks | Historical data |
| 8.3.3 | Marketplace UI: strategy discovery, performance stats, revenue share | TBD | 2 weeks | Frontend |

---

## Phase 9: Under Consideration

Features that have been discussed but not yet committed to the roadmap:

| Feature | Rationale | Trigger for Commitment |
|---|---|---|
| **Prediction markets** | Binary outcome markets (yes/no contracts) | User demand + regulatory clarity |
| **NFT perpetuals** | Floor-price futures for NFT collections | NFT derivatives market matures |
| **ZK privacy layer** | Encrypted order books with ZK proofs | Demand for MEV-resistant trading |
| **Social trading features** | Profiles, leaderboards, trader chat | Copy trading proves popular |
| **Cross-chain spot aggregation** | Best-execution routing across DEXs | Bridge infrastructure mature |

---

## Ongoing Responsibilities (All Phases)

These run continuously alongside feature work:

| Area | Cadence | Owner |
|---|---|---|
| Security monitoring and incident response | 24/7 on-call | TBD |
| Database backup verification | Weekly restore test | TBD |
| Performance regression testing | Per-release | TBD |
| Kong/NGINX config review | Monthly | TBD |
| Dependency updates (security patches) | Weekly | TBD |
| API documentation sync | Per-release | TBD |
| Fee structure competitiveness review | Monthly | TBD |
| Community support (Discord/Telegram) | Daily | TBD |

---

## Key Metrics to Track

| Metric | Target | Phase |
|---|---|---|
| Engine P99 latency | < 1ms | 1 |
| Order throughput sustained | > 10K ops/sec | 1 |
| WebSocket fan-out latency | < 50ms P99 | 1 |
| Deposit → credited time | < block confirmation + 30s | 2 |
| Withdrawal → broadcast time | < 5 min (manual), < 30s (auto) | 2 |
| Gas cost per sweep | < 0.5% of swept value | 2 |
| Liquidation execution time | < 5s from trigger | 1 |
| Proof generation time | < 5 min per batch | 7 |
| Monthly active traders | TBD baseline at launch | All |
| 30-day retention | TBD baseline at launch | All |
| System uptime | > 99.9% | All |

---

## References

- [Design Changes: Original vs Current](DESIGN_CHANGES.md)
- [Module Status & Feature Checklist](../backend/MODULE_STATUS.md)
- [Database Schema Audit](../audits/DB_SCHEMA_AUDIT_REPORT.md)
- [Database Refactoring Tasks](../backend/REFACTORING_TASKS.md)
- [Production Checklist](../../dotmx-backend/docs/operations/PRODUCTION_CHECKLIST.md)
- [Deployment Checklist](../../dotmx-backend/docs/operations/DEPLOYMENT_CHECKLIST.md)
- [Product Overview](../frontend/PRODUCT_OVERVIEW.md)
- [Endpoint Reference](../backend/ENDPOINT_REFERENCE.md)
