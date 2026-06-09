/**
 * VIP Tier Service Tests
 * Tests for Binance-style VIP tier system
 */

import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { VIPTierService } from '../../src/services/vip-tier.service';
import { TestDatabase, ensureTestDatabase } from '../../src/test-db-helper';
import { PostgresDB } from '../../src/db/postgres-client';

describe('VIPTierService', () => {
  let testDb: TestDatabase;
  let service: VIPTierService;
  let testUserId: string;

  beforeAll(async () => {
    // Ensure test database exists
    await ensureTestDatabase();
    
    // Connect to test database
    testDb = new TestDatabase();
    await testDb.connect();
    
    // Setup database schema
    await testDb.setupDatabase();
    
    // Initialize service with PostgresDB
    const db = new PostgresDB(testDb.getClient());
    service = new VIPTierService(db);
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    // Clear database before each test
    await testDb.clearDatabase();
    
    // Create test user with proper UUID
    testUserId = crypto.randomUUID();
    
    // Insert test user into database
    await testDb.query(
      `INSERT INTO users (id, email) VALUES ($1, $2)`,
      [testUserId, `test${Date.now()}@test.com`]
    );
  });

  // ============================================================================
  // INITIALIZATION TESTS
  // ============================================================================

  describe('initializeVIPStatus', () => {
    test('should initialize VIP status for new user', async () => {
      const status = await service.initializeVIPStatus(testUserId);
      
      expect(status).toBeDefined();
      expect(status.user_id).toBe(testUserId);
      expect(status.current_tier).toBe(0);
      expect(status.previous_tier).toBe(0);
      expect(status.volume_30d_usd).toBe(0);
      expect(status.effective_maker_fee).toBe(0.001);
      expect(status.effective_taker_fee).toBe(0.001);
    });

    test('should return existing status if already initialized', async () => {
      await service.initializeVIPStatus(testUserId);
      const status = await service.getVIPStatus(testUserId);
      
      expect(status).toBeDefined();
      expect(status!.current_tier).toBe(0);
    });
  });

  describe('getVIPStatus', () => {
    test('should get VIP status for user', async () => {
      await service.initializeVIPStatus(testUserId);
      const status = await service.getVIPStatus(testUserId);
      
      expect(status).toBeDefined();
      expect(status!.user_id).toBe(testUserId);
    });

    test('should return null for non-existent user', async () => {
      const nonExistentUserId = crypto.randomUUID();
      const status = await service.getVIPStatus(nonExistentUserId);
      expect(status).toBeNull();
    });
  });

  // ============================================================================
  // VOLUME TRACKING TESTS
  // ============================================================================

  describe('recordDailyVolume', () => {
    test('should record daily trading volume', async () => {
      await service.recordDailyVolume(testUserId, 10000, 50, {
        spot: 6000,
        futures: 4000,
      });

      // Verify volume was recorded
      const volume = await service.calculate30DayVolume(testUserId);
      expect(Number(volume.volume_30d_usd)).toBe(10000);
      expect(Number(volume.total_trades)).toBe(50);
    });

    test('should accumulate multiple daily volumes', async () => {
      await service.recordDailyVolume(testUserId, 5000, 20, { spot: 5000 });
      await service.recordDailyVolume(testUserId, 3000, 15, { futures: 3000 });

      const volume = await service.calculate30DayVolume(testUserId);
      expect(Number(volume.volume_30d_usd)).toBe(8000); // Same day accumulates
      expect(Number(volume.total_trades)).toBe(35);
    });

    test('should update existing snapshot for same day', async () => {
      const today = new Date().toISOString().split('T')[0];
      
      await service.recordDailyVolume(testUserId, 10000, 10);
      await service.recordDailyVolume(testUserId, 5000, 5);

      const volume = await service.calculate30DayVolume(testUserId);
      expect(Number(volume.volume_30d_usd)).toBe(15000); // Accumulated
    });
  });

  describe('calculate30DayVolume', () => {
    test('should calculate 30-day rolling volume', async () => {
      // Record volume for multiple days
      for (let i = 0; i < 5; i++) {
        await service.recordDailyVolume(testUserId, 10000, 10);
      }

      const volume = await service.calculate30DayVolume(testUserId);
      expect(Number(volume.volume_30d_usd)).toBeGreaterThanOrEqual(50000);
      expect(Number(volume.daily_average)).toBeGreaterThan(0);
    });

    test('should return zero for user with no volume', async () => {
      const volume = await service.calculate30DayVolume(testUserId);
      expect(Number(volume.volume_30d_usd)).toBe(0);
      expect(Number(volume.total_trades)).toBe(0);
    });

    test('should calculate daily average correctly', async () => {
      await service.recordDailyVolume(testUserId, 30000, 30);
      
      const volume = await service.calculate30DayVolume(testUserId);
      expect(Number(volume.daily_average)).toBe(30000); // 1 day of volume
    });
  });

  // ============================================================================
  // TIER CALCULATION TESTS
  // ============================================================================

  describe('updateVolumeAndTier', () => {
    test('should upgrade to VIP 1 (Bronze) with $50K volume', async () => {
      await service.initializeVIPStatus(testUserId);
      await service.recordDailyVolume(testUserId, 60000, 100);

      const result = await service.updateVolumeAndTier(testUserId, 0);
      
      expect(result.oldTier).toBe(0);
      expect(result.newTier).toBe(1); // Bronze
      expect(result.tierChanged).toBe(true);
      expect(result.status.current_tier).toBe(1);
    });

    test('should upgrade to VIP 2 (Silver) with volume + tokens', async () => {
      await service.initializeVIPStatus(testUserId);
      await service.recordDailyVolume(testUserId, 300000, 200);

      const result = await service.updateVolumeAndTier(testUserId, 1500); // 1500 tokens
      
      expect(result.newTier).toBe(2); // Silver (needs $250K + 1000 tokens)
      expect(result.tierChanged).toBe(true);
    });

    test('should upgrade to VIP 3 (Gold) with $1M volume', async () => {
      await service.initializeVIPStatus(testUserId);
      await service.recordDailyVolume(testUserId, 1200000, 500);

      const result = await service.updateVolumeAndTier(testUserId, 6000); // 6000 tokens
      
      expect(result.newTier).toBe(3); // Gold
      expect(result.tierChanged).toBe(true);
    });

    test('should not upgrade if tokens insufficient', async () => {
      await service.initializeVIPStatus(testUserId);
      await service.recordDailyVolume(testUserId, 300000, 200);

      const result = await service.updateVolumeAndTier(testUserId, 500); // Only 500 tokens
      
      expect(result.newTier).toBe(1); // Bronze (can't reach Silver without 1000 tokens)
    });

    test('should downgrade tier when volume drops', async () => {
      await service.initializeVIPStatus(testUserId);
      
      // First upgrade to VIP 2
      await service.recordDailyVolume(testUserId, 300000, 200);
      await service.updateVolumeAndTier(testUserId, 1500);
      
      // Wait for lock period (in test, we'll manually update)
      await testDb.query(
        `UPDATE user_vip_status SET tier_lock_until = NULL WHERE user_id = $1`,
        [testUserId]
      );
      
      // Clear volume snapshots
      await testDb.query(`DELETE FROM vip_volume_snapshots WHERE user_id = $1`, [testUserId]);
      
      // Record lower volume
      await service.recordDailyVolume(testUserId, 40000, 20);
      const result = await service.updateVolumeAndTier(testUserId, 0);
      
      expect(result.newTier).toBe(0); // Downgraded to Regular
      expect(result.tierChanged).toBe(true);
    });

    test('should calculate effective fees with VIP discount', async () => {
      await service.initializeVIPStatus(testUserId);
      await service.recordDailyVolume(testUserId, 60000, 100);

      const result = await service.updateVolumeAndTier(testUserId, 0);
      
      // VIP 1 (Bronze) has 0.0005 discount
      expect(result.status.effective_maker_fee).toBe(0.001 - 0.0005); // 0.0005
      expect(result.status.effective_taker_fee).toBe(0.001 - 0.0005); // 0.0005
    });

    test('should set next tier requirements', async () => {
      await service.initializeVIPStatus(testUserId);
      await service.recordDailyVolume(testUserId, 60000, 100);

      const result = await service.updateVolumeAndTier(testUserId, 0);
      
      // Should show requirements for VIP 2 (Silver)
      expect(result.status.next_tier_volume_needed).toBe(250000);
      expect(result.status.next_tier_tokens_needed).toBe(1000);
    });
  });

  // ============================================================================
  // TIER LOCK PERIOD TESTS
  // ============================================================================

  describe('tier lock period', () => {
    test('should apply 7-day lock after upgrade', async () => {
      await service.initializeVIPStatus(testUserId);
      await service.recordDailyVolume(testUserId, 60000, 100);

      await service.updateVolumeAndTier(testUserId, 0);
      
      const status = await service.getVIPStatus(testUserId);
      expect(status!.tier_lock_until).not.toBeNull();
      
      // Lock should be ~7 days from now
      const lockDate = new Date(status!.tier_lock_until!);
      const now = new Date();
      const daysDiff = (lockDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      
      expect(daysDiff).toBeGreaterThan(6);
      expect(daysDiff).toBeLessThan(8);
    });

    test('should not change tier during lock period', async () => {
      await service.initializeVIPStatus(testUserId);
      
      // Upgrade to VIP 1
      await service.recordDailyVolume(testUserId, 60000, 100);
      await service.updateVolumeAndTier(testUserId, 0);
      
      // Clear volume (should downgrade but locked)
      await testDb.query(`DELETE FROM vip_volume_snapshots WHERE user_id = $1`, [testUserId]);
      await service.recordDailyVolume(testUserId, 1000, 5);
      
      const result = await service.updateVolumeAndTier(testUserId, 0);
      
      expect(result.tierChanged).toBe(false);
      expect(result.newTier).toBe(1); // Still VIP 1 due to lock
    });

    test('should update volume even during lock period', async () => {
      await service.initializeVIPStatus(testUserId);
      
      // Upgrade to VIP 1
      await service.recordDailyVolume(testUserId, 60000, 100);
      await service.updateVolumeAndTier(testUserId, 0);
      
      // Record more volume during lock
      await service.recordDailyVolume(testUserId, 50000, 50);
      
      const status = await service.getVIPStatus(testUserId);
      // Volume should be updated even though tier is locked
      expect(status!.volume_30d_usd).toBeGreaterThan(0);
    });

    test('should allow tier change after lock expires', async () => {
      await service.initializeVIPStatus(testUserId);
      
      // Upgrade to VIP 1
      await service.recordDailyVolume(testUserId, 60000, 100);
      await service.updateVolumeAndTier(testUserId, 0);
      
      // Manually expire lock
      await testDb.query(
        `UPDATE user_vip_status SET tier_lock_until = NOW() - INTERVAL '1 day' WHERE user_id = $1`,
        [testUserId]
      );
      
      // Clear volume
      await testDb.query(`DELETE FROM vip_volume_snapshots WHERE user_id = $1`, [testUserId]);
      await service.recordDailyVolume(testUserId, 1000, 5);
      
      const result = await service.updateVolumeAndTier(testUserId, 0);
      
      expect(result.tierChanged).toBe(true);
      expect(result.newTier).toBe(0); // Downgraded after lock expired
    });
  });

  // ============================================================================
  // MANUAL TIER CHANGE TESTS
  // ============================================================================

  describe('manualTierChange', () => {
    test('should allow admin to manually change tier', async () => {
      await service.initializeVIPStatus(testUserId);
      
      const adminUserId = crypto.randomUUID();
      // Insert admin user to satisfy FK constraint
      await testDb.query(
        `INSERT INTO users (id, email) VALUES ($1, $2)`,
        [adminUserId, `admin${Date.now()}@test.com`]
      );
      await service.manualTierChange(testUserId, 5, adminUserId, 'Partnership agreement');
      
      const status = await service.getVIPStatus(testUserId);
      expect(status!.current_tier).toBe(5); // Diamond
      expect(status!.previous_tier).toBe(0);
    });

    test('should record manual tier change in history', async () => {
      await service.initializeVIPStatus(testUserId);
      
      const adminUserId = crypto.randomUUID();
      // Insert admin user to satisfy FK constraint
      await testDb.query(
        `INSERT INTO users (id, email) VALUES ($1, $2)`,
        [adminUserId, `admin${Date.now()}@test.com`]
      );
      await service.manualTierChange(testUserId, 3, adminUserId, 'VIP promotion');
      
      const history = await service.getTierHistory(testUserId);
      expect(history.length).toBeGreaterThan(0);
      
      const lastChange = history[0];
      expect(lastChange.from_tier).toBe(0);
      expect(lastChange.to_tier).toBe(3);
      expect(lastChange.change_type).toBe('manual');
      expect(lastChange.admin_user_id).toBe(adminUserId);
    });

    test('should throw error if user not found', async () => {
      const nonExistentUserId = crypto.randomUUID();
      const adminUserId = crypto.randomUUID();
      await expect(async () => {
        await service.manualTierChange(nonExistentUserId, 5, adminUserId, 'test');
      }).toThrow();
    });
  });

  // ============================================================================
  // TIER HISTORY TESTS
  // ============================================================================

  describe('getTierHistory', () => {
    test('should track tier upgrade in history', async () => {
      await service.initializeVIPStatus(testUserId);
      await service.recordDailyVolume(testUserId, 60000, 100);
      await service.updateVolumeAndTier(testUserId, 0);
      
      const history = await service.getTierHistory(testUserId);
      expect(history.length).toBe(1);
      
      const upgrade = history[0];
      expect(upgrade.from_tier).toBe(0);
      expect(upgrade.to_tier).toBe(1);
      expect(upgrade.change_type).toBe('upgrade');
      expect(upgrade.trigger_reason).toBe('volume_threshold');
    });

    test('should track tier downgrade in history', async () => {
      await service.initializeVIPStatus(testUserId);
      
      // Upgrade
      await service.recordDailyVolume(testUserId, 60000, 100);
      await service.updateVolumeAndTier(testUserId, 0);
      
      // Expire lock and downgrade
      await testDb.query(`UPDATE user_vip_status SET tier_lock_until = NULL WHERE user_id = $1`, [testUserId]);
      await testDb.query(`DELETE FROM vip_volume_snapshots WHERE user_id = $1`, [testUserId]);
      await service.recordDailyVolume(testUserId, 1000, 5);
      await service.updateVolumeAndTier(testUserId, 0);
      
      const history = await service.getTierHistory(testUserId);
      expect(history.length).toBe(2);
      
      const downgrade = history[0]; // Most recent
      expect(downgrade.change_type).toBe('downgrade');
    });

    test('should limit history results', async () => {
      await service.initializeVIPStatus(testUserId);
      
      // Create admin user for manual tier changes
      const adminUserId = crypto.randomUUID();
      await testDb.query(
        `INSERT INTO users (id, email) VALUES ($1, $2)`,
        [adminUserId, `admin${Date.now()}@test.com`]
      );
      
      // Create multiple tier changes
      for (let i = 0; i < 10; i++) {
        await service.manualTierChange(testUserId, (i % 5) as any, adminUserId, `Change ${i}`);
      }
      
      const history = await service.getTierHistory(testUserId, 5);
      expect(history.length).toBeLessThanOrEqual(5);
    });
  });

  // ============================================================================
  // BATCH OPERATIONS TESTS
  // ============================================================================

  describe('updateAllUserTiers', () => {
    test('should update tiers for all users', async () => {
      // Create multiple test users
      const user1 = crypto.randomUUID();
      const user2 = crypto.randomUUID();
      
      await testDb.query(
        `INSERT INTO users (id, email, username, password_hash, status, account_type)
         VALUES ($1, $2, $3, $4, 'active', 'retail')`,
        [user1, `${user1}@test.com`, user1.substring(0, 8), 'hash']
      );
      await testDb.query(
        `INSERT INTO users (id, email, username, password_hash, status, account_type)
         VALUES ($1, $2, $3, $4, 'active', 'retail')`,
        [user2, `${user2}@test.com`, user2.substring(0, 8), 'hash']
      );
      
      await service.initializeVIPStatus(user1);
      await service.initializeVIPStatus(user2);
      
      // Add volume to user1
      await service.recordDailyVolume(user1, 60000, 100);
      
      const results = await service.updateAllUserTiers();
      
      expect(results.total).toBeGreaterThan(0);
      expect(results.upgraded + results.downgraded + results.unchanged).toBe(results.total);
    });
  });

  describe('getTierStatistics', () => {
    test('should return statistics for all tiers', async () => {
      // Create users at different tiers
      const users = [];
      for (let i = 0; i < 3; i++) {
        const userId = crypto.randomUUID();
        await testDb.query(
          `INSERT INTO users (id, email, username, password_hash, status, account_type)
           VALUES ($1, $2, $3, $4, 'active', 'retail')`,
          [userId, `${userId}@test.com`, userId.substring(0, 8), 'hash']
        );
        await service.initializeVIPStatus(userId);
        users.push(userId);
      }
      
      const stats = await service.getTierStatistics();
      
      expect(stats).toBeDefined();
      expect(Array.isArray(stats)).toBe(true);
      expect(stats.length).toBeGreaterThan(0);
      
      // Check stat structure
      if (stats.length > 0) {
        const stat = stats[0];
        expect(stat.tier).toBeDefined();
        expect(stat.tier_name).toBeDefined();
        expect(Number(stat.user_count)).toBeGreaterThanOrEqual(0);
      }
    });
  });

  describe('getUpgradeEligibleUsers', () => {
    test('should return users eligible for upgrade', async () => {
      await service.initializeVIPStatus(testUserId);
      
      // Record volume that qualifies for next tier
      await service.recordDailyVolume(testUserId, 55000, 100);
      await service.updateVolumeAndTier(testUserId, 0);
      
      // Mark as eligible
      await testDb.query(
        `UPDATE user_vip_status SET tier_upgrade_eligible = true, tier_lock_until = NULL WHERE user_id = $1`,
        [testUserId]
      );
      
      const eligible = await service.getUpgradeEligibleUsers();
      
      expect(Array.isArray(eligible)).toBe(true);
    });
  });

  // ============================================================================
  // CLEANUP TESTS
  // ============================================================================

  describe('cleanupOldSnapshots', () => {
    test('should delete snapshots older than 90 days', async () => {
      // Insert old snapshot
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100);
      
      await testDb.query(
        `INSERT INTO vip_volume_snapshots (user_id, snapshot_date, daily_volume_usd, daily_trades)
         VALUES ($1, $2, $3, $4)`,
        [testUserId, oldDate.toISOString().split('T')[0], 1000, 10]
      );
      
      const deletedCount = await service.cleanupOldSnapshots();
      expect(deletedCount).toBeGreaterThanOrEqual(1);
    });

    test('should keep snapshots within 90 days', async () => {
      await service.recordDailyVolume(testUserId, 10000, 50);
      
      await service.cleanupOldSnapshots();
      
      const volume = await service.calculate30DayVolume(testUserId);
      expect(Number(volume.volume_30d_usd)).toBe(10000); // Should still be there
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('edge cases', () => {
    test('should handle zero volume gracefully', async () => {
      await service.initializeVIPStatus(testUserId);
      await service.recordDailyVolume(testUserId, 0, 0);
      
      const result = await service.updateVolumeAndTier(testUserId, 0);
      expect(result.newTier).toBe(0);
    });

    test('should handle extremely high volume', async () => {
      await service.initializeVIPStatus(testUserId);
      await service.recordDailyVolume(testUserId, 2000000000, 10000); // $2B
      
      const result = await service.updateVolumeAndTier(testUserId, 2000000);
      expect(result.newTier).toBe(9); // Legendary
    });

    test('should handle tier at max level', async () => {
      await service.initializeVIPStatus(testUserId);
      const adminUserId = crypto.randomUUID();
      await testDb.query(
        `INSERT INTO users (id, email) VALUES ($1, $2)`,
        [adminUserId, `admin${Date.now()}@test.com`]
      );
      await service.manualTierChange(testUserId, 9, adminUserId, 'Max tier test');
      
      const status = await service.getVIPStatus(testUserId);
      expect(status!.next_tier_volume_needed).toBeNull();
      expect(status!.next_tier_tokens_needed).toBeNull();
    });

    test('should handle concurrent volume updates', async () => {
      await service.initializeVIPStatus(testUserId);
      
      // Simulate concurrent updates
      await Promise.all([
        service.recordDailyVolume(testUserId, 5000, 10),
        service.recordDailyVolume(testUserId, 3000, 8),
        service.recordDailyVolume(testUserId, 2000, 5),
      ]);
      
      const volume = await service.calculate30DayVolume(testUserId);
      expect(Number(volume.volume_30d_usd)).toBeGreaterThan(0);
    });

    test('should track highest tier achieved', async () => {
      await service.initializeVIPStatus(testUserId);
      
      // Upgrade to VIP 3
      await service.recordDailyVolume(testUserId, 1200000, 500);
      await service.updateVolumeAndTier(testUserId, 6000);
      
      // Downgrade
      await testDb.query(`UPDATE user_vip_status SET tier_lock_until = NULL WHERE user_id = $1`, [testUserId]);
      await testDb.query(`DELETE FROM vip_volume_snapshots WHERE user_id = $1`, [testUserId]);
      await service.recordDailyVolume(testUserId, 1000, 5);
      await service.updateVolumeAndTier(testUserId, 0);
      
      const status = await service.getVIPStatus(testUserId);
      expect(status!.highest_tier_achieved).toBe(3); // Should remember VIP 3
    });
  });
});
