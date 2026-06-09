// ============================================================================
// FEE CALCULATION SERVICE TESTS
// ============================================================================

import { describe, test, expect, beforeAll, beforeEach, afterEach, afterAll } from 'bun:test';
import { FeeCalculationService } from '../../src/services/fee-calculation.service';
import type { FeeCalculationInput, FeeTierLevel } from '../../src/types/fees';
import { TestDatabase, ensureTestDatabase } from '../../src/test-db-helper';
import { PostgresDB } from '../../src/db/postgres-client';
import pg from 'pg';

describe('FeeCalculationService', () => {
  let testDb: TestDatabase;
  let service: FeeCalculationService;
  let testUserId: string;

  beforeAll(async () => {
    // Ensure test database exists
    await ensureTestDatabase();
    
    // Connect to test database
    testDb = new TestDatabase();
    await testDb.connect();
    
    // Setup database schema
    await testDb.setupDatabase();
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    // Clear database before each test
    await testDb.clearDatabase();
    
    // Re-initialize data
    await testDb.setupDatabase();
    
    // Create service with PostgresDB
    const db = new PostgresDB(testDb.getClient());
    service = new FeeCalculationService(db);
    
    // Create test user with proper UUID
    testUserId = crypto.randomUUID();
    await testDb.query(
      `INSERT INTO users (id, email) VALUES ($1, $2)`,
      [testUserId, `test${Date.now()}@test.com`]
    );
  });

  afterEach(async () => {
    // Cleanup after each test
    await testDb.clearDatabase();
  });

  // ============================================================================
  // FEE TIER TESTS
  // ============================================================================

  describe('Fee Tier Management', () => {
    test('should get all fee tiers', async () => {
      const tiers = await service.getAllFeeTiers();
      expect(tiers).toHaveLength(10);
      expect(tiers[0].tier_level).toBe(0);
      expect(tiers[9].tier_level).toBe(9);
    });

    test('should get specific fee tier', async () => {
      const tier = await service.getFeeTier(5);
      expect(tier).toBeDefined();
      expect(tier?.tier_name).toBe('Diamond');
      expect(Number(tier?.effective_maker_fee)).toBeCloseTo(0.000750, 6);
      expect(Number(tier?.effective_taker_fee)).toBeCloseTo(0.000750, 6);
    });

    test('should calculate correct tier by volume only', async () => {
      // Silver requires 250K volume + 1K DMX, but we're passing 0 DMX
      // So it should return Bronze (tier 1) which only needs 50K volume
      const tier = await service.calculateFeeTier(300000, 0);
      expect(tier).toBe(1); // Bronze (since we don't have DMX for Silver)
    });

    test('should calculate correct tier by volume and DMX', async () => {
      const tier = await service.calculateFeeTier(1500000, 6000);
      expect(tier).toBe(3); // Gold
    });

    test('should return tier 0 for no volume', async () => {
      const tier = await service.calculateFeeTier(0, 0);
      expect(tier).toBe(0);
    });

    test('should return highest eligible tier', async () => {
      const tier = await service.calculateFeeTier(2000000000, 2000000);
      expect(tier).toBe(9); // Legendary
    });
  });

  // ============================================================================
  // FEE CALCULATION TESTS
  // ============================================================================

  describe('Fee Calculation', () => {
    test('should calculate base maker fee (tier 0)', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 10000,
        fee_tier_level: 0,
        dmx_balance: 0,
        pay_with_dmx: false,
      };

      const result = await service.calculateTradingFee(input);
      
      expect(result.base_fee_usd).toBe(10); // 0.1% of 10000
      expect(result.vip_discount_usd).toBe(0); // No VIP discount for tier 0
      expect(result.dmx_discount_usd).toBe(0); // Not paying with DMX
      expect(result.final_fee_usd).toBe(10);
      expect(result.effective_fee_rate).toBe(0.001);
    });

    test('should calculate base taker fee (tier 0)', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'taker',
        trade_value_usd: 10000,
        fee_tier_level: 0,
        dmx_balance: 0,
        pay_with_dmx: false,
      };

      const result = await service.calculateTradingFee(input);
      
      expect(result.base_fee_usd).toBe(10);
      expect(result.final_fee_usd).toBe(10);
    });

    test('should apply VIP discount (tier 3 - Gold)', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 10000,
        fee_tier_level: 3,
        dmx_balance: 0,
        pay_with_dmx: false,
      };

      const result = await service.calculateTradingFee(input);
      
      expect(result.base_fee_usd).toBe(10);
      expect(result.vip_discount_usd).toBeCloseTo(1.5, 2); // 0.015% of 10000
      expect(result.final_fee_usd).toBeCloseTo(8.5, 2); // 10 - 1.5
      expect(result.effective_fee_rate).toBeCloseTo(0.00085, 5);
    });

    test('should apply VIP discount (tier 9 - Legendary)', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 100000,
        fee_tier_level: 9,
        dmx_balance: 0,
        pay_with_dmx: false,
      };

      const result = await service.calculateTradingFee(input);
      
      expect(result.base_fee_usd).toBe(100); // 0.1% of 100000
      expect(result.vip_discount_usd).toBe(50); // 0.05% of 100000 (50% discount!)
      expect(result.final_fee_usd).toBe(50); // 50% off
      expect(result.effective_fee_rate).toBe(0.0005);
      expect(result.discount_percentage).toBe(50);
    });

    test('should apply DMX discount on top of VIP discount', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 10000,
        fee_tier_level: 3, // Gold: 0.085% effective
        dmx_balance: 100,
        pay_with_dmx: true,
        dmx_usd_price: 1.0,
      };

      const result = await service.calculateTradingFee(input);
      
      expect(result.base_fee_usd).toBe(10); // 0.1%
      expect(result.vip_discount_usd).toBeCloseTo(1.5, 2); // 0.015% VIP discount
      const feeAfterVIP = 8.5; // 10 - 1.5
      expect(result.dmx_discount_usd).toBeCloseTo(2.125, 2); // 25% of 8.5
      expect(result.final_fee_usd).toBeCloseTo(6.375, 2); // 8.5 - 2.125
      expect(result.fee_paid_in_dmx).toBe(true);
      expect(result.dmx_amount).toBeCloseTo(6.375, 2);
    });

    test('should calculate DMX amount correctly', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'taker',
        trade_value_usd: 5000,
        fee_tier_level: 0,
        dmx_balance: 100,
        pay_with_dmx: true,
        dmx_usd_price: 2.5,
      };

      const result = await service.calculateTradingFee(input);
      
      const feeInUSD = 5000 * 0.001 * 0.75; // Base fee * 75% (25% discount)
      const dmxAmount = feeInUSD / 2.5;
      
      expect(result.final_fee_usd).toBeCloseTo(feeInUSD, 2);
      expect(result.dmx_amount).toBeCloseTo(dmxAmount, 2);
      expect(result.dmx_usd_price).toBe(2.5);
    });

    test('should not apply DMX discount if not enabled', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 10000,
        fee_tier_level: 0,
        dmx_balance: 100,
        pay_with_dmx: false, // Not enabled
      };

      const result = await service.calculateTradingFee(input);
      
      expect(result.dmx_discount_usd).toBe(0);
      expect(result.fee_paid_in_dmx).toBe(false);
      expect(result.dmx_amount).toBeUndefined();
    });

    test('should calculate maximum discount (tier 9 + DMX)', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 100000,
        fee_tier_level: 9,
        dmx_balance: 1000000,
        pay_with_dmx: true,
        dmx_usd_price: 1.0,
      };

      const result = await service.calculateTradingFee(input);
      
      // Base: 0.1% = 100 USD
      // After VIP (50% off): 50 USD
      // After DMX (25% off): 37.5 USD
      // Total discount: 62.5%
      
      expect(result.base_fee_usd).toBe(100);
      expect(result.vip_discount_usd).toBe(50);
      expect(result.dmx_discount_usd).toBe(12.5);
      expect(result.final_fee_usd).toBe(37.5);
      expect(result.total_discount_usd).toBe(62.5);
      expect(result.discount_percentage).toBe(62.5);
    });
  });

  // ============================================================================
  // USER FEE TIER TESTS
  // ============================================================================

  describe('User Fee Tier Management', () => {
    test('should initialize user fee tier', async () => {
      const userTier = await service.initializeUserFeeTier(testUserId);
      
      expect(userTier.user_id).toBe(testUserId);
      expect(userTier.current_tier).toBe(0);
      expect(Number(userTier.volume_30d_usd)).toBe(0);
      expect(Number(userTier.current_dmx_balance)).toBe(0);
      expect(Number(userTier.effective_maker_fee)).toBeCloseTo(0.001, 6);
      expect(Number(userTier.effective_taker_fee)).toBeCloseTo(0.001, 6);
    });

    test('should get user fee tier', async () => {
      await service.initializeUserFeeTier(testUserId);
      const userTier = await service.getUserFeeTier(testUserId);
      
      expect(userTier).toBeDefined();
      expect(userTier?.user_id).toBe(testUserId);
    });

    test('should update volume and upgrade tier', async () => {
      await service.initializeUserFeeTier(testUserId);
      
      const result = await service.updateUserVolumeAndCheckTier(
        testUserId,
        300000, // Silver tier volume
        1500    // Silver tier DMX
      );
      
      expect(result.current_tier).toBe(2); // Silver
      expect(result.calculated_tier).toBe(2);
      expect(result.should_change).toBe(true);
      expect(result.change_type).toBe('upgrade');
      expect(result.is_locked).toBeFalsy();
    });

    test('should lock tier after upgrade', async () => {
      await service.initializeUserFeeTier(testUserId);
      
      // First upgrade to Silver
      await service.updateUserVolumeAndCheckTier(testUserId, 300000, 1500);
      
      // Check if locked
      const userTier = await service.getUserFeeTier(testUserId);
      expect(userTier?.tier_locked_until).toBeDefined();
      
      // Try to upgrade again immediately (should be locked)
      const result = await service.updateUserVolumeAndCheckTier(
        testUserId,
        1500000, // Gold volume
        6000     // Gold DMX
      );
      
      expect(result.is_locked).toBe(true);
      expect(result.should_change).toBe(false);
      expect(result.current_tier).toBe(2); // Still Silver
    });

    test('should calculate next tier requirements', async () => {
      await service.initializeUserFeeTier(testUserId);
      
      const result = await service.updateUserVolumeAndCheckTier(
        testUserId,
        25000,  // Half of Bronze requirement
        0
      );
      
      expect(result.next_tier_requirements).toBeDefined();
      expect(result.next_tier_requirements?.tier_level).toBe(1); // Bronze
      expect(result.next_tier_requirements?.volume_needed).toBe(25000); // 50K - 25K
      expect(result.next_tier_requirements?.volume_progress_pct).toBe(50);
    });

    test('should handle tier downgrade', async () => {
      await service.initializeUserFeeTier(testUserId);
      
      // Upgrade to Gold
      await service.updateUserVolumeAndCheckTier(testUserId, 1500000, 6000);
      
      // Manually unlock tier (simulate 7 days passing)
      await testDb.query(`UPDATE user_fee_tier SET tier_locked_until = NULL WHERE user_id = $1`, [testUserId]);
      
      // Volume drops to Silver level
      const result = await service.updateUserVolumeAndCheckTier(testUserId, 300000, 1500);
      
      expect(result.current_tier).toBe(2); // Downgraded to Silver
      expect(result.change_type).toBe('downgrade');
    });
  });

  // ============================================================================
  // DMX DISCOUNT TESTS
  // ============================================================================

  describe('DMX Discount', () => {
    test('should get DMX discount config', async () => {
      const config = await service.getDMXDiscountConfig();
      
      expect(config).toBeDefined();
      expect(Number(config?.discount_percentage)).toBeCloseTo(0.25, 2); // 25%
      expect(config?.is_enabled).toBe(true);
      expect(config?.stackable_with_vip).toBe(true);
    });

    test('should check DMX discount eligibility (eligible)', async () => {
      const eligibility = await service.checkDMXDiscountEligibility(100);
      
      expect(eligibility.is_eligible).toBe(true);
      expect(eligibility.has_sufficient_balance).toBe(true);
      expect(Number(eligibility.discount_percentage)).toBeCloseTo(0.25, 2);
      expect(eligibility.is_enabled).toBe(true);
    });

    test('should check DMX discount eligibility (insufficient balance)', async () => {
      // Update config to require minimum balance
      await testDb.query(`UPDATE dmx_fee_discount_config SET min_dmx_balance = 100`);
      service.clearCache();
      
      const eligibility = await service.checkDMXDiscountEligibility(50);
      
      expect(eligibility.is_eligible).toBe(false);
      expect(eligibility.has_sufficient_balance).toBe(false);
      expect(eligibility.reason).toBe('Insufficient DMX balance');
    });

    test('should set DMX payment preference', async () => {
      await service.initializeUserFeeTier(testUserId);
      await service.setDMXPaymentPreference(testUserId, true);
      
      const userTier = await service.getUserFeeTier(testUserId);
      expect(userTier?.pay_fees_with_dmx).toBe(true);
    });
  });

  // ============================================================================
  // FEE RECORDING TESTS
  // ============================================================================

  describe('Fee Recording', () => {
    test('should record fee collection', async () => {
      await service.initializeUserFeeTier(testUserId);
      
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 10000,
        fee_tier_level: 3,
        dmx_balance: 100,
        pay_with_dmx: true,
        dmx_usd_price: 1.0,
      };

      const feeResult = await service.calculateTradingFee(input);
      
      const tradeId = crypto.randomUUID();
      const orderId = crypto.randomUUID();
      const feeId = await service.recordFeeCollection(
        tradeId,
        orderId,
        testUserId,
        'BTC-USD',
        'maker',
        50000,
        0.2,
        feeResult,
        3
      );
      
      expect(feeId).toBeDefined();
      expect(feeId.length).toBeGreaterThan(0);
      
      // Verify record
      const result = await testDb.query('SELECT * FROM trading_fees_collected WHERE id = $1', [feeId]);
      const record = result.rows[0];
      expect(record).toBeDefined();
      expect(record.trade_id).toBe(tradeId);
      expect(record.fee_tier_level).toBe(3);
      expect(record.trade_side).toBe('maker');
    });

    test('should update user fee statistics after recording', async () => {
      await service.initializeUserFeeTier(testUserId);
      
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 10000,
        fee_tier_level: 0,
        dmx_balance: 0,
        pay_with_dmx: false,
      };

      const feeResult = await service.calculateTradingFee(input);
      await service.recordFeeCollection(
        crypto.randomUUID(),
        crypto.randomUUID(),
        testUserId,
        'BTC-USD',
        'maker',
        50000,
        0.2,
        feeResult,
        0
      );
      
      const userTier = await service.getUserFeeTier(testUserId);
      expect(Number(userTier?.total_fees_paid_usd)).toBeGreaterThan(0);
    });
  });

  // ============================================================================
  // STATISTICS TESTS
  // ============================================================================

  describe('Fee Statistics', () => {
    test('should get user fee statistics', async () => {
      await service.initializeUserFeeTier(testUserId);
      
      // Record some fees
      for (let i = 0; i < 3; i++) {
        const input: FeeCalculationInput = {
          user_id: testUserId,
          trade_side: i % 2 === 0 ? 'maker' : 'taker',
          trade_value_usd: 10000,
          fee_tier_level: 0,
          dmx_balance: 0,
          pay_with_dmx: false,
        };
        
        const feeResult = await service.calculateTradingFee(input);
        await service.recordFeeCollection(
          crypto.randomUUID(),
          crypto.randomUUID(),
          testUserId,
          'BTC-USD',
          input.trade_side,
          50000,
          0.2,
          feeResult,
          0
        );
      }
      
      // Mark as settled
      await testDb.query(`UPDATE trading_fees_collected SET settlement_status = 'settled'`);
      
      const stats = await service.getUserFeeStatistics(
        testUserId,
        new Date('2020-01-01'),
        new Date('2030-12-31')
      );
      
      expect(Number(stats.total_trades)).toBe(3);
      expect(Number(stats.maker_trades)).toBe(2);
      expect(Number(stats.taker_trades)).toBe(1);
      expect(Number(stats.total_fees_paid_usd)).toBeGreaterThan(0);
    });

    test('should get user current fees view', async () => {
      await service.initializeUserFeeTier(testUserId);
      await service.updateUserVolumeAndCheckTier(testUserId, 300000, 1500);
      
      const view = await service.getUserCurrentFeesView(testUserId);
      
      expect(view).toBeDefined();
      expect(view?.current_tier).toBe(2); // Silver
      expect(view?.tier_name).toBe('Silver');
      // VIP maker fee should be <= base_maker_fee (both from fee_tiers table)
      expect(Number(view?.vip_maker_fee)).toBeLessThanOrEqual(Number(view?.base_maker_fee));
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    test('should handle zero trade value', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 0,
        fee_tier_level: 0,
        dmx_balance: 0,
        pay_with_dmx: false,
      };

      const result = await service.calculateTradingFee(input);
      
      expect(result.base_fee_usd).toBe(0);
      expect(result.final_fee_usd).toBe(0);
      expect(result.effective_fee_rate).toBe(0);
    });

    test('should handle very small trade values', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 0.01,
        fee_tier_level: 0,
        dmx_balance: 0,
        pay_with_dmx: false,
      };

      const result = await service.calculateTradingFee(input);
      
      expect(result.final_fee_usd).toBeGreaterThan(0);
      expect(result.final_fee_usd).toBeLessThan(0.01);
    });

    test('should handle very large trade values', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 100000000, // 100M
        fee_tier_level: 9,
        dmx_balance: 1000000,
        pay_with_dmx: true,
        dmx_usd_price: 1.0,
      };

      const result = await service.calculateTradingFee(input);
      
      expect(result.final_fee_usd).toBeGreaterThan(0);
      expect(result.discount_percentage).toBeGreaterThan(50);
    });

    test('should ensure fees never go negative', async () => {
      // This shouldn't happen, but let's test it
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 10000,
        fee_tier_level: 9, // Maximum discount
        dmx_balance: 1000000,
        pay_with_dmx: true,
      };

      const result = await service.calculateTradingFee(input);
      
      expect(result.final_fee_usd).toBeGreaterThanOrEqual(0);
    });

    test('should handle missing DMX price gracefully', async () => {
      const input: FeeCalculationInput = {
        user_id: testUserId,
        trade_side: 'maker',
        trade_value_usd: 10000,
        fee_tier_level: 0,
        dmx_balance: 100,
        pay_with_dmx: true,
        // dmx_usd_price not provided
      };

      const result = await service.calculateTradingFee(input);
      
      expect(result.fee_paid_in_dmx).toBe(true);
      expect(result.dmx_amount).toBeUndefined();
      expect(result.final_fee_usd).toBeGreaterThan(0);
    });
  });
});
