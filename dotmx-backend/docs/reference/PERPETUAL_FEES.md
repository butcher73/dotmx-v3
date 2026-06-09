# Perpetual Futures Fee System

## Overview

DotMX implements a **Binance Futures-style fee structure** for perpetual contracts with:
- **Maker rebates** (negative fees - makers get paid)
- **Taker fees** (positive fees)
- **Funding fees** (8-hour peer-to-peer transfers)
- **Liquidation penalties** (0.4% of notional)
- **DMX token discounts** (25% off taker fees)

---

## 1. Transaction Fees

### Fee Structure

| Tier | Name | Maker Fee | Taker Fee | Volume (30d) | DMX Holding |
|------|------|-----------|-----------|--------------|-------------|
| 0 | Regular | **-0.005%** (rebate) | 0.035% | $0 | 0 |
| 1 | Bronze | **-0.006%** (rebate) | 0.034% | $50K | 500 |
| 2 | Silver | **-0.008%** (rebate) | 0.032% | $250K | 2.5K |
| 3 | Gold | **-0.010%** (rebate) | 0.030% | $1M | 10K |
| 4 | Platinum | **-0.012%** (rebate) | 0.028% | $5M | 50K |
| 5 | Diamond | **-0.015%** (rebate) | 0.025% | $15M | 150K |
| 6 | Crown | **-0.018%** (rebate) | 0.022% | $50M | 500K |
| 7 | Emperor | **-0.020%** (rebate) | 0.020% | $150M | 1.5M |
| 8 | Titan | **-0.022%** (rebate) | 0.018% | $500M | 5M |
| 9 | Legendary | **-0.025%** (rebate) | 0.015% | $1.5B | 15M |

### How Maker Rebates Work

When you provide liquidity (maker order), you **receive** a rebate:

```
Rebate = Notional × |Maker Fee Rate|

Example (Tier 0):
- Trade: Long 1 BTC at $50,000
- Notional: $50,000
- Rebate: $50,000 × 0.00005 = $2.50 received
```

### DMX Token Discount

Pay fees with DMX for **25% discount** on taker fees:

```
Without DMX: $50,000 × 0.035% = $17.50
With DMX:    $50,000 × 0.035% × 0.75 = $13.13

Savings: $4.38 (25%)
```

> **Note:** DMX discount only applies to taker fees, not maker rebates.

---

## 2. Funding Fees

### Mechanism

Funding fees are **peer-to-peer transfers** between longs and shorts to anchor perpetual prices to spot.

- **Interval:** Every 8 hours (00:00, 08:00, 16:00 UTC)
- **Direction:** Side with more open interest pays the other side

### Funding Rate Calculation

Uses a smoothed **tanh model**:

```
rate = k × tanh(skew)

where:
  k = 0.00015 (sensitivity constant)
  skew = (Long OI - Short OI) / Total OI
```

### Funding Rate Limits

| Parameter | Value |
|-----------|-------|
| Minimum Rate | -0.015% |
| Maximum Rate | +0.015% |
| Calculation Interval | 8 hours |

### Funding Payment

```
Payment = Position Notional × Funding Rate

If rate > 0: Longs pay shorts
If rate < 0: Shorts pay longs
```

### Tier Discounts on Funding

Higher tiers receive discounts when **paying** funding:

| Tier | Funding Discount |
|------|------------------|
| 0-1 | 0% |
| 2 | 5% |
| 3 | 10% |
| 4 | 15% |
| 5 | 20% |
| 6 | 25% |
| 7 | 30% |
| 8 | 35% |
| 9 | 50% |

---

## 3. Liquidation Fees

### Penalty Structure

| Parameter | Value |
|-----------|-------|
| Base Penalty | **0.4%** of liquidated notional |
| Insurance Fund Contribution | 50% of penalty |
| Liquidator Reward | 50% of penalty |

### Progressive Liquidation

To minimize slippage and protect users:

1. **Partial Liquidation:** 25% of position liquidated first
2. **Full Liquidation:** If margin still insufficient

### Tier Discounts

| Tier | Liquidation Discount |
|------|---------------------|
| 0-1 | 0% |
| 2 | 5% |
| 3 | 10% |
| 4 | 15% |
| 5 | 20% |
| 6 | 25% |
| 7 | 30% |
| 8 | 35% |
| 9 | 50% |

### Example

```
Position: 10 BTC Long at $50,000
Notional: $500,000

Base Penalty: $500,000 × 0.4% = $2,000

Tier 5 (20% discount):
  Discount: $2,000 × 0.20 = $400
  Final Penalty: $1,600
  To Insurance: $800
  To Liquidator: $800
```

---

## 4. Insurance Fund

### Purpose

The insurance fund covers:
- Bankrupt positions (when margin < 0)
- ADL (Auto-Deleveraging) prevention
- Socialized loss mitigation

### Funding Sources

1. **Liquidation penalties** (50% of each liquidation)
2. **Fee contributions** (portion of trading fees)
3. **Manual contributions** (from treasury)

### Payout Rules

- Maximum single payout capped per symbol
- Fund balance monitored for minimum threshold
- Socialized losses only when fund depleted

---

## 5. Fee Priority

Fees are applied in this order:

1. **Transaction Fee** - Applied at trade execution
2. **Funding Fee** - Applied every 8 hours
3. **Liquidation Fee** - Applied if position liquidated

---

## 6. API Reference

### Calculate Transaction Fee

```typescript
import { perpetualFeeService } from '@dotmx/shared';

const result = perpetualFeeService.calculateTransactionFee({
  user_id: 'user123',
  trade_role: 'maker',
  notional_usd: 100000,
  fee_tier_level: 5,
  pay_with_dmx: false,
});

// result.is_rebate = true
// result.rebate_amount_usd = 15 ($100K × 0.015%)
```

### Calculate Funding Payment

```typescript
const funding = perpetualFeeService.calculateFundingPayment({
  user_id: 'user123',
  position_id: 'pos456',
  symbol: 'BTCUSD',
  position_side: 'long',
  position_size: 2,
  mark_price: 50000,
  funding_rate: 0.0001, // 0.01%
  fee_tier_level: 3,
});

// funding.payment_direction = 'paid'
// funding.final_funding_amount = 9 (after 10% discount)
```

### Calculate Liquidation Penalty

```typescript
const penalty = perpetualFeeService.calculateLiquidationPenalty({
  user_id: 'user123',
  position_id: 'pos456',
  symbol: 'BTCUSD',
  liquidated_notional: 500000,
  fee_tier_level: 5,
  liquidation_type: 'full',
});

// penalty.base_penalty_amount = 2000 (0.4%)
// penalty.final_penalty_amount = 1600 (after 20% discount)
// penalty.insurance_fund_amount = 800
// penalty.liquidator_reward = 800
```

---

## 7. Comparison with Binance Futures

| Feature | DotMX | Binance Futures |
|---------|-------|-----------------|
| Maker Fee (Base) | -0.005% | -0.005% |
| Taker Fee (Base) | 0.035% | 0.035% |
| Funding Interval | 8 hours | 8 hours |
| Funding Rate Cap | ±0.015% | ±0.375% |
| Liquidation Penalty | 0.4% | Variable |
| Token Discount | 25% (DMX) | 10% (BNB) |
| Tier Levels | 10 | 9 |

---

## 8. Database Schema

### Tables

- `perpetual_fee_config` - Global fee configuration
- `perpetual_fee_tiers` - 10 VIP tier definitions
- `funding_rate_history` - Historical funding rates
- `funding_payments` - User funding payments
- `liquidation_events` - Liquidation records
- `insurance_fund` - Per-symbol fund balances
- `insurance_fund_transactions` - Fund inflows/outflows
- `user_perpetual_fee_status` - User tier status

### Migration

```bash
# Apply perpetual fee schema
psql -d dotmx -f packages/shared/src/db/perpetual_fee_schema.sql

# Initialize tiers
psql -d dotmx -f packages/shared/src/db/init_perpetual_fees.sql
```

---

## 9. Testing

Run the test suite:

```bash
cd packages/shared
bun test perpetual-fee
```

Test coverage includes:
- ✅ All 10 tier fee calculations
- ✅ Maker rebate calculations (negative fees)
- ✅ Taker fee calculations with DMX discount
- ✅ Funding rate calculation (tanh model)
- ✅ Funding payment with tier discounts
- ✅ Liquidation penalty calculations
- ✅ Insurance fund distribution
- ✅ Edge cases (zero notional, extreme skew)
- ✅ Binance Futures parity validation
