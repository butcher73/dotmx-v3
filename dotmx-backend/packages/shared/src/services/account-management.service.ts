// @ts-nocheck
/**
 * Account Management Service for All Stakeholders
 * Handles account type upgrades, features, and permissions
 */

import type { UserDatabaseService } from './user-database.service';
import type {
  AccountType,
  User,
  MarketMakerStats,
  InstitutionalAccount,
  VIPBenefits,
  AffiliateAccount,
  LiquidityProviderStats,
  APITraderConfig,
} from '../types/accounts';
import { ACCOUNT_TYPE_CONFIGS } from '../types/accounts';

export class AccountManagementService {
  private db: UserDatabaseService;

  constructor(db: UserDatabaseService) {
    this.db = db;
  }

  /**
   * Upgrade user account type
   */
  async upgradeAccountType(
    user_id: string,
    newAccountType: AccountType,
    metadata?: Record<string, any>
  ): Promise<User> {
    // Update user account type
    const user = await this.db.queryOne<User>(
      `UPDATE users
       SET account_type = $1,
           is_institutional = $2,
           is_market_maker = $3,
           is_vip = $4,
           is_affiliate = $5,
           updated_at = NOW()
       WHERE id = $6
       RETURNING *`,
      [
        newAccountType,
        newAccountType === 'institutional',
        newAccountType === 'market_maker',
        newAccountType === 'vip',
        newAccountType === 'affiliate',
        user_id,
      ]
    );

    if (!user) {
      throw new Error('User not found');
    }

    // Initialize account-specific tables
    await this.initializeAccountTables(user_id, newAccountType, metadata);

    // Update loyalty program
    await this.updateLoyaltyProgram(user_id, newAccountType);

    return user;
  }

  /**
   * Initialize account-specific tables
   */
  private async initializeAccountTables(
    user_id: string,
    accountType: AccountType,
    metadata?: Record<string, any>
  ): Promise<void> {
    switch (accountType) {
      case 'market_maker':
        await this.initializeMarketMaker(user_id);
        break;
      case 'institutional':
        await this.initializeInstitutional(user_id, metadata);
        break;
      case 'vip':
        await this.initializeVIP(user_id, metadata);
        break;
      case 'affiliate':
        await this.initializeAffiliate(user_id, metadata);
        break;
      case 'liquidity_provider':
        await this.initializeLiquidityProvider(user_id);
        break;
      case 'api_trader':
        await this.initializeAPITrader(user_id, metadata);
        break;
    }
  }

  /**
   * Initialize market maker account
   */
  async initializeMarketMaker(user_id: string): Promise<MarketMakerStats> {
    return await this.db.queryOne<MarketMakerStats>(
      `INSERT INTO market_maker_stats (user_id, current_mm_tier)
       VALUES ($1, 'tier_1')
       ON CONFLICT (user_id) DO UPDATE
       SET updated_at = NOW()
       RETURNING *`,
      [user_id]
    );
  }

  /**
   * Initialize institutional account
   */
  async initializeInstitutional(
    user_id: string,
    metadata?: Record<string, any>
  ): Promise<InstitutionalAccount> {
    return await this.db.queryOne<InstitutionalAccount>(
      `INSERT INTO institutional_accounts (
        user_id, company_name, company_type, dedicated_support,
        api_rate_limit_multiplier, otc_access
       )
       VALUES ($1, $2, $3, true, 10.0, true)
       ON CONFLICT (user_id) DO UPDATE
       SET updated_at = NOW()
       RETURNING *`,
      [user_id, metadata?.company_name || 'Institutional Client', metadata?.company_type || 'other']
    );
  }

  /**
   * Initialize VIP account
   */
  async initializeVIP(user_id: string, metadata?: Record<string, any>): Promise<VIPBenefits> {
    const vipTier = metadata?.vip_tier || 'vip_1';
    const pointsMultiplier = vipTier === 'whale' || vipTier === 'ultra' ? 3.0 : 2.0;

    return await this.db.queryOne<VIPBenefits>(
      `INSERT INTO vip_benefits (
        user_id, vip_tier, fee_discount_percentage, priority_support,
        points_multiplier, instant_withdrawals, otc_trading_enabled
       )
       VALUES ($1, $2, 30, true, $3, true, true)
       ON CONFLICT (user_id) DO UPDATE
       SET vip_tier = EXCLUDED.vip_tier,
           points_multiplier = EXCLUDED.points_multiplier,
           updated_at = NOW()
       RETURNING *`,
      [user_id, vipTier, pointsMultiplier]
    );
  }

  /**
   * Initialize affiliate account
   */
  async initializeAffiliate(
    user_id: string,
    metadata?: Record<string, any>
  ): Promise<AffiliateAccount> {
    // Generate unique affiliate code
    const affiliateCode = await this.generateAffiliateCode(user_id);

    return await this.db.queryOne<AffiliateAccount>(
      `INSERT INTO affiliate_accounts (
        user_id, affiliate_code, affiliate_tier, base_commission_percentage,
        payment_method, payment_currency, payment_schedule
       )
       VALUES ($1, $2, 'bronze', 10.0, $3, $4, 'monthly')
       ON CONFLICT (user_id) DO UPDATE
       SET updated_at = NOW()
       RETURNING *`,
      [
        user_id,
        affiliateCode,
        metadata?.payment_method || 'crypto',
        metadata?.payment_currency || 'USDT',
      ]
    );
  }

  /**
   * Initialize liquidity provider
   */
  async initializeLiquidityProvider(user_id: string): Promise<LiquidityProviderStats> {
    return await this.db.queryOne<LiquidityProviderStats>(
      `INSERT INTO liquidity_provider_stats (user_id, lp_tier)
       VALUES ($1, 'standard')
       ON CONFLICT (user_id) DO UPDATE
       SET updated_at = NOW()
       RETURNING *`,
      [user_id]
    );
  }

  /**
   * Initialize API trader
   */
  async initializeAPITrader(
    user_id: string,
    metadata?: Record<string, any>
  ): Promise<APITraderConfig> {
    return await this.db.queryOne<APITraderConfig>(
      `INSERT INTO api_trader_configs (
        user_id, requests_per_second, requests_per_minute, requests_per_hour,
        daily_order_limit, max_concurrent_orders, websocket_enabled
       )
       VALUES ($1, 10, 600, 10000, 10000, 100, true)
       ON CONFLICT (user_id) DO UPDATE
       SET updated_at = NOW()
       RETURNING *`,
      [user_id]
    );
  }

  /**
   * Update loyalty program based on account type
   */
  private async updateLoyaltyProgram(user_id: string, accountType: AccountType): Promise<void> {
    let loyaltyProgram = 'standard';
    let baseMultiplier = 1.0;
    let accountTypeMultiplier = 1.0;

    switch (accountType) {
      case 'market_maker':
        loyaltyProgram = 'market_maker';
        baseMultiplier = 2.0;
        accountTypeMultiplier = 2.0;
        break;
      case 'institutional':
        loyaltyProgram = 'institutional';
        baseMultiplier = 3.0;
        accountTypeMultiplier = 3.0;
        break;
      case 'vip':
        loyaltyProgram = 'vip';
        baseMultiplier = 2.5;
        accountTypeMultiplier = 2.5;
        break;
      case 'affiliate':
        loyaltyProgram = 'affiliate';
        baseMultiplier = 1.5;
        accountTypeMultiplier = 1.5;
        break;
      case 'api_trader':
        accountTypeMultiplier = 1.2;
        break;
    }

    await this.db.execute(
      `UPDATE loyalty_points
       SET loyalty_program = $1,
           multiplier = $2,
           market_maker_multiplier = CASE WHEN $3 = 'market_maker' THEN $4 ELSE market_maker_multiplier END,
           institutional_multiplier = CASE WHEN $3 = 'institutional' THEN $4 ELSE institutional_multiplier END,
           vip_multiplier = CASE WHEN $3 = 'vip' THEN $4 ELSE vip_multiplier END,
           affiliate_multiplier = CASE WHEN $3 = 'affiliate' THEN $4 ELSE affiliate_multiplier END,
           api_trader_multiplier = CASE WHEN $3 = 'api_trader' THEN $4 ELSE api_trader_multiplier END,
           updated_at = NOW()
       WHERE user_id = $5`,
      [loyaltyProgram, baseMultiplier, accountType, accountTypeMultiplier, user_id]
    );
  }

  /**
   * Generate unique affiliate code
   */
  private async generateAffiliateCode(user_id: string): Promise<string> {
    const username = await this.db.queryOne<{ username: string }>(
      'SELECT username FROM users WHERE id = $1',
      [user_id]
    );

    if (!username) {
      throw new Error('User not found');
    }

    // Generate code based on username + random suffix
    const base = username.username.toUpperCase().replace(/[^A-Z0-9]/g, '').substring(0, 6);
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    let code = `${base}${random}`;

    // Ensure uniqueness
    let attempt = 0;
    while (attempt < 10) {
      const existing = await this.db.queryOne(
        'SELECT id FROM affiliate_accounts WHERE affiliate_code = $1',
        [code]
      );

      if (!existing) break;

      // Try again with different random
      const newRandom = Math.random().toString(36).substring(2, 6).toUpperCase();
      code = `${base}${newRandom}`;
      attempt++;
    }

    return code;
  }

  /**
   * Get account-specific stats
   */
  async getAccountStats(user_id: string, accountType: AccountType): Promise<any> {
    switch (accountType) {
      case 'market_maker':
        return await this.db.queryOne(
          'SELECT * FROM market_maker_stats WHERE user_id = $1',
          [user_id]
        );
      case 'institutional':
        return await this.db.queryOne(
          'SELECT * FROM institutional_accounts WHERE user_id = $1',
          [user_id]
        );
      case 'vip':
        return await this.db.queryOne('SELECT * FROM vip_benefits WHERE user_id = $1', [user_id]);
      case 'affiliate':
        return await this.db.queryOne(
          'SELECT * FROM affiliate_accounts WHERE user_id = $1',
          [user_id]
        );
      case 'liquidity_provider':
        return await this.db.queryOne(
          'SELECT * FROM liquidity_provider_stats WHERE user_id = $1',
          [user_id]
        );
      case 'api_trader':
        return await this.db.queryOne(
          'SELECT * FROM api_trader_configs WHERE user_id = $1',
          [user_id]
        );
      default:
        return null;
    }
  }

  /**
   * Check if user has specific feature access
   */
  async hasFeatureAccess(user_id: string, feature: string): Promise<boolean> {
    const user = await this.db.queryOne<User>('SELECT * FROM users WHERE id = $1', [user_id]);

    if (!user) return false;

    const accountConfig = ACCOUNT_TYPE_CONFIGS[user.account_type];
    return accountConfig.features.includes(feature);
  }

  /**
   * Get fee discount for user
   */
  async getFeeDiscount(user_id: string): Promise<number> {
    const user = await this.db.queryOne<User>('SELECT * FROM users WHERE id = $1', [user_id]);

    if (!user) return 0;

    let discount = ACCOUNT_TYPE_CONFIGS[user.account_type].base_fee_discount;

    // Check for VIP additional discount
    if (user.is_vip) {
      const vipBenefits = await this.db.queryOne<VIPBenefits>(
        'SELECT fee_discount_percentage FROM vip_benefits WHERE user_id = $1',
        [user_id]
      );
      if (vipBenefits) {
        discount = Math.max(discount, vipBenefits.fee_discount_percentage);
      }
    }

    return discount;
  }

  /**
   * Update market maker stats
   */
  async updateMarketMakerStats(
    user_id: string,
    stats: Partial<MarketMakerStats>
  ): Promise<MarketMakerStats> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    Object.entries(stats).forEach(([key, value]) => {
      if (value !== undefined) {
        fields.push(`${key} = $${paramIndex++}`);
        values.push(value);
      }
    });

    fields.push('updated_at = NOW()');
    values.push(user_id);

    const result = await this.db.queryOne<MarketMakerStats>(
      `UPDATE market_maker_stats
       SET ${fields.join(', ')}
       WHERE user_id = $${paramIndex}
       RETURNING *`,
      values
    );

    if (!result) {
      throw new Error('Market maker stats not found');
    }

    return result;
  }

  /**
   * Update affiliate commission
   */
  async updateAffiliateCommission(
    user_id: string,
    volume: number,
    commission: number
  ): Promise<void> {
    await this.db.execute(
      `UPDATE affiliate_accounts
       SET total_referral_volume = total_referral_volume + $1,
           total_commission_earned = total_commission_earned + $2,
           pending_commission = pending_commission + $2,
           current_month_volume = current_month_volume + $1,
           current_month_commission = current_month_commission + $2,
           updated_at = NOW()
       WHERE user_id = $3`,
      [volume, commission, user_id]
    );
  }
}
