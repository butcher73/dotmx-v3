/**
 * Account Management Service Tests
 * 
 * Tests for user account type management, upgrades, and features.
 */

import { describe, test, expect, beforeAll, afterAll, beforeEach } from 'bun:test';
import { AccountManagementService } from '../../src/services/account-management.service';
import { AuthService, type AuthConfig } from '../../src/services/auth.service';
import { TestDatabase, ensureTestDatabase } from '../../src/test-db-helper';
import { PostgresDB } from '../../src/db/postgres-client';

describe('AccountManagementService', () => {
  let testDb: TestDatabase;
  let db: PostgresDB;
  let accountManagementService: AccountManagementService;
  let authService: AuthService;
  let testUserId: string;

  const testUserEmail = () => `account-mgmt-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;

  const testConfig: Partial<AuthConfig> = {
    jwt_secret: 'test-jwt-secret-key-minimum-32-chars',
    jwt_access_expiry: 900,
    jwt_refresh_expiry: 604800,
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_number: true,
    password_require_special: true,
    max_failed_login_attempts: 5,
    account_lock_duration: 1800,
  };

  beforeAll(async () => {
    await ensureTestDatabase();
    testDb = new TestDatabase();
    await testDb.connect();
    await testDb.setupDatabase();
    db = new PostgresDB(testDb.getClient());
    
    // Initialize services
    accountManagementService = new AccountManagementService(db);
    authService = new AuthService(db, testConfig);
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    // Create a fresh test user for each test
    const email = testUserEmail();
    const result = await authService.register({
      email,
      password: 'TestPass123!',
      username: `testuser_${Date.now()}`,
    });
    testUserId = result.user.id;
  });

  // ============================================================================
  // ACCOUNT TYPE UPGRADE TESTS
  // ============================================================================

  describe('Account Type Upgrades', () => {
    test('should upgrade user to market maker account', async () => {
      const user = await accountManagementService.upgradeAccountType(
        testUserId,
        'market_maker'
      );

      expect(user).toBeDefined();
      expect(user.account_type).toBe('market_maker');
      expect(user.is_market_maker).toBe(true);
    });

    test('should upgrade user to institutional account', async () => {
      const user = await accountManagementService.upgradeAccountType(
        testUserId,
        'institutional',
        { company_name: 'Test Corp', company_type: 'hedge_fund' }
      );

      expect(user).toBeDefined();
      expect(user.account_type).toBe('institutional');
      expect(user.is_institutional).toBe(true);
    });

    test('should upgrade user to VIP account', async () => {
      const user = await accountManagementService.upgradeAccountType(
        testUserId,
        'vip',
        { vip_tier: 'vip_2' }
      );

      expect(user).toBeDefined();
      expect(user.account_type).toBe('vip');
      expect(user.is_vip).toBe(true);
    });

    test('should upgrade user to affiliate account', async () => {
      const user = await accountManagementService.upgradeAccountType(
        testUserId,
        'affiliate',
        { payment_method: 'crypto', payment_currency: 'BTC' }
      );

      expect(user).toBeDefined();
      expect(user.account_type).toBe('affiliate');
      expect(user.is_affiliate).toBe(true);
    });

    test('should upgrade user to liquidity provider', async () => {
      const user = await accountManagementService.upgradeAccountType(
        testUserId,
        'liquidity_provider'
      );

      expect(user).toBeDefined();
      expect(user.account_type).toBe('liquidity_provider');
    });

    test('should upgrade user to API trader', async () => {
      const user = await accountManagementService.upgradeAccountType(
        testUserId,
        'api_trader'
      );

      expect(user).toBeDefined();
      expect(user.account_type).toBe('api_trader');
    });

    test('should throw error for non-existent user', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      await expect(
        accountManagementService.upgradeAccountType(fakeUserId, 'vip')
      ).rejects.toThrow('User not found');
    });
  });

  // ============================================================================
  // MARKET MAKER INITIALIZATION TESTS
  // ============================================================================

  describe('Market Maker Initialization', () => {
    test('should initialize market maker with tier 1', async () => {
      const stats = await accountManagementService.initializeMarketMaker(testUserId);

      expect(stats).toBeDefined();
      expect(stats.user_id).toBe(testUserId);
      expect(stats.current_mm_tier).toBe('tier_1');
    });

    test('should update existing market maker on re-initialization', async () => {
      // First init
      await accountManagementService.initializeMarketMaker(testUserId);
      
      // Second init should update
      const stats = await accountManagementService.initializeMarketMaker(testUserId);

      expect(stats).toBeDefined();
      expect(stats.current_mm_tier).toBe('tier_1');
    });
  });

  // ============================================================================
  // INSTITUTIONAL INITIALIZATION TESTS
  // ============================================================================

  describe('Institutional Account Initialization', () => {
    test('should initialize institutional account with company info', async () => {
      const account = await accountManagementService.initializeInstitutional(
        testUserId,
        { company_name: 'Big Fund LLC', company_type: 'hedge_fund' }
      );

      expect(account).toBeDefined();
      expect(account.company_name).toBe('Big Fund LLC');
      expect(account.company_type).toBe('hedge_fund');
      expect(account.dedicated_support).toBe(true);
      expect(account.otc_access).toBe(true);
    });

    test('should use default company info if not provided', async () => {
      const account = await accountManagementService.initializeInstitutional(testUserId);

      expect(account.company_name).toBe('Institutional Client');
      expect(account.company_type).toBe('other');
    });

    test('should have increased API rate limit', async () => {
      const account = await accountManagementService.initializeInstitutional(testUserId);

      expect(Number(account.api_rate_limit_multiplier)).toBe(10.0);
    });
  });

  // ============================================================================
  // VIP INITIALIZATION TESTS
  // ============================================================================

  describe('VIP Account Initialization', () => {
    test('should initialize VIP with default tier', async () => {
      const benefits = await accountManagementService.initializeVIP(testUserId);

      expect(benefits).toBeDefined();
      expect(benefits.vip_tier).toBe('vip_1');
      expect(benefits.priority_support).toBe(true);
      expect(benefits.instant_withdrawals).toBe(true);
    });

    test('should initialize VIP with specified tier', async () => {
      const benefits = await accountManagementService.initializeVIP(
        testUserId,
        { vip_tier: 'whale' }
      );

      expect(benefits.vip_tier).toBe('whale');
      expect(Number(benefits.points_multiplier)).toBe(3.0);
    });

    test('should have OTC trading enabled', async () => {
      const benefits = await accountManagementService.initializeVIP(testUserId);

      expect(benefits.otc_trading_enabled).toBe(true);
    });

    test('should have 30% fee discount', async () => {
      const benefits = await accountManagementService.initializeVIP(testUserId);

      expect(Number(benefits.fee_discount_percentage)).toBe(30);
    });
  });

  // ============================================================================
  // AFFILIATE INITIALIZATION TESTS
  // ============================================================================

  describe('Affiliate Account Initialization', () => {
    test('should initialize affiliate with unique code', async () => {
      const affiliate = await accountManagementService.initializeAffiliate(testUserId);

      expect(affiliate).toBeDefined();
      expect(affiliate.affiliate_code).toBeDefined();
      expect(affiliate.affiliate_code.length).toBeGreaterThan(0);
    });

    test('should start at bronze tier', async () => {
      const affiliate = await accountManagementService.initializeAffiliate(testUserId);

      expect(affiliate.affiliate_tier).toBe('bronze');
    });

    test('should have 10% base commission', async () => {
      const affiliate = await accountManagementService.initializeAffiliate(testUserId);

      expect(Number(affiliate.base_commission_percentage)).toBe(10.0);
    });

    test('should use custom payment method if specified', async () => {
      const affiliate = await accountManagementService.initializeAffiliate(
        testUserId,
        { payment_method: 'bank_transfer', payment_currency: 'USD' }
      );

      expect(affiliate.payment_method).toBe('bank_transfer');
      expect(affiliate.payment_currency).toBe('USD');
    });
  });

  // ============================================================================
  // LIQUIDITY PROVIDER TESTS
  // ============================================================================

  describe('Liquidity Provider Initialization', () => {
    test('should initialize LP with standard tier', async () => {
      const stats = await accountManagementService.initializeLiquidityProvider(testUserId);

      expect(stats).toBeDefined();
      expect(stats.lp_tier).toBe('standard');
    });
  });

  // ============================================================================
  // API TRADER TESTS
  // ============================================================================

  describe('API Trader Initialization', () => {
    test('should initialize with rate limits', async () => {
      const config = await accountManagementService.initializeAPITrader(testUserId);

      expect(config).toBeDefined();
      expect(config.requests_per_second).toBe(10);
      expect(config.requests_per_minute).toBe(600);
      expect(config.requests_per_hour).toBe(10000);
    });

    test('should have daily order limits', async () => {
      const config = await accountManagementService.initializeAPITrader(testUserId);

      expect(config.daily_order_limit).toBe(10000);
      expect(config.max_concurrent_orders).toBe(100);
    });

    test('should have websocket enabled', async () => {
      const config = await accountManagementService.initializeAPITrader(testUserId);

      expect(config.websocket_enabled).toBe(true);
    });
  });

  // ============================================================================
  // ACCOUNT STATS TESTS
  // ============================================================================

  describe('Get Account Stats', () => {
    test('should get market maker stats', async () => {
      await accountManagementService.upgradeAccountType(testUserId, 'market_maker');
      
      const stats = await accountManagementService.getAccountStats(testUserId, 'market_maker');

      expect(stats).toBeDefined();
      expect(stats.current_mm_tier).toBe('tier_1');
    });

    test('should get institutional stats', async () => {
      await accountManagementService.upgradeAccountType(
        testUserId,
        'institutional',
        { company_name: 'Test Inc' }
      );
      
      const stats = await accountManagementService.getAccountStats(testUserId, 'institutional');

      expect(stats).toBeDefined();
      expect(stats.company_name).toBe('Test Inc');
    });

    test('should get VIP benefits', async () => {
      await accountManagementService.upgradeAccountType(testUserId, 'vip');
      
      const stats = await accountManagementService.getAccountStats(testUserId, 'vip');

      expect(stats).toBeDefined();
      expect(stats.priority_support).toBe(true);
    });

    test('should return null for retail account type', async () => {
      const stats = await accountManagementService.getAccountStats(testUserId, 'retail');

      expect(stats).toBeNull();
    });
  });

  // ============================================================================
  // FEE DISCOUNT TESTS
  // ============================================================================

  describe('Fee Discount', () => {
    // NOTE: These tests reveal a bug in the service - ACCOUNT_TYPE_CONFIGS is not defined
    // The service imports the type but not the actual config constant
    test('should return 0 for retail users', async () => {
      const discount = await accountManagementService.getFeeDiscount(testUserId);

      expect(discount).toBe(0);
    });

    test('should return VIP discount after upgrade', async () => {
      await accountManagementService.upgradeAccountType(testUserId, 'vip');

      const discount = await accountManagementService.getFeeDiscount(testUserId);

      expect(discount).toBe(30);
    });

    test('should return 0 for non-existent user', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      
      const discount = await accountManagementService.getFeeDiscount(fakeUserId);

      expect(discount).toBe(0);
    });
  });

  // ============================================================================
  // FEATURE ACCESS TESTS
  // ============================================================================

  describe('Feature Access', () => {
    test('should deny feature access for non-existent user', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';
      
      const hasAccess = await accountManagementService.hasFeatureAccess(fakeUserId, 'api_trading');

      expect(hasAccess).toBe(false);
    });
  });

  // ============================================================================
  // UPDATE MARKET MAKER STATS TESTS
  // ============================================================================

  describe('Update Market Maker Stats', () => {
    test('should update market maker stats', async () => {
      await accountManagementService.upgradeAccountType(testUserId, 'market_maker');

      const updated = await accountManagementService.updateMarketMakerStats(testUserId, {
        current_mm_tier: 'tier_2',
        total_mm_volume_usd: 1000000,
      });

      expect(updated.current_mm_tier).toBe('tier_2');
      expect(Number(updated.total_mm_volume_usd)).toBe(1000000);
    });

    test('should throw error for non-existent market maker', async () => {
      const fakeUserId = '00000000-0000-0000-0000-000000000000';

      await expect(
        accountManagementService.updateMarketMakerStats(fakeUserId, {
          current_mm_tier: 'tier_2',
        })
      ).rejects.toThrow('Market maker stats not found');
    });
  });

  // ============================================================================
  // AFFILIATE COMMISSION TESTS
  // ============================================================================

  describe('Affiliate Commission Updates', () => {
    test('should update affiliate commission', async () => {
      await accountManagementService.upgradeAccountType(testUserId, 'affiliate');

      // Update commission
      await accountManagementService.updateAffiliateCommission(testUserId, 10000, 1000);

      // Verify the update
      const affiliate = await accountManagementService.getAccountStats(testUserId, 'affiliate');

      expect(Number(affiliate.total_referral_volume)).toBe(10000);
      expect(Number(affiliate.total_commission_earned)).toBe(1000);
      expect(Number(affiliate.pending_commission)).toBe(1000);
    });

    test('should accumulate multiple commissions', async () => {
      await accountManagementService.upgradeAccountType(testUserId, 'affiliate');

      // First commission
      await accountManagementService.updateAffiliateCommission(testUserId, 5000, 500);
      // Second commission
      await accountManagementService.updateAffiliateCommission(testUserId, 3000, 300);

      const affiliate = await accountManagementService.getAccountStats(testUserId, 'affiliate');

      expect(Number(affiliate.total_referral_volume)).toBe(8000);
      expect(Number(affiliate.total_commission_earned)).toBe(800);
    });
  });
});
