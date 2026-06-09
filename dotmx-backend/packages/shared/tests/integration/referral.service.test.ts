/**
 * Referral Service Tests
 */

import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { ReferralService } from '../../src/services/referral.service';
import { LoyaltyPointsService } from '../../src/services/loyalty.service';
import { UserDatabaseService } from '../../src/services/user-database.service';

describe('ReferralService', () => {
  let db: UserDatabaseService;
  let loyaltyService: LoyaltyPointsService;
  let service: ReferralService;
  let referrerId: string;
  let refereeId: string;

  beforeAll(async () => {
    db = new UserDatabaseService({
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.TEST_USER_DB_NAME || 'dotmx_users_test',
      user: process.env.DB_USER || 'kowito',
      password: process.env.DB_PASSWORD,
    });

    const isConnected = await db.ping();
    expect(isConnected).toBe(true);
  });

  afterAll(async () => {
    await db.close();
  });

  beforeEach(async () => {
    // Create referrer user with unique email
    const referrerUniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const referrer = await db.queryOne<{ id: string }>(
      `INSERT INTO users (email, username, password_hash, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id`,
      [`referrer_${referrerUniqueId}@test.com`, `referrer_${referrerUniqueId}`, 'hash']
    );
    referrerId = referrer!.id;

    // Create referee user with unique email
    const refereeUniqueId = `${Date.now()}_${Math.random().toString(36).substring(2, 10)}`;
    const referee = await db.queryOne<{ id: string }>(
      `INSERT INTO users (email, username, password_hash, status)
       VALUES ($1, $2, $3, 'active')
       RETURNING id`,
      [`referee_${refereeUniqueId}@test.com`, `referee_${refereeUniqueId}`, 'hash']
    );
    refereeId = referee!.id;

    // Initialize services
    loyaltyService = new LoyaltyPointsService(db);
    service = new ReferralService(db, loyaltyService, {
      default_signup_reward: 100,
      default_first_trade_reward: 500,
      default_commission_percentage: 10,
    });
  });

  describe('createReferralCode', () => {
    test('should create referral code with default settings', async () => {
      const code = await service.createReferralCode(referrerId);

      expect(code).toBeDefined();
      expect(code.user_id).toBe(referrerId);
      expect(code.code).toContain('DOTMX');
      expect(code.is_active).toBe(true);
      expect(Number(code.signup_reward_points)).toBe(100);
      expect(Number(code.first_trade_reward_points)).toBe(500);
      expect(Number(code.commission_percentage)).toBe(10);
    });

    test('should create referral code with custom settings', async () => {
      const customCode = `CUSTOM${Date.now()}`;
      const code = await service.createReferralCode(referrerId, {
        custom_code: customCode,
        max_uses: 50,
        signup_reward: 200,
        first_trade_reward: 1000,
        commission_percentage: 15,
      });

      expect(code.code).toBe(customCode);
      expect(code.max_uses).toBe(50);
      expect(Number(code.signup_reward_points)).toBe(200);
      expect(Number(code.first_trade_reward_points)).toBe(1000);
      expect(Number(code.commission_percentage)).toBe(15);
    });

    test('should enforce max active codes limit', async () => {
      // Create 5 codes (max limit)
      for (let i = 0; i < 5; i++) {
        await service.createReferralCode(referrerId);
      }

      // Try to create 6th code
      await expect(async () => {
        await service.createReferralCode(referrerId);
      }).toThrow('Maximum active referral codes limit reached');
    });

    test('should generate unique codes', async () => {
      const code1 = await service.createReferralCode(referrerId);
      const code2 = await service.createReferralCode(referrerId);

      expect(code1.code).not.toBe(code2.code);
    });
  });

  describe('getUserReferralCodes', () => {
    test('should get user referral codes', async () => {
      await service.createReferralCode(referrerId);
      await service.createReferralCode(referrerId);

      const codes = await service.getUserReferralCodes(referrerId);
      expect(codes.length).toBe(2);
    });

    test('should return empty array for user with no codes', async () => {
      const codes = await service.getUserReferralCodes(refereeId);
      expect(codes.length).toBe(0);
    });
  });

  describe('getReferralCodeByCode', () => {
    test('should get referral code by code string', async () => {
      const customCode = `FINDME${Date.now()}`;
      const created = await service.createReferralCode(referrerId, {
        custom_code: customCode,
      });

      const found = await service.getReferralCodeByCode(customCode);
      expect(found).toBeDefined();
      expect(found?.id).toBe(created.id);
    });

    test('should return null for non-existent code', async () => {
      const found = await service.getReferralCodeByCode('NOTFOUND');
      expect(found).toBeNull();
    });
  });

  describe('applyReferralCode', () => {
    test('should apply referral code and distribute signup rewards', async () => {
      const code = await service.createReferralCode(referrerId);

      const referral = await service.applyReferralCode(refereeId, code.code);

      expect(referral).toBeDefined();
      expect(referral.referrer_id).toBe(referrerId);
      expect(referral.referee_id).toBe(refereeId);
      expect(referral.status).toBe('pending');

      // Check both users received signup rewards
      const referrerPoints = await loyaltyService.getUserPoints(referrerId);
      const refereePoints = await loyaltyService.getUserPoints(refereeId);

      expect(Number(referrerPoints?.balance)).toBeGreaterThanOrEqual(100);
      expect(Number(refereePoints?.balance)).toBeGreaterThanOrEqual(100);
    });

    test('should reject invalid referral code', async () => {
      await expect(async () => {
        await service.applyReferralCode(refereeId, 'INVALID');
      }).toThrow('Invalid referral code');
    });

    test('should reject inactive referral code', async () => {
      const code = await service.createReferralCode(referrerId);
      await service.deactivateReferralCode(referrerId, code.id);

      await expect(async () => {
        await service.applyReferralCode(refereeId, code.code);
      }).toThrow('Referral code is not active');
    });

    test('should reject self-referral', async () => {
      const code = await service.createReferralCode(referrerId);

      await expect(async () => {
        await service.applyReferralCode(referrerId, code.code);
      }).toThrow('Cannot use your own referral code');
    });

    test('should reject expired referral code', async () => {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);

      const code = await service.createReferralCode(referrerId, {
        expires_at: yesterday,
      });

      await expect(async () => {
        await service.applyReferralCode(refereeId, code.code);
      }).toThrow('Referral code has expired');
    });

    test('should reject when max uses reached', async () => {
      const code = await service.createReferralCode(referrerId, { max_uses: 1 });

      // First use should work
      await service.applyReferralCode(refereeId, code.code);

      // Create another user for second attempt
      const user2 = await db.queryOne<{ id: string }>(
        `INSERT INTO users (email, username, password_hash, status)
         VALUES ($1, $2, $3, 'active') RETURNING id`,
        [`user2_${Date.now()}@test.com`, `user2_${Date.now()}`, 'hash']
      );

      // Second use should fail
      await expect(async () => {
        await service.applyReferralCode(user2!.id, code.code);
      }).toThrow('Referral code has reached maximum uses');
    });

    test('should reject if user already used a code', async () => {
      const code1 = await service.createReferralCode(referrerId);
      await service.applyReferralCode(refereeId, code1.code);

      const code2 = await service.createReferralCode(referrerId);

      await expect(async () => {
        await service.applyReferralCode(refereeId, code2.code);
      }).toThrow('User has already used a referral code');
    });
  });

  describe('handleFirstTrade', () => {
    test('should distribute first trade rewards', async () => {
      const code = await service.createReferralCode(referrerId);
      await service.applyReferralCode(refereeId, code.code);

      // Handle first trade
      await service.handleFirstTrade(refereeId, 1000);

      // Check both users received first trade rewards
      const referrerPoints = await loyaltyService.getUserPoints(referrerId);
      const refereePoints = await loyaltyService.getUserPoints(refereeId);

      expect(Number(referrerPoints?.balance)).toBeGreaterThanOrEqual(600); // 100 signup + 500 first trade
      expect(Number(refereePoints?.balance)).toBeGreaterThanOrEqual(600);

      // Check referral status updated
      const referral = await db.queryOne<any>(
        'SELECT * FROM referrals WHERE referee_id = $1',
        [refereeId]
      );
      expect(referral?.status).toBe('completed');
      expect(referral?.first_trade_at).toBeDefined();
    });

    test('should not reward second trade', async () => {
      const code = await service.createReferralCode(referrerId);
      await service.applyReferralCode(refereeId, code.code);

      await service.handleFirstTrade(refereeId, 1000);
      const pointsAfterFirst = await loyaltyService.getUserPoints(referrerId);

      await service.handleFirstTrade(refereeId, 2000);
      const pointsAfterSecond = await loyaltyService.getUserPoints(referrerId);

      expect(pointsAfterFirst?.balance).toBe(pointsAfterSecond?.balance);
    });
  });

  describe('checkVolumeMilestones', () => {
    test('should award milestone rewards', async () => {
      const code = await service.createReferralCode(referrerId);
      await service.applyReferralCode(refereeId, code.code);
      await service.handleFirstTrade(refereeId, 100);

      // Check first milestone ($1,000)
      await service.checkVolumeMilestones(refereeId, 1500);

      const points = await loyaltyService.getUserPoints(referrerId);
      const initialBalance = points?.balance || 0;

      // Milestone should have been awarded
      const rewards = await db.query<any>(
        `SELECT * FROM referral_rewards 
         WHERE recipient_id = $1 AND reward_type = 'volume_milestone'`,
        [referrerId]
      );

      expect(rewards.length).toBeGreaterThan(0);
    });

    test('should not award same milestone twice', async () => {
      const code = await service.createReferralCode(referrerId);
      await service.applyReferralCode(refereeId, code.code);
      await service.handleFirstTrade(refereeId, 100);

      await service.checkVolumeMilestones(refereeId, 1500);
      const pointsAfterFirst = await loyaltyService.getUserPoints(referrerId);

      await service.checkVolumeMilestones(refereeId, 1600);
      const pointsAfterSecond = await loyaltyService.getUserPoints(referrerId);

      expect(pointsAfterFirst?.balance).toBe(pointsAfterSecond?.balance);
    });
  });

  describe('getReferralStatistics', () => {
    test('should get referral statistics', async () => {
      const code = await service.createReferralCode(referrerId);
      await service.applyReferralCode(refereeId, code.code);
      await service.handleFirstTrade(refereeId, 1000);

      const stats = await service.getReferralStatistics(referrerId);

      expect(Number(stats.total_referrals)).toBeGreaterThanOrEqual(1);
      expect(Number(stats.active_referrals)).toBeGreaterThanOrEqual(1);
      expect(Array.isArray(stats.rewards_by_type)).toBe(true);
    });
  });

  describe('getUserReferrals', () => {
    test('should get user referrals', async () => {
      const code = await service.createReferralCode(referrerId);
      await service.applyReferralCode(refereeId, code.code);

      const referrals = await service.getUserReferrals(referrerId, 10, 0);
      expect(referrals.length).toBe(1);
      expect(referrals[0].referee_id).toBe(refereeId);
    });

    test('should paginate referrals', async () => {
      const code = await service.createReferralCode(referrerId);

      // Create multiple referees
      for (let i = 0; i < 5; i++) {
        const user = await db.queryOne<{ id: string }>(
          `INSERT INTO users (email, username, password_hash, status)
           VALUES ($1, $2, $3, 'active') RETURNING id`,
          [`ref${i}_${Date.now()}@test.com`, `ref${i}_${Date.now()}`, 'hash']
        );
        await service.applyReferralCode(user!.id, code.code);
      }

      const page1 = await service.getUserReferrals(referrerId, 3, 0);
      const page2 = await service.getUserReferrals(referrerId, 3, 3);

      expect(page1.length).toBe(3);
      expect(page2.length).toBeGreaterThan(0);
    });
  });

  describe('updateReferralCode', () => {
    test('should update referral code settings', async () => {
      const code = await service.createReferralCode(referrerId);

      const updated = await service.updateReferralCode(referrerId, code.id, {
        max_uses: 100,
        signup_reward: 200,
        commission_percentage: 15,
      });

      expect(updated.max_uses).toBe(100);
      expect(Number(updated.signup_reward_points)).toBe(200);
      expect(Number(updated.commission_percentage)).toBe(15);
    });

    test('should throw error if code not found', async () => {
      const nonExistentUuid = '00000000-0000-0000-0000-000000000000';
      await expect(async () => {
        await service.updateReferralCode(referrerId, nonExistentUuid, {
          max_uses: 10,
        });
      }).toThrow('Referral code not found');
    });
  });

  describe('deactivateReferralCode', () => {
    test('should deactivate referral code', async () => {
      const code = await service.createReferralCode(referrerId);

      await service.deactivateReferralCode(referrerId, code.id);

      const updated = await service.getReferralCodeByCode(code.code);
      expect(updated?.is_active).toBe(false);
    });
  });
});
