// @ts-nocheck
// ============================================================================
// FEE CALCULATION SERVICE
// ============================================================================
// Production-ready fee calculation service with VIP tiers and DMX discounts
// Binance-style fee structure
// ============================================================================

import type { PostgresDB } from '../db/postgres-client';
import type {
  FeeTier,
  FeeTierLevel,
  DMXFeeDiscountConfig,
  UserFeeTier,
  FeeCalculationInput,
  FeeCalculationResult,
  TradingFeeCollected,
  FeeTierChangeHistory,
  TierCheckResult,
  FeeStatistics,
  DMXDiscountEligibility,
  UserCurrentFeesView,
} from '../types/fees';

export class FeeCalculationService {
  private db: PostgresDB;
  private feeTierCache: Map<FeeTierLevel, FeeTier> = new Map();
  private dmxConfigCache: DMXFeeDiscountConfig | null = null;
  private cacheExpiry: number = 0;
  private readonly CACHE_TTL_MS = 60000; // 1 minute

  constructor(database: PostgresDB) {
    this.db = database;
  }

  // ============================================================================
  // FEE CALCULATION (Core)
  // ============================================================================

  /**
   * Calculate trading fee for a trade
   * @param input Fee calculation parameters
   * @returns Complete fee breakdown with all discounts
   */
  async calculateTradingFee(input: FeeCalculationInput): Promise<FeeCalculationResult> {
    // Get fee tier config
    const feeTier = await this.getFeeTier(input.fee_tier_level);
    if (!feeTier) {
      throw new Error(`Invalid fee tier: ${input.fee_tier_level}`);
    }

    // Get DMX discount config
    const dmxConfig = await this.getDMXDiscountConfig();

    // Determine base fee rate
    const baseFeeRate = input.trade_side === 'maker'
      ? feeTier.maker_fee_rate
      : feeTier.taker_fee_rate;

    // Get VIP discount
    const vipDiscount = input.trade_side === 'maker'
      ? feeTier.maker_fee_discount
      : feeTier.taker_fee_discount;

    // Calculate base fee
    const baseFeeUSD = input.trade_value_usd * baseFeeRate;

    // Apply VIP discount first
    const vipDiscountUSD = input.trade_value_usd * vipDiscount;
    const feeAfterVIP = baseFeeUSD - vipDiscountUSD;

    // Apply DMX discount if enabled and user wants to pay with DMX
    let dmxDiscountUSD = 0;
    let dmxDiscountRate = 0;
    let finalFeeUSD = feeAfterVIP;
    let feePaidInDMX = false;
    let dmxAmount: number | undefined;
    let dmxUSDPrice: number | undefined;

    if (input.pay_with_dmx && dmxConfig && dmxConfig.is_enabled && input.dmx_balance > 0) {
      // Check if DMX discount can be applied
      const eligibility = await this.checkDMXDiscountEligibility(input.dmx_balance, dmxConfig);

      if (eligibility.is_eligible) {
        dmxDiscountRate = dmxConfig.discount_percentage;
        dmxDiscountUSD = feeAfterVIP * dmxDiscountRate;

        // Apply discount caps if configured
        if (dmxConfig.max_discount_per_trade_usd) {
          dmxDiscountUSD = Math.min(dmxDiscountUSD, dmxConfig.max_discount_per_trade_usd);
        }

        // Apply daily cap if configured
        if (dmxConfig.max_discount_per_day_usd) {
          const dailyUsed = await this.getDailyDMXDiscountUsage(input.user_id);
          const remaining = dmxConfig.max_discount_per_day_usd - dailyUsed;
          dmxDiscountUSD = Math.min(dmxDiscountUSD, Math.max(0, remaining));
        }

        finalFeeUSD = feeAfterVIP - dmxDiscountUSD;
        feePaidInDMX = true;

        // Calculate DMX amount if price provided
        if (input.dmx_usd_price && input.dmx_usd_price > 0) {
          dmxAmount = finalFeeUSD / input.dmx_usd_price;
          dmxUSDPrice = input.dmx_usd_price;
        }
      }
    }

    // Ensure non-negative
    finalFeeUSD = Math.max(0, finalFeeUSD);

    // Calculate effective fee rate
    const effectiveFeeRate = input.trade_value_usd > 0
      ? finalFeeUSD / input.trade_value_usd
      : 0;

    // Calculate total discount
    const totalDiscountUSD = baseFeeUSD - finalFeeUSD;
    const discountPercentage = baseFeeUSD > 0
      ? (totalDiscountUSD / baseFeeUSD) * 100
      : 0;

    return {
      // Fee amounts
      base_fee_usd: baseFeeUSD,
      vip_discount_usd: vipDiscountUSD,
      dmx_discount_usd: dmxDiscountUSD,
      final_fee_usd: finalFeeUSD,

      // Fee rates
      base_fee_rate: baseFeeRate,
      vip_fee_discount: vipDiscount,
      dmx_fee_discount_rate: dmxDiscountRate,
      effective_fee_rate: effectiveFeeRate,

      // DMX payment
      fee_paid_in_dmx: feePaidInDMX,
      dmx_amount: dmxAmount,
      dmx_usd_price: dmxUSDPrice,

      // Savings
      total_discount_usd: totalDiscountUSD,
      discount_percentage: discountPercentage,

      // Breakdown
      breakdown: {
        original_fee: baseFeeUSD,
        after_vip_discount: feeAfterVIP,
        after_dmx_discount: finalFeeUSD,
        final_amount: finalFeeUSD,
      },
    };
  }

  /**
   * Record fee collection for a trade
   */
  async recordFeeCollection(
    tradeId: string,
    orderId: string,
    userId: string,
    symbol: string,
    tradeSide: 'maker' | 'taker',
    tradePrice: number,
    tradeQuantity: number,
    feeResult: FeeCalculationResult,
    feeTierLevel: FeeTierLevel
  ): Promise<string> {
    const tradeValueUSD = tradePrice * tradeQuantity;

    const query = `
      INSERT INTO trading_fees_collected (
        trade_id, order_id, user_id, symbol,
        fee_tier_level, trade_side, trade_price, trade_quantity, trade_value_usd,
        base_fee_rate, vip_fee_discount, dmx_fee_discount, effective_fee_rate,
        fee_amount_usd, fee_currency, fee_paid_in_dmx, dmx_amount, dmx_usd_price,
        vip_discount_usd, dmx_discount_usd, total_discount_usd,
        settlement_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)
      RETURNING id
    `;

    const result = await this.db.queryOne<{ id: string }>(query, [
      tradeId,
      orderId,
      userId,
      symbol,
      feeTierLevel,
      tradeSide,
      tradePrice,
      tradeQuantity,
      tradeValueUSD,
      feeResult.base_fee_rate,
      feeResult.vip_fee_discount,
      feeResult.dmx_fee_discount_rate,
      feeResult.effective_fee_rate,
      feeResult.final_fee_usd,
      'USD',
      feeResult.fee_paid_in_dmx,
      feeResult.dmx_amount || null,
      feeResult.dmx_usd_price || null,
      feeResult.vip_discount_usd,
      feeResult.dmx_discount_usd,
      feeResult.total_discount_usd,
      'pending'
    ]);

    if (!result?.id) {
      throw new Error('Failed to record fee collection');
    }

    // Update user fee tier statistics
    await this.updateUserFeeStats(userId, feeResult);

    return result.id;
  }

  // ============================================================================
  // FEE TIER MANAGEMENT
  // ============================================================================

  /**
   * Get fee tier configuration
   */
  async getFeeTier(tierLevel: FeeTierLevel): Promise<FeeTier | null> {
    // Check cache
    if (Date.now() < this.cacheExpiry && this.feeTierCache.has(tierLevel)) {
      return this.feeTierCache.get(tierLevel) || null;
    }

    const query = `SELECT * FROM fee_tiers WHERE tier_level = $1 AND is_active = true`;
    const result = await this.db.queryOne<FeeTier>(query, [tierLevel]);

    if (result) {
      this.feeTierCache.set(tierLevel, result);
    }

    return result || null;
  }

  /**
   * Get all fee tiers
   */
  async getAllFeeTiers(): Promise<FeeTier[]> {
    const query = `
      SELECT * FROM fee_tiers
      WHERE is_active = true
      ORDER BY tier_level ASC
    `;
    return await this.db.queryAll<FeeTier>(query, []);
  }

  /**
   * Determine fee tier by volume and DMX holdings
   */
  async calculateFeeTier(volume30dUSD: number, dmxBalance: number): Promise<FeeTierLevel> {
    const query = `
      SELECT tier_level
      FROM fee_tiers
      WHERE is_active = true
        AND $1 >= min_30d_volume_usd
        AND $2 >= min_dmx_holding
      ORDER BY tier_level DESC
      LIMIT 1
    `;

    const result = await this.db.queryOne<{ tier_level: FeeTierLevel }>(query, [volume30dUSD, dmxBalance]);

    return result?.tier_level ?? 0;
  }

  /**
   * Get user fee tier status
   */
  async getUserFeeTier(userId: string): Promise<UserFeeTier | null> {
    const query = `SELECT * FROM user_fee_tier WHERE user_id = $1`;
    return await this.db.queryOne<UserFeeTier>(query, [userId]) || null;
  }

  /**
   * Initialize user fee tier (for new users)
   */
  async initializeUserFeeTier(userId: string): Promise<UserFeeTier> {
    const query = `
      INSERT INTO user_fee_tier (
        user_id, current_tier, volume_30d_usd, current_dmx_balance,
        effective_maker_fee, effective_taker_fee
      ) VALUES ($1, 0, 0, 0, 0.001000, 0.001000)
      ON CONFLICT (user_id) DO NOTHING
      RETURNING *
    `;

    const result = await this.db.queryOne<UserFeeTier>(query, [userId]);

    if (!result) {
      // Already exists, fetch it
      return (await this.getUserFeeTier(userId))!;
    }

    return result;
  }

  /**
   * Update user volume and check for tier changes
   */
  async updateUserVolumeAndCheckTier(
    userId: string,
    volume30dUSD: number,
    dmxBalance: number
  ): Promise<TierCheckResult> {
    // Get current tier
    let userTier = await this.getUserFeeTier(userId);
    if (!userTier) {
      userTier = await this.initializeUserFeeTier(userId);
    }

    // Calculate what tier they should be at
    const calculatedTier = await this.calculateFeeTier(volume30dUSD, dmxBalance);

    // Check if tier is locked. After any tier change, all changes are blocked
    // for 7 days. This prevents chain-upgrade exploitation where a user would
    // downgrade then immediately re-upgrade within the lock window.
    const isLocked = userTier.tier_locked_until && userTier.tier_locked_until > new Date();

    // Determine if tier should change
    const shouldChange = !isLocked && calculatedTier !== userTier.current_tier;
    const changeType = shouldChange
      ? (calculatedTier > userTier.current_tier ? 'upgrade' : 'downgrade')
      : undefined;

    // Calculate next tier requirements
    const allTiers = await this.getAllFeeTiers();
    const nextTier = allTiers.find(t => t.tier_level > userTier!.current_tier);
    let nextTierRequirements;

    if (nextTier) {
      const volumeProgress = nextTier.min_30d_volume_usd > 0
        ? (volume30dUSD / nextTier.min_30d_volume_usd) * 100
        : 100;
      const dmxProgress = nextTier.min_dmx_holding > 0
        ? (dmxBalance / nextTier.min_dmx_holding) * 100
        : 100;

      nextTierRequirements = {
        tier_level: nextTier.tier_level as FeeTierLevel,
        volume_needed: Math.max(0, nextTier.min_30d_volume_usd - volume30dUSD),
        dmx_needed: Math.max(0, nextTier.min_dmx_holding - dmxBalance),
        volume_progress_pct: Math.min(100, volumeProgress),
        dmx_progress_pct: Math.min(100, dmxProgress),
      };
    }

    // Update volume and DMX balance
    await this.updateUserVolume(userId, volume30dUSD, dmxBalance, nextTierRequirements);

    // If tier should change, process the change
    if (shouldChange && changeType) {
      await this.changeTier(userId, calculatedTier, changeType, 'volume_update', volume30dUSD, dmxBalance);
    }

    return {
      current_tier: shouldChange ? calculatedTier : userTier.current_tier,
      calculated_tier: calculatedTier,
      should_change: shouldChange,
      change_type: changeType,
      is_locked: isLocked,
      locked_until: userTier.tier_locked_until,
      next_tier_requirements: nextTierRequirements,
    };
  }

  /**
   * Change user tier
   */
  private async changeTier(
    userId: string,
    newTier: FeeTierLevel,
    changeType: 'upgrade' | 'downgrade',
    reason: string,
    volume30dUSD: number,
    dmxBalance: number
  ): Promise<void> {
    const userTier = await this.getUserFeeTier(userId);
    if (!userTier) {
      throw new Error(`User fee tier not found: ${userId}`);
    }

    const newFeeTier = await this.getFeeTier(newTier);
    if (!newFeeTier) {
      throw new Error(`Fee tier not found: ${newTier}`);
    }

    // Calculate new effective fees
    const dmxConfig = await this.getDMXDiscountConfig();
    const effectiveMakerFee = newFeeTier.effective_maker_fee;
    const effectiveTakerFee = newFeeTier.effective_taker_fee;

    let effectiveMakerFeeWithDMX = effectiveMakerFee;
    let effectiveTakerFeeWithDMX = effectiveTakerFee;

    if (dmxConfig && dmxConfig.is_enabled) {
      effectiveMakerFeeWithDMX = effectiveMakerFee * (1 - dmxConfig.discount_percentage);
      effectiveTakerFeeWithDMX = effectiveTakerFee * (1 - dmxConfig.discount_percentage);
    }

    // Set lock period for any tier change (7 days).
    // Both upgrades and downgrades are locked to prevent chain-upgrade
    // exploitation (downgrade → immediately upgrade within same window).
    const tierLockedUntil = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    // Update user tier
    const updateQuery = `
      UPDATE user_fee_tier
      SET
        previous_tier = current_tier,
        current_tier = $1,
        effective_maker_fee = $2,
        effective_taker_fee = $3,
        effective_maker_fee_with_dmx = $4,
        effective_taker_fee_with_dmx = $5,
        last_tier_upgrade = CASE WHEN $6 = 'upgrade' THEN CURRENT_TIMESTAMP ELSE last_tier_upgrade END,
        last_tier_downgrade = CASE WHEN $7 = 'downgrade' THEN CURRENT_TIMESTAMP ELSE last_tier_downgrade END,
        tier_locked_until = $8,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $9
    `;

    await this.db.execute(updateQuery, [
      newTier,
      effectiveMakerFee,
      effectiveTakerFee,
      effectiveMakerFeeWithDMX,
      effectiveTakerFeeWithDMX,
      changeType,
      changeType,
      tierLockedUntil,
      userId
    ]);

    // Record tier change in history
    await this.recordTierChange(
      userId,
      userTier.current_tier,
      newTier,
      changeType,
      reason,
      volume30dUSD,
      dmxBalance,
      userTier.effective_maker_fee,
      effectiveMakerFee,
      userTier.effective_taker_fee,
      effectiveTakerFee
    );
  }

  /**
   * Record tier change in history
   */
  private async recordTierChange(
    userId: string,
    fromTier: FeeTierLevel,
    toTier: FeeTierLevel,
    changeType: 'upgrade' | 'downgrade' | 'manual',
    reason: string,
    volume30dUSD: number,
    dmxBalance: number,
    oldMakerFee: number,
    newMakerFee: number,
    oldTakerFee: number,
    newTakerFee: number,
    changedBy?: string,
    adminNotes?: string
  ): Promise<string> {
    const query = `
      INSERT INTO fee_tier_change_history (
        user_id, from_tier, to_tier, change_type, reason,
        volume_30d_usd, dmx_balance,
        old_maker_fee, new_maker_fee, old_taker_fee, new_taker_fee,
        changed_by, admin_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id
    `;

    const result = await this.db.queryOne<{ id: string }>(query, [
      userId, fromTier, toTier, changeType, reason,
      volume30dUSD, dmxBalance,
      oldMakerFee, newMakerFee, oldTakerFee, newTakerFee,
      changedBy || null, adminNotes || null
    ]);

    return result?.id || '';
  }

  // ============================================================================
  // DMX DISCOUNT
  // ============================================================================

  /**
   * Get DMX discount configuration
   */
  async getDMXDiscountConfig(): Promise<DMXFeeDiscountConfig | null> {
    // Check cache
    if (Date.now() < this.cacheExpiry && this.dmxConfigCache) {
      return this.dmxConfigCache;
    }

    const query = `
      SELECT * FROM dmx_fee_discount_config
      WHERE is_enabled = true
        AND (effective_until IS NULL OR effective_until > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC
      LIMIT 1
    `;

    const result = await this.db.queryOne<DMXFeeDiscountConfig>(query, []);

    if (result) {
      this.dmxConfigCache = result;
      this.cacheExpiry = Date.now() + this.CACHE_TTL_MS;
    }

    return result || null;
  }

  /**
   * Check if user is eligible for DMX discount
   */
  async checkDMXDiscountEligibility(
    dmxBalance: number,
    config?: DMXFeeDiscountConfig
  ): Promise<DMXDiscountEligibility> {
    const dmxConfig = config || await this.getDMXDiscountConfig();

    if (!dmxConfig) {
      return {
        is_eligible: false,
        has_sufficient_balance: false,
        discount_percentage: 0,
        min_balance_required: 0,
        current_balance: dmxBalance,
        is_enabled: false,
        reason: 'DMX discount not configured',
      };
    }

    if (!dmxConfig.is_enabled) {
      return {
        is_eligible: false,
        has_sufficient_balance: dmxBalance >= dmxConfig.min_dmx_balance,
        discount_percentage: dmxConfig.discount_percentage,
        min_balance_required: dmxConfig.min_dmx_balance,
        current_balance: dmxBalance,
        is_enabled: false,
        reason: 'DMX discount is disabled',
      };
    }

    const hasSufficientBalance = dmxBalance >= dmxConfig.min_dmx_balance;

    return {
      is_eligible: hasSufficientBalance,
      has_sufficient_balance: hasSufficientBalance,
      discount_percentage: dmxConfig.discount_percentage,
      min_balance_required: dmxConfig.min_dmx_balance,
      current_balance: dmxBalance,
      is_enabled: true,
      reason: hasSufficientBalance ? 'Eligible' : 'Insufficient DMX balance',
    };
  }

  /**
   * Toggle user DMX payment preference
   */
  async setDMXPaymentPreference(userId: string, enabled: boolean): Promise<void> {
    const query = `
      UPDATE user_fee_tier
      SET pay_fees_with_dmx = $1, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
    `;
    await this.db.execute(query, [enabled, userId]);
  }

  // ============================================================================
  // HELPER METHODS
  // ============================================================================

  /**
   * Get total DMX discount used by a user today (for daily cap enforcement)
   */
  private async getDailyDMXDiscountUsage(userId: string): Promise<number> {
    const result = await this.db.queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(dmx_discount_usd), 0) as total
       FROM trading_fees_collected
       WHERE user_id = $1
         AND collected_at >= CURRENT_DATE
         AND settlement_status = 'settled'`,
      [userId]
    );
    return parseFloat(result?.total || '0');
  }

  /**
   * Update user volume
   */
  private async updateUserVolume(
    userId: string,
    volume30dUSD: number,
    dmxBalance: number,
    nextTierReqs?: any
  ): Promise<void> {
    const query = `
      UPDATE user_fee_tier
      SET
        volume_30d_usd = $1,
        current_dmx_balance = $2,
        next_tier_level = $3,
        next_tier_volume_needed = $4,
        next_tier_dmx_needed = $5,
        tier_upgrade_eligible = $6,
        last_volume_update = CURRENT_TIMESTAMP,
        dmx_balance_last_updated = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $7
    `;

    await this.db.execute(query, [
      volume30dUSD,
      dmxBalance,
      nextTierReqs?.tier_level || null,
      nextTierReqs?.volume_needed || null,
      nextTierReqs?.dmx_needed || null,
      nextTierReqs ? true : false,
      userId
    ]);
  }

  /**
   * Update user fee statistics
   */
  private async updateUserFeeStats(userId: string, feeResult: FeeCalculationResult): Promise<void> {
    const query = `
      UPDATE user_fee_tier
      SET
        total_fees_paid_usd = total_fees_paid_usd + $1,
        total_fees_paid_dmx = total_fees_paid_dmx + $2,
        total_dmx_discount_received_usd = total_dmx_discount_received_usd + $3,
        total_vip_discount_received_usd = total_vip_discount_received_usd + $4,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $5
    `;

    await this.db.execute(query, [
      feeResult.final_fee_usd,
      feeResult.dmx_amount || 0,
      feeResult.dmx_discount_usd,
      feeResult.vip_discount_usd,
      userId
    ]);
  }

  /**
   * Get user current fees view
   */
  async getUserCurrentFeesView(userId: string): Promise<UserCurrentFeesView | null> {
    const query = `SELECT * FROM v_user_current_fees WHERE user_id = $1`;
    return await this.db.queryOne<UserCurrentFeesView>(query, [userId]) || null;
  }

  /**
   * Get fee statistics for user
   */
  async getUserFeeStatistics(
    userId: string,
    startDate: Date,
    endDate: Date
  ): Promise<FeeStatistics> {
    const query = `
      SELECT
        $1 as user_id,
        $2 as period_start,
        $3 as period_end,
        COALESCE(SUM(trade_value_usd), 0) as total_volume_usd,
        COUNT(*) as total_trades,
        SUM(CASE WHEN trade_side = 'maker' THEN 1 ELSE 0 END) as maker_trades,
        SUM(CASE WHEN trade_side = 'taker' THEN 1 ELSE 0 END) as taker_trades,
        COALESCE(SUM(fee_amount_usd), 0) as total_fees_paid_usd,
        COALESCE(SUM(CASE WHEN fee_paid_in_dmx THEN dmx_amount ELSE 0 END), 0) as total_fees_paid_dmx,
        COALESCE(SUM(CASE WHEN trade_side = 'maker' THEN fee_amount_usd ELSE 0 END), 0) as maker_fees_paid_usd,
        COALESCE(SUM(CASE WHEN trade_side = 'taker' THEN fee_amount_usd ELSE 0 END), 0) as taker_fees_paid_usd,
        COALESCE(SUM(vip_discount_usd), 0) as total_vip_discount_usd,
        COALESCE(SUM(dmx_discount_usd), 0) as total_dmx_discount_usd,
        COALESCE(SUM(total_discount_usd), 0) as total_discount_usd,
        COALESCE(AVG(CASE WHEN trade_side = 'maker' THEN effective_fee_rate END), 0) as avg_maker_fee_rate,
        COALESCE(AVG(CASE WHEN trade_side = 'taker' THEN effective_fee_rate END), 0) as avg_taker_fee_rate,
        COALESCE(AVG(effective_fee_rate), 0) as avg_effective_fee_rate
      FROM trading_fees_collected
      WHERE user_id = $4
        AND collected_at BETWEEN $5 AND $6
        AND settlement_status = 'settled'
    `;

    const result = await this.db.queryOne<any>(query, [
      userId,
      startDate.toISOString(),
      endDate.toISOString(),
      userId,
      startDate.toISOString(),
      endDate.toISOString()
    ]);

    if (!result) {
      throw new Error('Failed to get fee statistics');
    }

    const totalFeesWithoutDiscount = result.total_fees_paid_usd + result.total_discount_usd;
    const savingsPercentage = totalFeesWithoutDiscount > 0
      ? (result.total_discount_usd / totalFeesWithoutDiscount) * 100
      : 0;

    return {
      ...result,
      period_start: startDate,
      period_end: endDate,
      total_savings_usd: result.total_discount_usd,
      savings_percentage: savingsPercentage,
    };
  }

  /**
   * Clear cache (for testing or manual refresh)
   */
  clearCache(): void {
    this.feeTierCache.clear();
    this.dmxConfigCache = null;
    this.cacheExpiry = 0;
  }
}
