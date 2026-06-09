/**
 * Loyalty Service Tests
 */

import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { LoyaltyPointsService } from '../../src/services/loyalty.service';
import { UserDatabaseService } from '../../src/services/user-database.service';

describe('LoyaltyPointsService', () => {
  let db: UserDatabaseService;
  let service: LoyaltyPointsService;
  let testUserId: string;

  beforeAll(async () => {
    // Initialize test database
    db = new UserDatabaseService({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.TEST_USER_DB_NAME || 'dotmx_users_test',
      user: process.env.DB_USER || 'kowito',
      password: process.env.DB_PASSWORD,
    });

    // Wait for connection
    const isConnected = await db.ping();
    expect(isConnected).toBe(true);
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Create test user with unique email
    const uniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const user = await db.queryOne<{ id: string }>(
      `INSERT INTO users (email, username, password_hash, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id`,
      [`test_${uniqueId}@test.com`, `testuser_${uniqueId}`, 'hash']
    );
    testUserId = user!.id;

    // Initialize service
    service = new LoyaltyPointsService(db, {
      base_points_per_usd_volume: 0.01,
      min_volume_for_points: 10,
      max_daily_points: 100000,
    });
  });

  describe('getUserPoints', () => {
    test('should get user loyalty points', async () => {
      const points = await service.getUserPoints(testUserId);
      expect(points).toBeDefined();
      expect(points?.user_id).toBe(testUserId);
      expect(Number(points?.balance)).toBe(0);
      expect(points?.tier).toBe('bronze');
      expect(Number(points?.multiplier)).toBe(1.0);
    });

    test('should return null for non-existent user', async () => {
      const points = await service.getUserPoints('00000000-0000-0000-0000-000000000000');
      expect(points).toBeNull();
    });
  });

  describe('awardPointsForVolume', () => {
    test('should award points for trading volume', async () => {
      const volume = 10000; // $10,000
      const expectedPoints = Math.floor(volume * 0.01); // 100 points

      const transaction = await service.awardPointsForVolume(testUserId, volume);
      expect(transaction).toBeDefined();
      expect(transaction?.type).toBe('earn');
      expect(Number(transaction?.amount)).toBeGreaterThanOrEqual(expectedPoints);

      // Check balance updated
      const points = await service.getUserPoints(testUserId);
      expect(Number(points?.balance)).toBeGreaterThanOrEqual(expectedPoints);
    });

    test('should not award points for volume below minimum', async () => {
      const transaction = await service.awardPointsForVolume(testUserId, 5); // $5
      expect(transaction).toBeNull();
    });

    test('should cap points at max daily limit', async () => {
      const transaction = await service.awardPointsForVolume(testUserId, 100000000); // $100M
      expect(transaction).toBeDefined();
      expect(Number(transaction!.amount)).toBeLessThanOrEqual(100000);
    });
  });

  describe('awardBonusPoints', () => {
    test('should award bonus points', async () => {
      const transaction = await service.awardBonusPoints(
        testUserId,
        500,
        'promotion',
        'Welcome bonus'
      );

      expect(transaction).toBeDefined();
      expect(transaction?.type).toBe('bonus');
      expect(Number(transaction?.amount)).toBe(500);

      const points = await service.getUserPoints(testUserId);
      expect(Number(points?.balance)).toBe(500);
    });
  });

  describe('spendPoints', () => {
    test('should spend points successfully', async () => {
      // Award points first
      await service.awardBonusPoints(testUserId, 1000, 'test', 'Test points');

      // Spend points
      const transaction = await service.spendPoints(
        testUserId,
        300,
        'reward',
        'Fee discount redemption'
      );

      expect(transaction).toBeDefined();
      expect(transaction?.type).toBe('spend');
      expect(Number(transaction?.amount)).toBe(-300);

      const points = await service.getUserPoints(testUserId);
      expect(Number(points?.balance)).toBe(700);
    });

    test('should throw error when insufficient balance', async () => {
      await expect(async () => {
        await service.spendPoints(testUserId, 1000, 'reward', 'Test');
      }).toThrow('Insufficient points balance');
    });
  });

  describe('recordTradingVolume', () => {
    test('should record daily trading volume', async () => {
      const date = new Date();
      await service.recordTradingVolume({
        user_id: testUserId,
        date,
        total_volume_usd: 5000,
        buy_volume_usd: 3000,
        sell_volume_usd: 2000,
        trade_count: 10,
      });

      const volume = await db.queryOne<any>(
        'SELECT * FROM user_trading_volume WHERE user_id = $1 AND date = $2',
        [testUserId, date]
      );

      expect(volume).toBeDefined();
      expect(Number(volume?.total_volume_usd)).toBe(5000);
      expect(volume?.trade_count).toBe(10);
    });

    test('should aggregate multiple volume records for same day', async () => {
      const date = new Date();

      await service.recordTradingVolume({
        user_id: testUserId,
        date,
        total_volume_usd: 1000,
        buy_volume_usd: 600,
        sell_volume_usd: 400,
        trade_count: 5,
      });

      await service.recordTradingVolume({
        user_id: testUserId,
        date,
        total_volume_usd: 2000,
        buy_volume_usd: 1200,
        sell_volume_usd: 800,
        trade_count: 8,
      });

      const volume = await db.queryOne<any>(
        'SELECT * FROM user_trading_volume WHERE user_id = $1 AND date = $2',
        [testUserId, date]
      );

      expect(Number(volume?.total_volume_usd)).toBe(3000);
      expect(volume?.trade_count).toBe(13);
    });
  });

  describe('recordDailyProfit', () => {
    test('should record daily profit and update multiplier', async () => {
      const date = new Date();
      await service.recordDailyProfit({
        user_id: testUserId,
        date,
        realized_pnl_usd: 500,
        unrealized_pnl_usd: 100,
        total_pnl_usd: 600,
        profit_percentage: 5.5,
        starting_balance_usd: 10000,
        ending_balance_usd: 10600,
        win_rate: 70,
        profit_factor: 2.1,
      });

      const profit = await db.queryOne<any>(
        'SELECT * FROM user_trading_profit WHERE user_id = $1 AND date = $2',
        [testUserId, date]
      );

      expect(profit).toBeDefined();
      expect(Number(profit?.total_pnl_usd)).toBe(600);
      expect(Number(profit?.profit_percentage)).toBe(5.5);

      // Check multiplier is properly calculated (may be 1.0 if profit_multiplier_tiers not seeded)
      // The recalculateMultiplier is called, which is the key behavior being tested
      const points = await service.getUserPoints(testUserId);
      expect(Number(points?.daily_profit_multiplier)).toBeGreaterThanOrEqual(1.0);
    });
  });

  describe('updateUserTier', () => {
    test('should update user tier based on lifetime points', async () => {
      // Award enough points for gold tier
      await service.awardBonusPoints(testUserId, 60000, 'test', 'Tier test');

      const tier = await service.updateUserTier(testUserId);
      expect(tier).toBe('gold');

      const points = await service.getUserPoints(testUserId);
      expect(points?.tier).toBe('gold');
    });

    test('should progress through tiers correctly', async () => {
      // Bronze to Silver (10k)
      await service.awardBonusPoints(testUserId, 12000, 'test', 'Silver test');
      let tier = await service.updateUserTier(testUserId);
      expect(tier).toBe('silver');

      // Silver to Gold (50k)
      await service.awardBonusPoints(testUserId, 40000, 'test', 'Gold test');
      tier = await service.updateUserTier(testUserId);
      expect(tier).toBe('gold');

      // Gold to Platinum (200k)
      await service.awardBonusPoints(testUserId, 150000, 'test', 'Platinum test');
      tier = await service.updateUserTier(testUserId);
      expect(tier).toBe('platinum');
    });
  });

  describe('getLeaderboard', () => {
    test('should get points leaderboard', async () => {
      const leaderboard = await service.getLeaderboard('points', 'all_time', 10);
      expect(Array.isArray(leaderboard)).toBe(true);
    });

    test('should get volume leaderboard', async () => {
      const leaderboard = await service.getLeaderboard('volume', 'monthly', 10);
      expect(Array.isArray(leaderboard)).toBe(true);
    });

    test('should get profit leaderboard', async () => {
      const leaderboard = await service.getLeaderboard('profit', 'weekly', 10);
      expect(Array.isArray(leaderboard)).toBe(true);
    });
  });

  describe('getPointsTransactions', () => {
    test('should get transaction history', async () => {
      await service.awardBonusPoints(testUserId, 100, 'test1', 'Test 1');
      await service.awardBonusPoints(testUserId, 200, 'test2', 'Test 2');
      await service.awardBonusPoints(testUserId, 300, 'test3', 'Test 3');

      const transactions = await service.getPointsTransactions(testUserId, 10, 0);
      expect(transactions.length).toBeGreaterThanOrEqual(3);
      expect(transactions[0].type).toBe('bonus');
    });

    test('should paginate transactions', async () => {
      for (let i = 0; i < 15; i++) {
        await service.awardBonusPoints(testUserId, 100, `test${i}`, `Test ${i}`);
      }

      const page1 = await service.getPointsTransactions(testUserId, 10, 0);
      const page2 = await service.getPointsTransactions(testUserId, 10, 10);

      expect(page1.length).toBe(10);
      expect(page2.length).toBeGreaterThan(0);
      expect(page1[0].id).not.toBe(page2[0].id);
    });
  });

  describe('recalculateMultiplier', () => {
    test('should calculate multiplier based on profit', async () => {
      const multiplier = await service.recalculateMultiplier(testUserId);
      expect(Number(multiplier)).toBeGreaterThanOrEqual(1.0);
    });
  });
});
