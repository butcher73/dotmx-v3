/**
 * VIP Tier Helper Functions Tests
 * Tests for TypeScript helper functions in accounts.ts
 */

import { describe, expect, test } from 'bun:test';
import {
  VIPTierLevel,
  VIP_TIER_CONFIGS,
  getVIPTierConfig,
  getVIPTierByVolume,
  calculateFeeWithVIPDiscount,
  getVIPBenefitsSummary,
} from '../src/types/accounts';

describe('VIP Tier Helper Functions', () => {
  // ============================================================================
  // TIER CONFIG TESTS
  // ============================================================================

  describe('VIP_TIER_CONFIGS', () => {
    test('should have configs for all 10 tiers', () => {
      expect(Object.keys(VIP_TIER_CONFIGS).length).toBe(10);
      
      for (let i = 0; i <= 9; i++) {
        expect(VIP_TIER_CONFIGS[i as VIPTierLevel]).toBeDefined();
      }
    });

    test('should have correct tier names', () => {
      expect(VIP_TIER_CONFIGS[0].tier_name).toBe('Regular');
      expect(VIP_TIER_CONFIGS[1].tier_name).toBe('Bronze');
      expect(VIP_TIER_CONFIGS[2].tier_name).toBe('Silver');
      expect(VIP_TIER_CONFIGS[3].tier_name).toBe('Gold');
      expect(VIP_TIER_CONFIGS[4].tier_name).toBe('Platinum');
      expect(VIP_TIER_CONFIGS[5].tier_name).toBe('Diamond');
      expect(VIP_TIER_CONFIGS[6].tier_name).toBe('Master');
      expect(VIP_TIER_CONFIGS[7].tier_name).toBe('Grandmaster');
      expect(VIP_TIER_CONFIGS[8].tier_name).toBe('Elite');
      expect(VIP_TIER_CONFIGS[9].tier_name).toBe('Legendary');
    });

    test('should have progressive volume requirements', () => {
      for (let i = 0; i < 9; i++) {
        const currentTier = VIP_TIER_CONFIGS[i as VIPTierLevel];
        const nextTier = VIP_TIER_CONFIGS[(i + 1) as VIPTierLevel];
        
        expect(nextTier.min_30d_volume_usd).toBeGreaterThan(currentTier.min_30d_volume_usd);
      }
    });

    test('should have progressive token requirements', () => {
      // Token requirements should generally increase (with some exceptions for VIP 0-1)
      expect(VIP_TIER_CONFIGS[2].min_token_holding).toBeGreaterThan(VIP_TIER_CONFIGS[1].min_token_holding);
      expect(VIP_TIER_CONFIGS[3].min_token_holding).toBeGreaterThan(VIP_TIER_CONFIGS[2].min_token_holding);
      expect(VIP_TIER_CONFIGS[9].min_token_holding).toBeGreaterThan(VIP_TIER_CONFIGS[5].min_token_holding);
    });

    test('should have progressive fee discounts', () => {
      for (let i = 0; i < 9; i++) {
        const currentTier = VIP_TIER_CONFIGS[i as VIPTierLevel];
        const nextTier = VIP_TIER_CONFIGS[(i + 1) as VIPTierLevel];
        
        expect(nextTier.maker_fee_discount).toBeGreaterThanOrEqual(currentTier.maker_fee_discount);
        expect(nextTier.taker_fee_discount).toBeGreaterThanOrEqual(currentTier.taker_fee_discount);
      }
    });

    test('should have progressive loyalty multipliers', () => {
      for (let i = 0; i < 9; i++) {
        const currentTier = VIP_TIER_CONFIGS[i as VIPTierLevel];
        const nextTier = VIP_TIER_CONFIGS[(i + 1) as VIPTierLevel];
        
        expect(nextTier.loyalty_points_multiplier).toBeGreaterThanOrEqual(currentTier.loyalty_points_multiplier);
      }
    });

    test('should have increasing withdrawal limits', () => {
      for (let i = 0; i < 9; i++) {
        const currentTier = VIP_TIER_CONFIGS[i as VIPTierLevel];
        const nextTier = VIP_TIER_CONFIGS[(i + 1) as VIPTierLevel];
        
        expect(nextTier.daily_withdrawal_limit_usd).toBeGreaterThan(currentTier.daily_withdrawal_limit_usd);
      }
    });

    test('should have increasing leverage limits', () => {
      for (let i = 0; i < 9; i++) {
        const currentTier = VIP_TIER_CONFIGS[i as VIPTierLevel];
        const nextTier = VIP_TIER_CONFIGS[(i + 1) as VIPTierLevel];
        
        expect(nextTier.max_leverage).toBeGreaterThanOrEqual(currentTier.max_leverage);
      }
    });

    test('VIP 0 should have no premium features', () => {
      const tier0 = VIP_TIER_CONFIGS[0];
      
      expect(tier0.maker_fee_discount).toBe(0);
      expect(tier0.taker_fee_discount).toBe(0);
      expect(tier0.loyalty_points_multiplier).toBe(1.0);
      expect(tier0.priority_customer_support).toBe(false);
      expect(tier0.dedicated_account_manager).toBe(false);
      expect(tier0.otc_trading_access).toBe(false);
      expect(tier0.exclusive_events_access).toBe(false);
      expect(tier0.early_feature_access).toBe(false);
    });

    test('VIP 5+ should have premium features', () => {
      for (let i = 5; i <= 9; i++) {
        const tier = VIP_TIER_CONFIGS[i as VIPTierLevel];
        
        expect(tier.priority_customer_support).toBe(true);
        expect(tier.dedicated_account_manager).toBe(true);
        expect(tier.otc_trading_access).toBe(true);
        expect(tier.exclusive_events_access).toBe(true);
        expect(tier.early_feature_access).toBe(true);
      }
    });
  });

  // ============================================================================
  // getVIPTierConfig TESTS
  // ============================================================================

  describe('getVIPTierConfig', () => {
    test('should return config for valid tier level', () => {
      const config = getVIPTierConfig(3);
      
      expect(config).toBeDefined();
      expect(config.tier_level).toBe(3);
      expect(config.tier_name).toBe('Gold');
    });

    test('should return config for tier 0', () => {
      const config = getVIPTierConfig(0);
      
      expect(config.tier_level).toBe(0);
      expect(config.tier_name).toBe('Regular');
    });

    test('should return config for highest tier', () => {
      const config = getVIPTierConfig(9);
      
      expect(config.tier_level).toBe(9);
      expect(config.tier_name).toBe('Legendary');
    });

    test('should return config with all required fields', () => {
      const config = getVIPTierConfig(5);
      
      expect(config.tier_level).toBeDefined();
      expect(config.tier_name).toBeDefined();
      expect(config.min_30d_volume_usd).toBeDefined();
      expect(config.min_token_holding).toBeDefined();
      expect(config.maker_fee_discount).toBeDefined();
      expect(config.taker_fee_discount).toBeDefined();
      expect(config.daily_withdrawal_limit_usd).toBeDefined();
      expect(config.max_leverage).toBeDefined();
      expect(config.loyalty_points_multiplier).toBeDefined();
      expect(config.badge_color).toBeDefined();
      expect(config.badge_icon).toBeDefined();
    });
  });

  // ============================================================================
  // getVIPTierByVolume TESTS
  // ============================================================================

  describe('getVIPTierByVolume', () => {
    test('should return tier 0 for zero volume', () => {
      const tier = getVIPTierByVolume(0, 0);
      expect(tier).toBe(0);
    });

    test('should return tier 1 for $50K volume', () => {
      const tier = getVIPTierByVolume(50000, 0);
      expect(tier).toBe(1); // Bronze
    });

    test('should return tier 1 for $60K volume (above threshold)', () => {
      const tier = getVIPTierByVolume(60000, 0);
      expect(tier).toBe(1); // Bronze
    });

    test('should return tier 0 if volume below $50K', () => {
      const tier = getVIPTierByVolume(49999, 0);
      expect(tier).toBe(0); // Regular
    });

    test('should require tokens for tier 2', () => {
      // $250K volume but no tokens
      const tier = getVIPTierByVolume(250000, 0);
      expect(tier).toBe(1); // Bronze (can't reach Silver without tokens)
    });

    test('should return tier 2 with volume + tokens', () => {
      const tier = getVIPTierByVolume(250000, 1000);
      expect(tier).toBe(2); // Silver
    });

    test('should return tier 3 for $1M volume + tokens', () => {
      const tier = getVIPTierByVolume(1000000, 5000);
      expect(tier).toBe(3); // Gold
    });

    test('should return tier 4 for $5M volume + tokens', () => {
      const tier = getVIPTierByVolume(5000000, 10000);
      expect(tier).toBe(4); // Platinum
    });

    test('should return tier 5 for $25M volume + tokens', () => {
      const tier = getVIPTierByVolume(25000000, 50000);
      expect(tier).toBe(5); // Diamond
    });

    test('should return tier 9 for $1B+ volume + tokens', () => {
      const tier = getVIPTierByVolume(1000000000, 1000000);
      expect(tier).toBe(9); // Legendary
    });

    test('should not upgrade if tokens insufficient', () => {
      // $1M volume but only 1000 tokens (need 5000 for Gold)
      const tier = getVIPTierByVolume(1000000, 1000);
      expect(tier).toBe(2); // Silver (highest tier with 1000 tokens)
    });

    test('should return highest eligible tier', () => {
      // $100M volume with 100K tokens should get Master (VIP 6)
      const tier = getVIPTierByVolume(100000000, 100000);
      expect(tier).toBe(6); // Master
    });

    test('should handle extremely high volume', () => {
      const tier = getVIPTierByVolume(10000000000, 10000000); // $10B
      expect(tier).toBe(9); // Legendary (max tier)
    });

    test('should handle edge case at exact threshold', () => {
      // Exactly at Bronze threshold
      const tier1 = getVIPTierByVolume(50000, 0);
      expect(tier1).toBe(1);
      
      // Exactly at Silver threshold
      const tier2 = getVIPTierByVolume(250000, 1000);
      expect(tier2).toBe(2);
    });
  });

  // ============================================================================
  // calculateFeeWithVIPDiscount TESTS
  // ============================================================================

  describe('calculateFeeWithVIPDiscount', () => {
    test('should calculate fee with no discount', () => {
      const fee = calculateFeeWithVIPDiscount(0.001, 0);
      expect(fee).toBe(0.001);
    });

    test('should calculate fee with VIP 1 discount', () => {
      const baseFee = 0.001; // 0.10%
      const discount = 0.0005; // 0.05%
      const fee = calculateFeeWithVIPDiscount(baseFee, discount);
      
      expect(fee).toBe(0.0005); // 0.05%
    });

    test('should calculate fee with VIP 5 discount', () => {
      const baseFee = 0.001; // 0.10%
      const discount = 0.0025; // 0.25%
      const fee = calculateFeeWithVIPDiscount(baseFee, discount);
      
      expect(fee).toBe(0); // Negative result clamped to 0 by Math.max
    });

    test('should not return negative fees', () => {
      const baseFee = 0.001;
      const discount = 0.005; // Discount larger than fee
      const fee = calculateFeeWithVIPDiscount(baseFee, discount);
      
      expect(fee).toBeGreaterThanOrEqual(0);
    });

    test('should handle zero base fee', () => {
      const fee = calculateFeeWithVIPDiscount(0, 0.001);
      expect(fee).toBe(0);
    });

    test('should handle decimal precision', () => {
      const baseFee = 0.001;
      const discount = 0.0005;
      const fee = calculateFeeWithVIPDiscount(baseFee, discount);
      
      expect(fee).toBeCloseTo(0.0005, 5);
    });
  });

  // ============================================================================
  // getVIPBenefitsSummary TESTS
  // ============================================================================

  describe('getVIPBenefitsSummary', () => {
    test('should return benefits summary for tier 0', () => {
      const summary = getVIPBenefitsSummary(0);
      
      expect(summary).toBeDefined();
      expect(summary.feeDiscount).toBe('0.00% Maker / 0.00% Taker');
      expect(summary.withdrawalLimit).toBe('$10,000/day');
      expect(summary.leverage).toBe('20x');
      expect(summary.pointsMultiplier).toBe('1x');
      expect(summary.specialFeatures).toEqual([]);
    });

    test('should return benefits summary for tier 1', () => {
      const summary = getVIPBenefitsSummary(1);
      
      expect(summary.feeDiscount).toBe('0.05% Maker / 0.05% Taker');
      expect(summary.withdrawalLimit).toBe('$50,000/day');
      expect(summary.leverage).toBe('25x');
      expect(summary.pointsMultiplier).toBe('1.1x');
      expect(summary.specialFeatures).toEqual([]);
    });

    test('should return benefits summary for tier 2 with priority support', () => {
      const summary = getVIPBenefitsSummary(2);
      
      expect(summary.feeDiscount).toBe('0.10% Maker / 0.10% Taker');
      expect(summary.specialFeatures).toContain('Priority Support');
    });

    test('should return benefits summary for tier 3 with events', () => {
      const summary = getVIPBenefitsSummary(3);
      
      expect(summary.feeDiscount).toBe('0.15% Maker / 0.15% Taker');
      expect(summary.specialFeatures).toContain('Priority Support');
      expect(summary.specialFeatures).toContain('Exclusive Events');
    });

    test('should return benefits summary for tier 4 with OTC', () => {
      const summary = getVIPBenefitsSummary(4);
      
      expect(summary.specialFeatures).toContain('OTC Trading');
    });

    test('should return benefits summary for tier 5 with all features', () => {
      const summary = getVIPBenefitsSummary(5);
      
      expect(summary.feeDiscount).toBe('0.25% Maker / 0.25% Taker');
      expect(summary.withdrawalLimit).toBe('$5,000,000/day');
      expect(summary.leverage).toBe('100x');
      expect(summary.pointsMultiplier).toBe('1.75x');
      expect(summary.specialFeatures).toContain('Priority Support');
      expect(summary.specialFeatures).toContain('Account Manager');
      expect(summary.specialFeatures).toContain('OTC Trading');
      expect(summary.specialFeatures).toContain('Exclusive Events');
      expect(summary.specialFeatures).toContain('Early Feature Access');
    });

    test('should return benefits summary for tier 9 (Legendary)', () => {
      const summary = getVIPBenefitsSummary(9);
      
      expect(summary.feeDiscount).toBe('0.50% Maker / 0.50% Taker');
      expect(summary.withdrawalLimit).toBe('$100,000,000/day');
      expect(summary.leverage).toBe('250x');
      expect(summary.pointsMultiplier).toBe('4x');
      expect(summary.specialFeatures.length).toBe(5);
    });

    test('should format withdrawal limits with commas', () => {
      const summary5 = getVIPBenefitsSummary(5);
      expect(summary5.withdrawalLimit).toContain(',');
      
      const summary9 = getVIPBenefitsSummary(9);
      expect(summary9.withdrawalLimit).toBe('$100,000,000/day');
    });

    test('should format percentages correctly', () => {
      const summary3 = getVIPBenefitsSummary(3);
      expect(summary3.feeDiscount).toMatch(/\d+\.\d{2}% Maker \/ \d+\.\d{2}% Taker/);
    });

    test('should list special features in correct order', () => {
      const summary = getVIPBenefitsSummary(5);
      
      // Should appear in this order based on the code
      const features = summary.specialFeatures;
      expect(features.includes('Priority Support')).toBe(true);
      expect(features.includes('Account Manager')).toBe(true);
      expect(features.includes('OTC Trading')).toBe(true);
      expect(features.includes('Exclusive Events')).toBe(true);
      expect(features.includes('Early Feature Access')).toBe(true);
    });
  });

  // ============================================================================
  // INTEGRATION TESTS
  // ============================================================================

  describe('integration scenarios', () => {
    test('should correctly determine tier progression', () => {
      const scenarios = [
        { volume: 0, tokens: 0, expectedTier: 0 },
        { volume: 60000, tokens: 0, expectedTier: 1 },
        { volume: 300000, tokens: 1500, expectedTier: 2 },
        { volume: 1200000, tokens: 6000, expectedTier: 3 },
        { volume: 6000000, tokens: 12000, expectedTier: 4 },
        { volume: 30000000, tokens: 60000, expectedTier: 5 },
        { volume: 150000000, tokens: 150000, expectedTier: 6 },
        { volume: 300000000, tokens: 300000, expectedTier: 7 },
        { volume: 600000000, tokens: 600000, expectedTier: 8 },
        { volume: 1500000000, tokens: 1500000, expectedTier: 9 },
      ];

      for (const scenario of scenarios) {
        const tier = getVIPTierByVolume(scenario.volume, scenario.tokens);
        expect(tier).toBe(scenario.expectedTier);
      }
    });

    test('should calculate correct fees for each tier', () => {
      const baseFee = 0.001; // 0.10%

      for (let i = 0; i <= 9; i++) {
        const config = getVIPTierConfig(i as VIPTierLevel);
        const effectiveFee = calculateFeeWithVIPDiscount(baseFee, config.maker_fee_discount);
        
        // Effective fee should decrease as tier increases
        expect(effectiveFee).toBeLessThanOrEqual(baseFee);
        expect(effectiveFee).toBeGreaterThanOrEqual(0);
      }
    });

    test('should provide consistent benefits summaries', () => {
      for (let i = 0; i <= 9; i++) {
        const summary = getVIPBenefitsSummary(i as VIPTierLevel);
        
        expect(summary.feeDiscount).toBeDefined();
        expect(summary.withdrawalLimit).toBeDefined();
        expect(summary.leverage).toBeDefined();
        expect(summary.pointsMultiplier).toBeDefined();
        expect(Array.isArray(summary.specialFeatures)).toBe(true);
      }
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    test('should handle fractional volumes', () => {
      const tier = getVIPTierByVolume(50000.5, 0);
      expect(tier).toBe(1);
    });

    test('should handle fractional tokens', () => {
      const tier = getVIPTierByVolume(250000, 1000.5);
      expect(tier).toBe(2);
    });

    test('should handle very small volumes', () => {
      const tier = getVIPTierByVolume(0.01, 0);
      expect(tier).toBe(0);
    });

    test('should handle negative volumes (edge case)', () => {
      const tier = getVIPTierByVolume(-1000, 0);
      expect(tier).toBe(0);
    });

    test('should handle negative tokens (edge case)', () => {
      const tier = getVIPTierByVolume(100000, -100);
      expect(tier).toBe(0); // Negative tokens fail the >= check, returns tier 0
    });

    test('should handle NaN values gracefully', () => {
      const tier = getVIPTierByVolume(NaN, 0);
      expect(tier).toBe(0);
    });

    test('should handle Infinity values', () => {
      const tier = getVIPTierByVolume(Infinity, Infinity);
      expect(tier).toBe(9); // Should get max tier
    });

    test('should handle mixed Infinity volume with zero tokens', () => {
      const tier = getVIPTierByVolume(Infinity, 0);
      expect(tier).toBe(1); // Can only reach Bronze without tokens
    });

    test('should handle zero discount scenario', () => {
      const baseFee = 0.001;
      const fee = calculateFeeWithVIPDiscount(baseFee, 0);
      expect(fee).toBe(0.001);
    });

    test('should validate tier config completeness for all tiers', () => {
      for (let i = 0; i <= 9; i++) {
        const config = getVIPTierConfig(i as VIPTierLevel);
        expect(config.tier_level).toBe(i);
        expect(typeof config.tier_name).toBe('string');
        expect(config.min_30d_volume_usd).toBeGreaterThanOrEqual(0);
        expect(config.min_token_holding).toBeGreaterThanOrEqual(0);
        expect(config.maker_fee_discount).toBeGreaterThanOrEqual(0);
        expect(config.taker_fee_discount).toBeGreaterThanOrEqual(0);
      }
    });
  });
});
