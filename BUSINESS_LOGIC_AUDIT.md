# DotMX v3 — Business Logic Audit #2 (Post-Fix Analysis)

**Audit Date:** June 2026 (2nd pass)
**Scope:** Complete order-to-settlement flow, fees, liquidation, funding, deposits, withdrawals, auth, KYC
**Status:** 57 unfixed bugs identified across all modules

---

## Executive Summary

The first security audit fixed 44 vulnerabilities. The first business logic audit identified 80 bugs. Since then, a new **TradeSettlementService** was implemented, but it introduced new issues while leaving most original business logic bugs untouched.

**57 bugs remain unfixed** across three categories:

| Category | Count | Severity |
|---|---|---|
| New settlement service bugs | 9 | 2 Critical, 5 High, 2 Medium |
| Original engine/fee/liquidation/funding bugs | 18 | 4 Critical, 7 High, 7 Medium |
| Deposits/withdrawals/auth/KYC bugs | 24 | 4 Critical, 12 High, 8 Medium |
| Previously fixed (confirmed) | 6 | — |

---

## Part 1: New TradeSettlementService Issues (9 bugs)

### BL1-NEW — 🔴 CRITICAL: Maker + Taker Fee Rates Both 0.1% (Wrong)

**File:** `packages/shared/src/services/trade-settlement.service.ts:56-57`

```typescript
const makerFeeRate = 0.001;  // 0.1%
const takerFeeRate = 0.001;  // 0.1%
```

The TypeScript engine uses 0.2% taker. The perpetual fee config uses 0.035% taker / -0.005% maker rebate. The settlement service ignores both and charges 0.1%/0.1%. Every trade settles at wrong rates.

**Fix:** Wire `FeeCalculationService` and `PerpetualFeeService` into the settlement service. Look up per-user VIP tier rates.

---

### BL2-NEW — 🔴 CRITICAL: Settlement Is Fire-and-Forget

**File:** `packages/gateway/src/adapter/index.ts:127-145`

```typescript
settlementService.settleTrade({...})
  .then(result => { if (!result.settled) console.error(...); })
  .catch(err => { console.error(...); });
// CONTINUES IMMEDIATELY — subscribers notified without waiting
```

Trade events are dispatched to subscribers BEFORE settlement completes or even if it fails. Users see fills without fees applied.

**Fix:** `await` the settlement call before building the FillEvent and notifying subscribers.

---

### BL3-NEW — 🟠 HIGH: Duplicate Fee Logic (Engine + Settlement)

**File:** `packages/engine/src/matching/index.ts:208-229` (engine fees) + `trade-settlement.service.ts:56-57` (settlement fees)

The engine calculates fees at 0.1%/0.2%, embeds them in Trade events, but the settlement service discards engine fees and recalculates at 0.1%/0.1%. Two different fee numbers exist for the same trade.

**Fix:** Remove fee calculation from the engine. Engine outputs pure trade facts. Settlement is the single source of truth.

---

### BL4-NEW — 🟠 HIGH: Engine Events Never Reach Gateway in Production

**File:** `apps/api-server-with-auth.ts:180-183` + `apps/engine-server.ts:86-113`

Both use `createMemoryCommandBus()` — separate in-memory instances in separate processes. Engine events are published to engine's command bus; gateway subscribes to its own command bus. Events never flow between them. The entire settlement pipeline is dead code in multi-process deployment.

**Fix:** Connect both to the same NATS JetStream command bus in production, or run them in the same process.

---

### BL5-NEW — 🟠 HIGH: Margin Locked AFTER Gateway Returns (Race)

**File:** `packages/api/src/routes/trading-advanced.routes.ts:109-132`

```typescript
const result = await gateway.placeOrder({...});  // engine matches → settlement fires
// ...
await db.query(`UPDATE user_balances SET available = available - $1, locked = locked + $1 ...`);
```

The engine can produce trades and settlement can deduct fees from `locked` BEFORE the margin lock query runs. Fee deduction hits `GREATEST(locked - $1, 0)` = 0, silently failing.

**Fix:** Move margin lock before `gateway.placeOrder()`, or have settlement deduct from a dedicated fee balance.

---

### BL6-NEW — 🟠 HIGH: Market Orders Bypass Margin Check

**File:** `packages/api/src/routes/trading-advanced.routes.ts:86-87`

```typescript
const notional = body.quantity * (body.price ?? 0);  // 0 for MARKET orders
const requiredMargin = notional / body.leverage;       // 0
```

Market orders always pass with `requiredMargin = 0`.

**Fix:** For MARKET orders, use the best bid/ask from the orderbook or last traded price as the estimated price for margin calculation.

---

### BL7-NEW — 🟠 HIGH: No VIP Tier or DMX Discount Integration

**File:** `packages/shared/src/services/trade-settlement.service.ts:56`

The `FeeCalculationService` (715 lines, fully implemented with VIP tiers + DMX discounts) and `VIPTierService` (554 lines) exist but are never called. Every trade settles at flat 0.1% regardless of user tier.

---

### BL8-NEW — 🟡 MEDIUM: Quote Asset Hardcoded to 'USDT'

**File:** `packages/shared/src/services/trade-settlement.service.ts:139,174,199,209`

All fee deductions use hardcoded `'USDT'` as the asset. Trades on `ETH-BTC` or `SOL-USDC` pairs would deduct fees from the wrong asset.

---

### BL9-NEW — 🟡 MEDIUM: Maker Rebates Impossible (No Credit Path)

**File:** `packages/shared/src/services/trade-settlement.service.ts:193-213`

`updateBalancesForFees()` only does `locked = GREATEST(locked - x, 0)` — it can deduct but never credit. High-tier makers with negative fee rates (rebates) never receive their rebates.

---

## Part 2: Engine, Fees, Liquidation & Funding (18 unfixed)

### BL12 — 🔴 CRITICAL: Liquidation Margin Multiplied by Leverage

**File:** `packages/shared/src/services/perpetual-fee.service.ts:659`

```typescript
const maintenanceMargin = positionNotional * 0.005 * leverage;  // WRONG
```

At 100x leverage: `notional * 0.5` — needs 50% margin. Liquidation triggers at 0.5% loss instead of 50%. Positions liquidated 100x too early at high leverage.

**Fix:** Remove `* leverage` — it's `positionNotional * maintenance_margin_ratio` only.

---

### BL16 — 🔴 CRITICAL: `position.increase()` Replaces Entire Margin

**File:** `rust-engine/crates/dotmx-core/src/perpetual.rs:264`

```rust
self.margin = calculate_margin(self.entry_price, self.size, leverage);
```

Replaces the entire margin with a new calculation, losing the additional margin the user deposited. Margin tracking diverges from account balances.

---

### BL17 — 🔴 CRITICAL: `position.decrease()` Margin Never Returned

**File:** `rust-engine/crates/dotmx-core/src/perpetual.rs:275-298`

```rust
pub fn decrease(...) -> Decimal {
    self.margin = calculate_margin(self.entry_price, self.size, self.leverage);
    pnl  // only returns PnL, not freed margin
}
```

When closing part of a position, the released margin simply disappears. Users lose funds.

---

### BL14 — 🔴 CRITICAL: Funding Payment Uses Entry Price

**File:** `packages/ledger/src/services/index.ts:20`

```typescript
const notional = Math.abs(position.size) * position.entryPrice;  // WRONG
```

Funding should use current mark price. Entry price is fixed at open time. A BTC position entered at $50K with mark at $55K should pay funding on $55K, not $50K.

**Fix:** Use `markPrice` parameter (already passed to `applyFunding()` at line 97 but ignored in payment calculation).

---

### Other unfixed (14 more):

- **BL13** 🟠: `marginRatio` uses original collateral, not effective (misleading health indicator)
- **BL15** 🟠: Liquidation penalty model differs between ledger + PerpetualFeeService
- **BL18** 🟠: Negative `freeMargin` clamped to 0, hiding deficits
- **BL19** 🟠: `getNextFundingTimestamp` skips boundary by 8 hours when called at settlement time
- **BL20** 🟠: Two funding rate models coexist (tanh-skew vs premium/dampening)
- **BL21** 🟡: Three different liquidation price formulas produce different results
- **BL23** 🟠: Short margin-call price formula incorrect
- **BL24** 🟡: Insurance fund stored as fake position — could be swept by funding
- **BL25** 🟡: Funding scheduler drifts via setTimeout
- **BL26** 🟡: VIP discount semantics ambiguous (rate subtraction vs percentage)
- **BL27** 🟡: DMX discount order inconsistent (VIP-first in spot, tier-adjusted in perps)
- **BL28** 🔴: `max_discount_per_day_usd` defined but never enforced
- **BL29** 🟡: Negative fee silently clamped — hides misconfigured tiers
- **BL30** 🟠: Tier lock allows chain-upgrade exploitation during volume accumulation
- **BL31** 🟡: Clock skew between JS Date and DB CURRENT_TIMESTAMP in tier updates
- **BL32** 🟡: Three parallel tier systems all numbered 0-9 with overlapping names

---

## Part 3: Deposits, Withdrawals, Auth & KYC (24 unfixed)

### BL20 — 🔴 CRITICAL: Withdrawal Fee Never Locked

**File:** `packages/shared/src/services/withdrawal.service.ts:192,532`

`lockBalance(amount)` locks only the principal. `completeWithdrawal` deducts `amount + fee` from locked. Locked balance goes negative or SQL fails.

---

### BL22 — 🔴 CRITICAL: `completeBatch` Not Atomic

**File:** `packages/shared/src/services/withdrawal.service.ts:499-526`

No transaction wrapping the loop. Crash mid-batch leaves some withdrawals completed, others stuck.

---

### BL23 — 🔴 CRITICAL: TOCTOU Race in `lockBalance`

**File:** `packages/shared/src/services/withdrawal.service.ts:604-639`

SELECT then UPDATE without row locking or `WHERE available >= amount`. Concurrent withdrawals double-spend.

---

### BL27 — 🔴 CRITICAL: Logout Has No Session Ownership Check

**File:** `packages/api/src/routes/auth.routes.ts:251-268`

`/logout` accepts any refresh token with no authentication. Any user can log out any other user.

---

### Other unfixed (20 more):

- **BL21** 🟠: Sweeper double-credit risk — confirmation checker guarded, sweeper not
- **BL25** 🟠: 2FA brute-force protection missing — unlimited TOTP attempts
- **BL26** 🟠: Refresh token rotation race condition — concurrent refresh both pass
- **BL28** 🟠: `Math.random()` for API key generation (predictable)
- **BL29** 🟠: Wallet login bypasses account lockout
- **BL30** 🟠: Status change to suspended/banned doesn't revoke sessions
- **BL31** 🟠: Admin password change doesn't revoke sessions
- **BL5** 🔴: KYC approval ignores `kyc_status` and `kyc_level` columns
- **BL33** 🟠: `under_review` vs `in_review` — DB constraint mismatch
- **BL55** 🟡: `verifyToken` masks all errors as "Invalid or expired token"
- **BL57** 🟡: `deleted_at` check missing in `changePassword` and 2FA disable
- **BL64** 🟡: 2FA backup codes generated but never usable (no redemption route)
- **BL58** 🟡: No post-KYC limit changes
- **BL59** 🟡: `approved_at`/`rejected_at` never populated
- **BL32** 🟠: `inactive`/`pending` statuses not in DB constraint

---

## Previously Fixed & Verified (6 bugs)

| Bug | Status |
|---|---|
| Withdrawal cooldown (D8) | ✅ FIXED — 60s default, enforced |
| Private key memory wipe (D3) | ✅ FIXED — `replace(/./g, '\0')` in finally |
| Synthetic tx_hash (D2) | ✅ PARTIAL — warns, uses real when available |
| 2FA enforced on login (A4) | ✅ FIXED — temp_token + verifyLogin2FA |
| Refresh token invalidation (A5) | ✅ FIXED — session revoked on rotation |
| Rate limiting on auth (E2) | ✅ FIXED — in-memory limiter |

---

## Fix Priority

### Immediate (Financial Loss)
1. **BL17**: Position decrease margin never returned to user
2. **BL16**: Position increase overwrites all margin
3. **BL12**: Liquidation 100x too early at high leverage
4. **BL14**: Funding calculated on wrong price
5. **BL20**: Withdrawal fee never locked
6. **BL22**: Batch completion not atomic
7. **BL23**: Balance lock race condition
8. **BL2-NEW**: Settlement fire-and-forget

### High (Week 1)
9. **BL3-NEW**: Remove duplicate fee logic from engine
10. **BL6-NEW**: Market order margin bypass
11. **BL5-NEW**: Margin lock after settlement race
12. **BL4-NEW**: Engine events never reach gateway
13. **BL27**: Logout session ownership
14. **BL5**: KYC approval ignores kyc_status column
15. **BL30**: Suspend doesn't revoke sessions
16. **BL28**: Math.random() API keys
17. **BL29**: Wallet login bypasses lockout

### Medium (Week 2+)
All remaining Tier 2/3 bugs from fee calculation, VIP tier, funding models, and auth hardening.
