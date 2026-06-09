# DotMX: Institutional-Grade Perpetual Futures Exchange

## Product Overview

**DotMX** is a next-generation perpetual futures and spot trading platform engineered for speed, security, and scale. Built with a hybrid Rust-TypeScript architecture, DotMX delivers institutional-grade performance with the flexibility modern traders demand.

---

## 🎯 What Makes DotMX Different

### Lightning-Fast Performance
- **Sub-microsecond latency** matching engine written in Rust
- **1M+ orders per second** throughput capacity
- Real-time market data streaming via WebSocket
- Zero-downtime deployment with hot-swappable components

### Enterprise-Ready Security
- Multi-factor authentication (JWT, TOTP 2FA, EVM wallet signatures)
- Device tracking and IP-based access controls
- Comprehensive audit logging for regulatory compliance
- Battle-tested cryptographic signing for sensitive operations

### Flexible Fee Structure
- **10-tier VIP program** with volume-based pricing
- **Maker rebates** from -0.025% to -0.005% for liquidity providers
- Competitive taker fees optimized for high-frequency trading
- Transparent fee calculation with no hidden charges

### Professional-Grade Features
- **Advanced order types**: Limit, Market, Stop, IOC (Immediate-or-Cancel), FOK (Fill-or-Kill), Post-Only
- **Perpetual futures** with automatic funding rate settlements
- **Spot trading** with instant execution
- **Risk management** with pre-trade checks and position limits
- **Insurance fund** for liquidation backstop

---

## 💼 Built for Professional Traders

### Algorithmic Trading Ready
- RESTful API with OpenAPI 3.1.0 specification
- Interactive Swagger UI for rapid integration testing
- WebSocket feeds for real-time data synchronization
- Sub-millisecond order placement and cancellation

### Institutional Infrastructure
- **Kong API Gateway** with per-user, per-IP, per-endpoint rate limiting
- **PostgreSQL** persistence layer with 35+ optimized tables
- **NATS JetStream** message bus for 1M+ messages/second
- **Prometheus** metrics and distributed tracing for observability

### High Availability Architecture
- Horizontal scaling for all service components
- Per-symbol engine isolation (BTC-USD, ETH-USD, SOL-USD, etc.)
- Event sourcing with full replay capability
- Automated failover and recovery mechanisms

---

## 🏗️ Technical Architecture

### Hybrid Performance Engine
DotMX combines the raw speed of Rust with the developer productivity of TypeScript:

- **Rust Matching Engine**: Core order matching, risk checks, and liquidation logic
- **TypeScript Services**: API layer, authentication, fee calculation, and market data
- **NATS JetStream**: High-performance message bus connecting all components
- **PostgreSQL**: Reliable persistence for users, orders, trades, and positions

### Scalable Service Architecture
```
Clients → Kong Gateway → TypeScript API → NATS → Rust Engines (per symbol)
                                              ↓
                                         PostgreSQL
```

Each trading pair runs in its own isolated engine instance, enabling:
- Independent scaling based on trading volume
- Zero cross-symbol interference
- Simplified debugging and monitoring
- Unlimited symbol addition without system redesign

---

## 📊 Product Capabilities

### Trading Features
- ✅ **Spot Markets**: Traditional buy/sell with instant settlement
- ✅ **Perpetual Futures**: Leverage up to 100x with funding rates
- ✅ **Order Types**: Market, Limit, Stop-Loss, Stop-Limit, IOC, FOK, Post-Only
- ✅ **Position Management**: Real-time P&L, margin calculations, liquidation prices
- ✅ **Risk Controls**: Position limits, max order size, rate limiting

### Market Data
- ✅ **Real-Time Order Book**: Level 2 depth with full transparency
- ✅ **Trade History**: Complete tick-by-tick execution data
- ✅ **Funding Rates**: 8-hour funding rate settlements for perpetuals
- ✅ **24h Statistics**: Volume, high, low, change percentage
- ✅ **WebSocket Streams**: Order book snapshots and delta updates

### Account Features
- ✅ **Multi-Asset Wallets**: Separate spot and margin balances
- ✅ **Deposit/Withdrawal**: Automated processing with confirmations
- ✅ **Security Controls**: 2FA, device management, session tracking
- ✅ **API Key Management**: Create, rotate, and revoke trading keys
- ✅ **Audit Logs**: Complete activity history for compliance

---

## 🎁 Key Benefits

### For Retail Traders
- **User-friendly API** with comprehensive documentation
- **Competitive fees** with transparent pricing
- **Fast execution** with minimal slippage
- **Secure accounts** with industry-standard protection

### For Market Makers
- **Maker rebates** to incentivize liquidity provision
- **High throughput** for quote management
- **Predictable latency** for tight spread strategies
- **Priority execution** for Post-Only orders

### For Institutions
- **White-label ready** architecture for rapid deployment
- **Regulatory compliance** features built-in
- **Audit trails** for all trading activity
- **Dedicated support** for integration and operations

### For Developers
- **Open API** with OpenAPI 3.1.0 standard
- **WebSocket SDK** for real-time data
- **Sandbox environment** for testing
- **Complete documentation** with code examples

---

## 🚀 Production Ready

DotMX is **production-ready** and includes:

- ✅ **Docker Compose** deployment configurations
- ✅ **GitHub Actions** CI/CD pipelines
- ✅ **Database migration** scripts
- ✅ **Health check** endpoints for monitoring
- ✅ **Rate limiting** with Kong Gateway
- ✅ **TLS/SSL** support
- ✅ **Comprehensive test suite** (unit, integration, e2e, performance)

---

## 📈 Performance Metrics

| Metric | Specification |
|--------|--------------|
| **Order Latency** | < 1 microsecond (median) |
| **Throughput** | 1M+ orders/second |
| **WebSocket Updates** | < 10ms (95th percentile) |
| **API Response Time** | < 50ms (99th percentile) |
| **Uptime Target** | 99.99% |
| **Data Persistence** | Real-time with PostgreSQL |

---

## 🛡️ Security Features

- **JWT Authentication** with short-lived access tokens
- **TOTP 2FA** for account protection
- **EVM Wallet Signatures** for blockchain identity
- **API Key Management** with granular permissions
- **IP Whitelisting** for enhanced security
- **Device Fingerprinting** for fraud detection
- **Rate Limiting** per user, IP, and endpoint
- **Audit Logging** for all sensitive operations

---

## 🌐 Market Coverage

DotMX supports multiple trading pairs across:
- **Cryptocurrencies**: BTC, ETH, SOL, ARB, and more
- **Perpetual Futures**: BTC-USD, ETH-USD, SOL-USD, etc.
- **Spot Markets**: Direct crypto-to-crypto and crypto-to-USD pairs

---

## 📦 Deployment Options

### Self-Hosted
Deploy DotMX on your own infrastructure with full control:
- Docker Compose for development and small-scale production
- Kubernetes manifests for enterprise deployments
- Cloud-agnostic architecture (AWS, GCP, Azure compatible)

### Managed Service
White-label deployment options available:
- Fully managed infrastructure
- Custom branding and domain
- Dedicated support team
- SLA guarantees

---

## 🎓 Getting Started

### For Developers
1. **Quick Start**: Follow [QUICKSTART.md](./QUICKSTART.md) to run locally in 15 minutes
2. **API Reference**: Explore endpoints at `/swagger` when running
3. **Integration Guide**: Check [docs/api/API.md](./docs/api/API.md)

### For Business
1. **Architecture Review**: Read [System-Overview.md](./docs/architecture/System-Overview.md)
2. **Security Assessment**: Review [AUTHENTICATION.md](./docs/security/AUTHENTICATION.md)
3. **Deployment Planning**: See [DEPLOYMENT_CHECKLIST.md](./docs/operations/DEPLOYMENT_CHECKLIST.md)

---

## 📞 Support & Resources

- **Documentation**: Comprehensive guides in `/docs`
- **API Reference**: Interactive Swagger UI at `/swagger`
- **OpenAPI Spec**: Machine-readable spec at `/docs/reference/openapi.json`
- **Issue Tracking**: GitHub Issues for bug reports and feature requests

---

## 🏆 Why Choose DotMX

| Traditional Exchanges | DotMX |
|----------------------|-------|
| Closed-source black boxes | Transparent architecture |
| Unknown latency | Sub-microsecond guarantees |
| Limited customization | Full white-label capability |
| Vendor lock-in | Self-hosted options |
| Opaque fee structures | Clear, competitive pricing |
| Basic API | Professional-grade tooling |

---

## 🔮 Roadmap Highlights

- **Layer 2 Scaling**: Ethereum L2 integration for gas-free deposits
- **Cross-Margining**: Portfolio margining across all positions
- **Options Trading**: European and American style options
- **Mobile SDK**: Native iOS and Android libraries
- **Advanced Analytics**: Portfolio tracking and performance metrics

---

**DotMX** — Where institutional-grade performance meets modern flexibility.

*Trade faster. Trade smarter. Trade with confidence.*
