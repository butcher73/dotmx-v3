// ============================================================================
// PERPETUAL FUTURES FEE SERVICE TESTS
// ============================================================================

import { describe, it, expect, beforeEach } from 'bun:test';
import { PerpetualFeeService } from '../src/services/perpetual-fee.service.js';
import { DEFAULT_PERP_FEE_CONFIG } from '../src/types/perpetual-fees.js';

describe('PerpetualFeeService', () => {
  let service: PerpetualFeeService;

  beforeEach(() => {
    service = new PerpetualFeeService();
  });

  // ==========================================================================
  // FEE TIER TESTS
  // ==========================================================================

  describe('Fee Tiers', () => {
    it('should return all 10 fee tiers', () => {
      const tiers = service.getAllTiers();
      expect(tiers).toHaveLength(10);
      expect(tiers[0].tier_level).toBe(0);
      expect(tiers[9].tier_level).toBe(9);
    });

    it('should return correct tier by level', () => {
      const tier = service.getTier(0);
      expect(tier.tier_name).toBe('Regular');
      expect(tier.effective_maker_fee).toBe(-0.00005); // -0.005%
      expect(tier.effective_taker_fee).toBe(0.00035);  // 0.035%
    });

    it('should have negative maker fees (rebates) for all tiers', () => {
      const tiers = service.getAllTiers();
      for (const tier of tiers) {
        expect(tier.effective_maker_fee).toBeLessThan(0);
      }
    });

    it('should have positive taker fees for all tiers', () => {
      const tiers = service.getAllTiers();
      for (const tier of tiers) {
        expect(tier.effective_taker_fee).toBeGreaterThan(0);
      }
    });

    it('should determine tier based on volume and DMX', () => {
      expect(service.determineTier(0, 0)).toBe(0);           // Regular
      expect(service.determineTier(50000, 500)).toBe(1);     // Bronze
      expect(service.determineTier(250000, 2500)).toBe(2);   // Silver
      expect(service.determineTier(1000000, 10000)).toBe(3); // Gold
    });

    it('should require both volume AND DMX for tier upgrade', () => {
      // High volume but no DMX
      expect(service.determineTier(1000000, 0)).toBe(0);
      // Low volume but high DMX
      expect(service.determineTier(0, 10000)).toBe(0);
    });

    it('should return tier summary with formatted values', () => {
      const summary = service.getTierSummary(5);
      expect(summary.tier_name).toBe('Diamond');
      expect(summary.maker_fee).toContain('rebate');
      expect(summary.taker_fee).toContain('%');
    });
  });

  // ==========================================================================
  // TRANSACTION FEE TESTS
  // ==========================================================================

  describe('Transaction Fees', () => {
    describe('Maker Fees (Rebates)', () => {
      it('should calculate negative fee (rebate) for makers', () => {
        const result = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'maker',
          notional_usd: 100000,
          fee_tier_level: 0,
          pay_with_dmx: false,
        });

        expect(result.is_rebate).toBe(true);
        expect(result.fee_amount_usd).toBeLessThan(0);
        expect(result.rebate_amount_usd).toBe(Math.abs(result.fee_amount_usd));
      });

      it('should calculate correct rebate amount for tier 0', () => {
        const result = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'maker',
          notional_usd: 100000,
          fee_tier_level: 0,
          pay_with_dmx: false,
        });

        // -0.005% of 100000 = -5
        expect(result.fee_amount_usd).toBe(-5);
        expect(result.rebate_amount_usd).toBe(5);
      });

      it('should increase rebate for higher tiers', () => {
        const tier0 = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'maker',
          notional_usd: 100000,
          fee_tier_level: 0,
          pay_with_dmx: false,
        });

        const tier5 = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'maker',
          notional_usd: 100000,
          fee_tier_level: 5,
          pay_with_dmx: false,
        });

        expect(tier5.rebate_amount_usd!).toBeGreaterThan(tier0.rebate_amount_usd!);
      });

      it('should cap rebate at max per trade', () => {
        const result = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'maker',
          notional_usd: 1000000000, // 1B
          fee_tier_level: 9,
          pay_with_dmx: false,
        });

        expect(result.rebate_amount_usd).toBeLessThanOrEqual(
          DEFAULT_PERP_FEE_CONFIG.MAX_REBATE_PER_TRADE_USD
        );
      });

      it('should not apply DMX discount to rebates', () => {
        const withDmx = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'maker',
          notional_usd: 100000,
          fee_tier_level: 0,
          pay_with_dmx: true,
        });

        expect(withDmx.dmx_discount_applied).toBe(false);
        expect(withDmx.dmx_discount_amount).toBe(0);
      });
    });

    describe('Taker Fees', () => {
      it('should calculate positive fee for takers', () => {
        const result = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'taker',
          notional_usd: 100000,
          fee_tier_level: 0,
          pay_with_dmx: false,
        });

        expect(result.is_rebate).toBe(false);
        expect(result.fee_amount_usd).toBeGreaterThan(0);
      });

      it('should calculate correct taker fee for tier 0', () => {
        const result = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'taker',
          notional_usd: 100000,
          fee_tier_level: 0,
          pay_with_dmx: false,
        });

        // 0.035% of 100000 = 35
        expect(result.fee_amount_usd).toBe(35);
      });

      it('should reduce taker fee for higher tiers', () => {
        const tier0 = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'taker',
          notional_usd: 100000,
          fee_tier_level: 0,
          pay_with_dmx: false,
        });

        const tier5 = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'taker',
          notional_usd: 100000,
          fee_tier_level: 5,
          pay_with_dmx: false,
        });

        expect(tier5.fee_amount_usd).toBeLessThan(tier0.fee_amount_usd);
      });

      it('should apply DMX discount to taker fees', () => {
        const withoutDmx = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'taker',
          notional_usd: 100000,
          fee_tier_level: 0,
          pay_with_dmx: false,
        });

        const withDmx = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'taker',
          notional_usd: 100000,
          fee_tier_level: 0,
          pay_with_dmx: true,
        });

        expect(withDmx.dmx_discount_applied).toBe(true);
        expect(withDmx.dmx_discount_amount).toBe(withoutDmx.fee_amount_usd * 0.25);
        expect(withDmx.final_fee_usd).toBe(withoutDmx.fee_amount_usd * 0.75);
      });

      it('should apply custom DMX discount percentage', () => {
        const result = service.calculateTransactionFee({
          user_id: 'user1',
          trade_role: 'taker',
          notional_usd: 100000,
          fee_tier_level: 0,
          pay_with_dmx: true,
          dmx_discount_pct: 0.50, // 50%
        });

        expect(result.dmx_discount_amount).toBe(35 * 0.50); // 17.5
        expect(result.final_fee_usd).toBe(35 * 0.50);       // 17.5
      });
    });

    describe('Both Fees', () => {
      it('should calculate both maker and taker fees together', () => {
        const { maker, taker } = service.calculateBothFees(100000, 0, false);

        expect(maker.is_rebate).toBe(true);
        expect(taker.is_rebate).toBe(false);
        expect(maker.fee_amount_usd).toBe(-5);
        expect(taker.fee_amount_usd).toBe(35);
      });
    });
  });

  // ==========================================================================
  // FUNDING RATE TESTS
  // ==========================================================================

  describe('Funding Rate', () => {
    describe('Calculation', () => {
      it('should calculate positive funding rate when longs > shorts', () => {
        const result = service.calculateFundingRate(
          1000000, // long OI
          500000,  // short OI
          'BTCUSD',
          50000,
        );

        expect(result.funding_rate).toBeGreaterThan(0);
        expect(result.direction).toBe('longs_pay');
      });

      it('should calculate negative funding rate when shorts > longs', () => {
        const result = service.calculateFundingRate(
          500000,  // long OI
          1000000, // short OI
          'BTCUSD',
          50000,
        );

        expect(result.funding_rate).toBeLessThan(0);
        expect(result.direction).toBe('shorts_pay');
      });

      it('should return zero funding rate when balanced', () => {
        const result = service.calculateFundingRate(
          1000000, // long OI
          1000000, // short OI
          'BTCUSD',
          50000,
        );

        expect(result.funding_rate).toBe(0);
        expect(result.direction).toBe('neutral');
      });

      it('should clamp funding rate to max', () => {
        // Note: With tanh model, extreme skew (1 or -1) gives tanh(1) ≈ 0.76
        // Rate = k × tanh(skew) = 0.00015 × 0.76 ≈ 0.000114
        // This is under the 0.00015 cap, so no clamping occurs with tanh
        // Clamping only happens if we use a larger k value
        const customService = new PerpetualFeeService({
          fundingConfig: { k: 0.0003 }, // Higher k to force clamping
        });

        const result = customService.calculateFundingRate(
          1000000, // long OI
          0,       // short OI (extreme imbalance)
          'BTCUSD',
          50000,
        );

        // With k=0.0003 and tanh(1)≈0.76: rate = 0.0003 × 0.76 ≈ 0.000228
        // Should be clamped to 0.00015
        expect(result.funding_rate).toBeLessThanOrEqual(DEFAULT_PERP_FEE_CONFIG.FUNDING_RATE_MAX);
        expect(result.was_clamped).toBe(true);
      });

      it('should clamp funding rate to min', () => {
        const customService = new PerpetualFeeService({
          fundingConfig: { k: 0.0003 }, // Higher k to force clamping
        });

        const result = customService.calculateFundingRate(
          0,       // long OI
          1000000, // short OI (extreme imbalance)
          'BTCUSD',
          50000,
        );

        expect(result.funding_rate).toBeGreaterThanOrEqual(DEFAULT_PERP_FEE_CONFIG.FUNDING_RATE_MIN);
        expect(result.was_clamped).toBe(true);
      });

      it('should calculate correct skew', () => {
        const result = service.calculateFundingRate(
          700000, // long OI
          300000, // short OI
          'BTCUSD',
          50000,
        );

        // (700000 - 300000) / 1000000 = 0.4
        expect(result.skew).toBe(0.4);
      });
    });

    describe('Funding Payment', () => {
      it('should calculate payment for long when rate > 0 (longs pay)', () => {
        const result = service.calculateFundingPayment({
          user_id: 'user1',
          position_id: 'pos1',
          symbol: 'BTCUSD',
          position_side: 'long',
          position_size: 1,
          mark_price: 50000,
          funding_rate: 0.0001, // 0.01%
          fee_tier_level: 0,
        });

        // 50000 * 0.0001 = 5
        expect(result.final_funding_amount).toBeGreaterThan(0);
        expect(result.payment_direction).toBe('paid');
        expect(result.base_funding_amount).toBe(5);
      });

      it('should calculate receipt for short when rate > 0 (shorts receive)', () => {
        const result = service.calculateFundingPayment({
          user_id: 'user1',
          position_id: 'pos1',
          symbol: 'BTCUSD',
          position_side: 'short',
          position_size: 1,
          mark_price: 50000,
          funding_rate: 0.0001,
          fee_tier_level: 0,
        });

        expect(result.final_funding_amount).toBeLessThan(0);
        expect(result.payment_direction).toBe('received');
      });

      it('should apply tier discount to funding payments', () => {
        const tier0 = service.calculateFundingPayment({
          user_id: 'user1',
          position_id: 'pos1',
          symbol: 'BTCUSD',
          position_side: 'long',
          position_size: 1,
          mark_price: 50000,
          funding_rate: 0.0001,
          fee_tier_level: 0,
        });

        const tier5 = service.calculateFundingPayment({
          user_id: 'user1',
          position_id: 'pos1',
          symbol: 'BTCUSD',
          position_side: 'long',
          position_size: 1,
          mark_price: 50000,
          funding_rate: 0.0001,
          fee_tier_level: 5, // 20% discount
        });

        expect(tier5.discount_rate).toBe(0.20);
        expect(tier5.final_funding_amount).toBeLessThan(tier0.final_funding_amount);
      });

      it('should not apply discount to receivers', () => {
        const result = service.calculateFundingPayment({
          user_id: 'user1',
          position_id: 'pos1',
          symbol: 'BTCUSD',
          position_side: 'short',
          position_size: 1,
          mark_price: 50000,
          funding_rate: 0.0001,
          fee_tier_level: 5,
        });

        expect(result.discount_rate).toBe(0);
        expect(result.discount_amount).toBe(0);
      });
    });

    describe('Funding Timestamp', () => {
      it('should calculate next funding timestamp', () => {
        const now = new Date('2024-01-15T04:30:00Z');
        const next = service.getNextFundingTimestamp(now);

        // Next 8-hour mark after 04:30 is 08:00
        expect(next.getUTCHours()).toBe(8);
        expect(next.getUTCMinutes()).toBe(0);
      });

      it('should roll over to next day correctly', () => {
        const now = new Date('2024-01-15T20:00:00Z');
        const next = service.getNextFundingTimestamp(now);

        // Next 8-hour mark after 20:00 is 00:00 next day
        expect(next.getUTCHours()).toBe(0);
        expect(next.getUTCDate()).toBe(16);
      });
    });
  });

  // ==========================================================================
  // LIQUIDATION TESTS
  // ==========================================================================

  describe('Liquidation', () => {
    describe('Penalty Calculation', () => {
      it('should calculate 0.4% liquidation penalty', () => {
        const result = service.calculateLiquidationPenalty({
          user_id: 'user1',
          position_id: 'pos1',
          symbol: 'BTCUSD',
          liquidated_notional: 100000,
          fee_tier_level: 0,
          liquidation_type: 'full',
        });

        // 0.4% of 100000 = 400
        expect(result.base_penalty_rate).toBe(0.004);
        expect(result.base_penalty_amount).toBe(400);
        expect(result.final_penalty_amount).toBe(400);
      });

      it('should apply tier discount to penalty', () => {
        const tier0 = service.calculateLiquidationPenalty({
          user_id: 'user1',
          position_id: 'pos1',
          symbol: 'BTCUSD',
          liquidated_notional: 100000,
          fee_tier_level: 0,
          liquidation_type: 'full',
        });

        const tier5 = service.calculateLiquidationPenalty({
          user_id: 'user1',
          position_id: 'pos1',
          symbol: 'BTCUSD',
          liquidated_notional: 100000,
          fee_tier_level: 5, // 20% discount
          liquidation_type: 'full',
        });

        expect(tier5.tier_discount_rate).toBe(0.20);
        expect(tier5.discount_amount).toBe(80);        // 400 * 0.20
        expect(tier5.final_penalty_amount).toBe(320);  // 400 - 80
      });

      it('should distribute penalty between insurance fund and liquidator', () => {
        const result = service.calculateLiquidationPenalty({
          user_id: 'user1',
          position_id: 'pos1',
          symbol: 'BTCUSD',
          liquidated_notional: 100000,
          fee_tier_level: 0,
          liquidation_type: 'full',
        });

        // 50% to insurance, 50% to liquidator
        expect(result.insurance_fund_amount).toBe(200);
        expect(result.liquidator_reward).toBe(200);
        expect(result.insurance_fund_amount + result.liquidator_reward).toBe(result.final_penalty_amount);
      });
    });

    describe('Partial Liquidation', () => {
      it('should calculate partial liquidation size', () => {
        const partialSize = service.calculatePartialLiquidationSize(10);
        expect(partialSize).toBe(2.5); // 25%
      });
    });

    describe('Liquidation Check', () => {
      it('should detect when position needs liquidation', () => {
        const result = service.shouldLiquidate(
          50,     // margin balance
          100000, // notional
          10,     // 10x leverage
        );

        // maintenance margin = 100000 * 0.005 * 10 = 5000
        expect(result.maintenanceMargin).toBe(5000);
        expect(result.shouldLiquidate).toBe(true);
      });

      it('should not liquidate healthy position', () => {
        const result = service.shouldLiquidate(
          10000,  // margin balance
          100000, // notional
          10,     // 10x leverage
        );

        expect(result.shouldLiquidate).toBe(false);
      });
    });
  });

  // ==========================================================================
  // CONFIGURATION TESTS
  // ==========================================================================

  describe('Configuration', () => {
    it('should allow custom funding config', () => {
      const customService = new PerpetualFeeService({
        fundingConfig: {
          interval_hours: 4, // 4-hour funding
          k: 0.0002,
        },
      });

      const config = customService.getFundingConfig();
      expect(config.interval_hours).toBe(4);
      expect(config.k).toBe(0.0002);
    });

    it('should allow custom liquidation config', () => {
      const customService = new PerpetualFeeService({
        liquidationConfig: {
          base_penalty_rate: 0.005, // 0.5%
        },
      });

      const result = customService.calculateLiquidationPenalty({
        user_id: 'user1',
        position_id: 'pos1',
        symbol: 'BTCUSD',
        liquidated_notional: 100000,
        fee_tier_level: 0,
        liquidation_type: 'full',
      });

      expect(result.base_penalty_rate).toBe(0.005);
      expect(result.base_penalty_amount).toBe(500);
    });

    it('should allow custom DMX discount', () => {
      const customService = new PerpetualFeeService({
        dmxDiscountPct: 0.30, // 30%
      });

      expect(customService.getDmxDiscountPct()).toBe(0.30);
    });
  });

  // ==========================================================================
  // BINANCE FUTURES PARITY TESTS
  // ==========================================================================

  describe('Binance Futures Parity', () => {
    it('should match Binance regular tier maker rebate (-0.005%)', () => {
      const tier = service.getTier(0);
      expect(tier.effective_maker_fee).toBe(-0.00005);
    });

    it('should match Binance regular tier taker fee (0.035%)', () => {
      const tier = service.getTier(0);
      expect(tier.effective_taker_fee).toBe(0.00035);
    });

    it('should have 8-hour funding interval', () => {
      const config = service.getFundingConfig();
      expect(config.interval_hours).toBe(8);
    });

    it('should cap funding rate at ±0.015%', () => {
      const config = service.getFundingConfig();
      expect(config.max_rate).toBe(0.00015);
      expect(config.min_rate).toBe(-0.00015);
    });

    it('should have 0.4% liquidation penalty', () => {
      const config = service.getLiquidationConfig();
      expect(config.base_penalty_rate).toBe(0.004);
    });

    it('should match VIP tier structure', () => {
      // VIP 5 (Diamond) should have -0.015% maker, 0.025% taker
      const tier5 = service.getTier(5);
      expect(tier5.effective_maker_fee).toBe(-0.00015);
      expect(tier5.effective_taker_fee).toBe(0.00025);

      // VIP 9 (Legendary) should have -0.025% maker, 0.015% taker
      const tier9 = service.getTier(9);
      expect(tier9.effective_maker_fee).toBe(-0.00025);
      expect(tier9.effective_taker_fee).toBe(0.00015);
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle zero notional', () => {
      const result = service.calculateTransactionFee({
        user_id: 'user1',
        trade_role: 'taker',
        notional_usd: 0,
        fee_tier_level: 0,
        pay_with_dmx: false,
      });

      expect(result.fee_amount_usd).toBe(0);
    });

    it('should handle zero open interest for funding', () => {
      const result = service.calculateFundingRate(0, 0, 'BTCUSD', 50000);
      expect(result.funding_rate).toBe(0);
      expect(result.skew).toBe(0);
    });

    it('should throw for invalid tier level', () => {
      expect(() => service.getTier(99 as any)).toThrow();
    });

    it('should handle very small position for funding', () => {
      const result = service.calculateFundingPayment({
        user_id: 'user1',
        position_id: 'pos1',
        symbol: 'BTCUSD',
        position_side: 'long',
        position_size: 0.0001,
        mark_price: 50000,
        funding_rate: 0.0001,
        fee_tier_level: 0,
      });

      expect(result.base_funding_amount).toBeCloseTo(0.0005);
    });
  });
});
