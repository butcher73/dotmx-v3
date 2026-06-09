# Design Changes: Original Plan vs. Current Implementation

This document tracks the differences between the original DotMX design and the actual implementation.

**Last Updated:** January 2026  
**Status:** Production Implementation Complete

---

## 📋 Executive Summary

DotMX was originally conceived as a high-performance spot trading exchange. During implementation, the scope expanded significantly to include **perpetual futures** as the primary product, comprehensive authentication systems, and enterprise-grade security features.

### Key Changes
- ✅ **Perpetual Futures**: Full implementation (funding, liquidation, insurance fund)
- ✅ **10-Tier VIP System**: Binance-equivalent with maker rebates
- ✅ **Authentication**: JWT, TOTP 2FA, EVM wallet signatures
- ✅ **OpenAPI 3.1.0**: Complete API documentation with Swagger UI
- ⚠️ **ZK Proofs**: Deferred (not production critical)
- ⚠️ **Frontend**: Separate repo, not included in backend docs

---

## 1. Product Scope

### Original Design
```
- Spot trading only
- Simple maker/taker fees
- Basic order types (limit, market)
- No leverage or margin
```

### Current Implementation
```
✅ Perpetual Futures Trading
   - Up to 100x leverage
   - Cross and isolated margin
   - Funding rate mechanism (8-hour, ±0.015% cap)
   - Progressive liquidation (25% partial, then full)
   - Insurance fund (per-symbol)
   - Binance Futures fee parity

✅ Spot Trading Support
   - CEX-like order matching
   - Standard maker/taker fees
   - Advanced order types
```

**Why Changed:**  
Market demand for perpetual futures is significantly higher than spot trading. Implementing futures first allows faster go-to-market with a more compelling product.

---

## 2. Fee Structure

### Original Design
```yaml
Maker Fee: 0.10%
Taker Fee: 0.20%
Tiers: None or basic (2-3 levels)
Discounts: Simple volume-based
```

### Current Implementation
```yaml
10 VIP Tiers (Tier 0 - Tier 9):
  Maker: -0.005% to -0.025% (REBATES)
  Taker: 0.035% to 0.015%
  
Tier Requirements:
  - 30-day volume (USDT)
  - DMX token holdings
  - Combined scoring

DMX Discount: 25% off taker fees
Funding Fee: Dynamic, 8-hour intervals
Liquidation: 0.4% penalty
```

**Why Changed:**  
Competitive analysis showed Binance and Bybit dominate with maker rebates and deep tier structures. To compete, DotMX adopted industry-standard tiering with maker incentives.

**Implementation Files:**
- [perpetual-fee.service.ts](dotmx-backend/packages/shared/src/services/perpetual-fee.service.ts)
- [perpetual_fee_schema.sql](dotmx-backend/packages/shared/src/db/perpetual_fee_schema.sql)
- [init_perpetual_fees.sql](dotmx-backend/packages/shared/src/db/init_perpetual_fees.sql)
- [PERPETUAL_FEES.md](dotmx-backend/docs/PERPETUAL_FEES.md)

---

## 3. Authentication & Security

### Original Design
```
- Basic API key authentication
- No user accounts mentioned
- No 2FA
- No wallet integration
```

### Current Implementation
```
✅ Multi-Method Authentication:
   1. Email/Password (JWT-based)
   2. EVM Wallet Signatures (viem)
   3. API Keys (scoped permissions)

✅ Two-Factor Authentication:
   - TOTP (Google Authenticator) using otpauth
   - Backup codes (hashed storage)
   - 2FA enforcement for withdrawals

✅ Account Security:
   - Session management
   - Trusted devices
   - Login attempt tracking
   - IP whitelisting/blacklisting
   - Security alerts
   - Audit logs

✅ Wallet Integration:
   - EVM signature verification (viem)
   - Challenge-response protocol
   - Multi-wallet linking
   - Internal HD wallet system (GCP KMS)
```

**Why Changed:**  
Production exchanges require robust authentication. Original design lacked user account management entirely. Added enterprise-grade security with TOTP 2FA and wallet authentication for Web3 users.

**Implementation Files:**
- [auth.service.ts](dotmx-backend/packages/shared/src/services/auth.service.ts)
- [wallet-auth.service.ts](dotmx-backend/packages/shared/src/services/wallet-auth.service.ts)
- [account-security.service.ts](dotmx-backend/packages/shared/src/services/account-security.service.ts)
- [security.utils.ts](dotmx-backend/packages/shared/src/utils/security.utils.ts)
- [schema.sql](dotmx-backend/packages/shared/src/db/schema.sql)

---

## 4. API Documentation

### Original Design
```
- Code-level comments only
- No formal API specification
- No interactive documentation
```

### Current Implementation
```
✅ OpenAPI 3.1.0 Specification
   - Complete schema definitions
   - Request/response examples
   - Authentication flows
   - Error codes documented

✅ Swagger UI Integration
   - Interactive API explorer at /swagger
   - Try-it-now functionality
   - Auto-generated from code

✅ Comprehensive Guides
   - API.md with usage examples
   - Authentication guide
   - WebSocket documentation
   - Rate limiting documentation
```

**Why Changed:**  
Professional exchanges require comprehensive API documentation. Added OpenAPI/Swagger for developer experience and API discoverability.

**Implementation Files:**
- [openapi.json](dotmx-backend/docs/openapi.json)
- [API.md](dotmx-backend/docs/API.md)
- [routes/index.ts](dotmx-backend/packages/api/src/routes/index.ts) (with @elysiajs/swagger)

---

## 5. Database Architecture

### Original Design
```sql
Tables:
  - orders
  - trades
  - users (basic)
  - balances
```

### Current Implementation
```sql
Core Trading:
  ✅ orders, trades, balances
  ✅ positions (perpetual futures)
  ✅ funding_payments
  ✅ liquidation_events
  ✅ insurance_fund
  ✅ insurance_fund_transactions

Fee Management:
  ✅ perpetual_fee_config
  ✅ perpetual_fee_tiers (10 tiers)
  ✅ user_perpetual_fee_status
  ✅ funding_rate_history

Authentication:
  ✅ users (comprehensive)
  ✅ wallet_links
  ✅ sessions
  ✅ api_keys
  ✅ email_verification_tokens
  ✅ password_reset_tokens
  ✅ wallet_auth_challenges
  ✅ auth_audit_logs

Security:
  ✅ user_2fa
  ✅ backup_codes
  ✅ login_attempts
  ✅ trusted_devices
  ✅ ip_access_control
  ✅ account_lockouts
  ✅ security_activity_logs
  ✅ password_history
  ✅ user_security_settings
  ✅ security_alerts

Loyalty:
  ✅ loyalty_tiers
  ✅ user_loyalty_status
  ✅ loyalty_points_transactions
```

**Why Changed:**  
Original design underestimated database complexity. Production exchanges require extensive data tracking for compliance, security, and user management.

---

## 6. Technology Stack

### Original Design
| Component | Original | Current | Change Reason |
|-----------|----------|---------|---------------|
| **API Framework** | ElysiaJS | ElysiaJS ✅ | No change |
| **Language** | TypeScript | TypeScript ✅ | No change |
| **Matching Engine** | Rust | Rust ✅ | No change |
| **Database** | PostgreSQL | PostgreSQL ✅ | No change |
| **Message Bus** | NATS | NATS ✅ | No change |
| **API Gateway** | Kong | Kong ✅ | No change |
| **2FA Library** | None | **otpauth** ✅ | Added for TOTP |
| **Signature Verification** | None | **viem** ✅ | Added for EVM wallets |
| **API Docs** | None | **@elysiajs/swagger** ✅ | Added for OpenAPI |
| **ZK Proofs** | Planned | **Deferred** ⚠️ | Not production critical |

---

## 7. Matching Engine

### Original Design
```rust
Features:
  - Price-time priority
  - In-memory orderbook
  - Event sourcing
  - Basic risk checks
```

### Current Implementation
```rust
✅ All Original Features +
  - Self-trade prevention (4 modes)
  - Time-in-force: GTC, IOC, FOK, Post-Only
  - Market orders
  - Stop orders (planned)
  - Fast-path risk checks (<1μs)
  - Comprehensive risk checks:
    * Order size limits
    * Notional value caps
    * Price deviation bands
    * Position limits
    * Rate limiting
  - Sharding by symbol
  - Graceful shutdown
  - Prometheus metrics
  - 450+ tests (95% coverage)
```

**Implementation Files:**
- [dotmx-core](dotmx-backend/rust-engine/crates/dotmx-core/)
- [dotmx-risk](dotmx-backend/rust-engine/crates/dotmx-risk/)
- [dotmx-engine](dotmx-backend/rust-engine/crates/dotmx-engine/)
- [Tests](dotmx-backend/rust-engine/crates/dotmx-engine/tests/)

---

## 8. Features Deferred

These features were in the original plan but deferred to post-launch:

### ZK Batch Verification
**Original:** ZK proofs for trade verification and privacy  
**Status:** Deferred  
**Reason:** Not required for MVP; adds complexity without immediate user benefit

### Mobile App
**Original:** Native mobile applications  
**Status:** Deferred  
**Reason:** Web-first approach; mobile can come post-launch

### Cross-Chain Bridges
**Original:** Native bridge integrations  
**Status:** Deferred  
**Reason:** Use third-party bridges initially (Wormhole, LayerZero)

### Governance Token
**Original:** DAO governance with voting  
**Status:** Deferred  
**Reason:** DMX token exists for fee discounts; governance post-launch

---

## 9. Features Added (Not in Original Design)

### Perpetual Futures
- **Funding Rate Mechanism**: 8-hour intervals with tanh smoothing
- **Progressive Liquidation**: 25% partial before full liquidation
- **Insurance Fund**: Per-symbol tracking with socialized loss prevention
- **Cross/Isolated Margin**: User choice for risk management

### Advanced Fee System
- **Maker Rebates**: -0.005% to -0.025% (paying makers)
- **10 VIP Tiers**: Competitive with Binance/Bybit
- **DMX Discount**: 25% off taker fees
- **Dynamic Funding Fees**: Market-driven rates

### TOTP 2FA
- **Google Authenticator**: Standard TOTP implementation using otpauth
- **Backup Codes**: Secure recovery mechanism
- **Enforcement Options**: Required for login/withdrawal/trading

### EVM Wallet Authentication
- **Signature Verification**: Using viem for EVM chains
- **Challenge-Response**: Secure nonce-based authentication
- **Multi-Wallet**: Link multiple wallets to one account

### OpenAPI Documentation
- **Swagger UI**: Interactive API explorer
- **OpenAPI 3.1.0**: Industry-standard specification
- **Auto-Generated**: From Elysia route definitions

---

## 10. Architecture Diagrams

### Original Design
```
┌────────┐     ┌─────────┐     ┌─────────┐
│ Client │────▶│   API   │────▶│ Engine  │
└────────┘     └─────────┘     └─────────┘
                                     │
                                     ▼
                              ┌─────────┐
                              │ Ledger  │
                              └─────────┘
```

### Current Implementation
```
┌──────────────┐
│   Clients    │
│ (Web/Mobile) │
└──────┬───────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│            Kong API Gateway                   │
│  - Rate Limiting                              │
│  - Authentication                             │
│  - Load Balancing                             │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│         ElysiaJS API Services                 │
│  - REST API (OpenAPI/Swagger)                │
│  - WebSocket (Market Data)                   │
│  - Authentication (JWT/Wallet)               │
│  - Fee Calculation                            │
└──────┬───────────────────────────────────────┘
       │
       ▼
┌──────────────────────────────────────────────┐
│           NATS JetStream                      │
│  - Command/Event Bus                          │
│  - Persistence                                │
│  - Replay Capability                          │
└──────┬───────────────────────────────────────┘
       │
       ├─────────────┬─────────────┬────────────┐
       ▼             ▼             ▼            ▼
  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌──────┐
  │ Engine  │  │ Engine  │  │ Engine  │  │ ... │
  │ BTC-USD │  │ ETH-USD │  │ SOL-USD │  │     │
  └─────────┘  └─────────┘  └─────────┘  └──────┘
       │             │             │            │
       └─────────────┴─────────────┴────────────┘
                     │
                     ▼
              ┌─────────────┐
              │ PostgreSQL  │
              │  - Users    │
              │  - Orders   │
              │  - Trades   │
              │  - Positions│
              │  - Fees     │
              └─────────────┘
```

---

## 11. Testing & Quality

### Original Design
```
- Unit tests for core logic
- Integration tests planned
```

### Current Implementation
```
✅ Comprehensive Test Suite:

Rust Engine:
  - 450+ tests
  - 95% code coverage
  - Unit + integration tests
  - Benchmark suite
  
TypeScript Services:
  - 49 fee calculation tests (all passing)
  - 30+ auth tests
  - 25+ security tests
  - Database integration tests
  
Performance:
  - <1μs matching latency
  - 1M+ orders/second
  - Sub-millisecond API response
```

---

## 12. Deployment Model

### Original Design
```
- Single region
- Monolithic deployment
- Manual scaling
```

### Current Implementation
```
✅ Production-Ready Deployment:

Infrastructure:
  - Docker containers
  - Kubernetes orchestration
  - Multi-region capable
  - Auto-scaling

Sharding:
  - Per-symbol sharding
  - Horizontal scaling
  - Load balancing via Kong

Monitoring:
  - Prometheus metrics
  - Grafana dashboards
  - Distributed tracing
  - Error tracking
```

---

## 13. Security Enhancements

### Added Beyond Original Design

1. **Rate Limiting**
   - Per-user limits
   - Per-IP limits
   - Endpoint-specific limits

2. **Audit Logging**
   - All auth events
   - Security events
   - Admin actions
   - Compliance-ready

3. **Session Management**
   - JWT refresh tokens
   - Device fingerprinting
   - Remote session revocation

4. **IP Controls**
   - Whitelist/blacklist
   - Geographic restrictions
   - VPN detection

5. **Account Protection**
   - Brute-force protection
   - Account lockout
   - Suspicious activity alerts
   - Withdrawal whitelist

---

## 14. API Endpoints Evolution

### Original Design
```
5-10 basic endpoints:
  - Place order
  - Cancel order
  - Get orderbook
  - Get trades
```

### Current Implementation
```
50+ endpoints organized by domain:

Authentication (12):
  - Register, Login, Logout
  - Password reset
  - Wallet auth
  - 2FA management
  - API keys

Trading (15):
  - Place/Cancel/Modify orders
  - Get orders (open/closed)
  - Get trades
  - Get positions
  - Close position

Market Data (8):
  - Orderbook
  - Recent trades
  - Ticker
  - Klines/OHLCV
  - 24h stats

Account (10):
  - Profile
  - Balances
  - Fee tier status
  - Transaction history
  - Security settings

Admin (5):
  - User management
  - System health
  - Metrics
```

**See:** [openapi.json](dotmx-backend/docs/openapi.json)

---

## 15. Summary: Major Additions

| Feature | Status | Complexity | Business Value |
|---------|--------|------------|----------------|
| Perpetual Futures | ✅ Complete | High | Critical |
| 10-Tier VIP Fees | ✅ Complete | Medium | High |
| Maker Rebates | ✅ Complete | Medium | High |
| TOTP 2FA | ✅ Complete | Medium | Critical |
| Wallet Auth (EVM) | ✅ Complete | High | High |
| OpenAPI/Swagger | ✅ Complete | Low | Medium |
| Insurance Fund | ✅ Complete | Medium | Critical |
| Funding Mechanism | ✅ Complete | High | Critical |
| Liquidation Engine | ✅ Complete | High | Critical |
| Account Security | ✅ Complete | High | Critical |

---

## 16. What Stayed the Same

✅ **Core matching engine design** (price-time priority, Rust)  
✅ **ElysiaJS for API layer**  
✅ **PostgreSQL for persistence**  
✅ **NATS for messaging**  
✅ **Event sourcing architecture**  
✅ **Sharding strategy**  
✅ **Kong as API gateway**  

---

## 17. Lessons Learned

### Scope Expansion
**Original:** Minimal viable exchange  
**Reality:** Production exchanges need comprehensive features

**Takeaway:** Don't underestimate authentication, security, and compliance requirements.

### Fee Competitiveness
**Original:** Simple fee structure  
**Reality:** Must match Binance/Bybit to compete

**Takeaway:** Fee structure is a key competitive differentiator.

### Documentation Importance
**Original:** Code is the documentation  
**Reality:** APIs need formal documentation

**Takeaway:** OpenAPI/Swagger is table stakes for developer experience.

---

## 18. Future Roadmap (Not Yet Implemented)

### Planned for 2026
- [ ] Options trading
- [ ] Spot margin trading
- [ ] Lending/borrowing
- [ ] Copy trading
- [ ] Social trading features
- [ ] Mobile apps (iOS/Android)
- [ ] Advanced charting tools
- [ ] Trading bots marketplace

### Under Consideration
- [ ] ZK rollup integration
- [ ] Cross-chain derivatives
- [ ] Prediction markets
- [ ] NFT perpetuals
- [ ] Decentralized governance

---

## 19. Migration Notes

### For Original Design Reviewers

If you're reviewing the original design docs (00-10), be aware:

1. **Perpetual futures** are now the primary product (not an addon)
2. **Fee tiers** use 10-tier Binance model (not simple maker/taker)
3. **Authentication** is fully implemented (was not in original scope)
4. **Database schema** has 35+ tables (original had 5-10)
5. **API surface** is 10x larger than originally planned

### For New Contributors

Read these docs in order:
1. This file (DESIGN_CHANGES.md) ← You are here
2. [00_OVERVIEW.md](00_OVERVIEW.md) - Updated architecture
3. [PERPETUAL_FEES.md](PERPETUAL_FEES.md) - Fee system
4. [AUTHENTICATION.md](AUTHENTICATION.md) - Auth system
5. [API.md](API.md) - API reference
6. Module docs (01-10) - Technical deep dives

---

## 20. Questions & Contact

**Why so many changes?**  
Original design was pre-market research. Implementation incorporated competitive analysis and user requirements discovered during development.

**Is the original design obsolete?**  
No. Core architecture (matching engine, sharding, event sourcing) remains unchanged. Features were added, not replaced.

**Can I see the original design?**  
Yes. See Git history or docs dated before November 2025.

---

**Document Version:** 1.0  
**Last Updated:** January 20, 2026  
**Next Review:** After Q1 2026 launch
