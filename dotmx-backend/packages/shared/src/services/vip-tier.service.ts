/**
 * VIP Tier Service
 * Manages Binance-style VIP tier system for retail users
 * - Calculates 30-day rolling volume
 * - Updates tier status based on volume and token holdings
 * - Tracks volume snapshots for historical data
 * - Handles tier upgrades/downgrades with lock periods
 */

import type { 
  VIPTierLevel, 
  UserVIPStatus, 
  VIPVolumeSnapshot,
  VIPTierHistory,
  RetailVIPTier
} from '../types/accounts';
import { getVIPTierByVolume, VIP_TIER_CONFIGS } from '../types/accounts';
import type { PostgresDB } from '../db/postgres-client';

export class VIPTierService {
  private db: PostgresDB;

  constructor(db: PostgresDB) {
    this.db = db;
  }

  // ============================================================================
  // VOLUME TRACKING
  // ============================================================================

  /**
   * Record daily volume snapshot for VIP tier calculation
   */
  async recordDailyVolume(
    userId: string,
    dailyVolumeUsd: number,
    dailyTrades: number,
    breakdown: {
      spot?: number;
      futures?: number;
      options?: number;
    } = {}
  ): Promise<void> {
    const today = new Date().toISOString().split('T')[0];

    const query = `
      INSERT INTO vip_volume_snapshots (
        user_id, snapshot_date, daily_volume_usd, daily_trades,
        spot_volume_usd, futures_volume_usd, options_volume_usd
      ) VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (user_id, snapshot_date) 
      DO UPDATE SET
        daily_volume_usd = vip_volume_snapshots.daily_volume_usd + EXCLUDED.daily_volume_usd,
        daily_trades = vip_volume_snapshots.daily_trades + EXCLUDED.daily_trades,
        spot_volume_usd = vip_volume_snapshots.spot_volume_usd + EXCLUDED.spot_volume_usd,
        futures_volume_usd = vip_volume_snapshots.futures_volume_usd + EXCLUDED.futures_volume_usd,
        options_volume_usd = vip_volume_snapshots.options_volume_usd + EXCLUDED.options_volume_usd
    `;

    await this.db.execute(query, [
      userId,
      today,
      dailyVolumeUsd,
      dailyTrades,
      breakdown.spot || 0,
      breakdown.futures || 0,
      breakdown.options || 0
    ]);
  }

  /**
   * Calculate 30-day rolling volume for a user
   */
  async calculate30DayVolume(userId: string): Promise<{
    volume_30d_usd: number;
    daily_average: number;
    total_trades: number;
  }> {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const query = `
      SELECT 
        COALESCE(SUM(daily_volume_usd), 0) as total_volume,
        COALESCE(SUM(daily_trades), 0) as total_trades,
        COUNT(*) as days_with_volume
      FROM vip_volume_snapshots
      WHERE user_id = $1
        AND snapshot_date >= $2
    `;

    const result = await this.db.queryOne(query, [userId, thirtyDaysAgo.toISOString().split('T')[0]]) as {
      total_volume: number;
      total_trades: number;
      days_with_volume: number;
    };

    return {
      volume_30d_usd: result.total_volume,
      daily_average: result.days_with_volume > 0 ? result.total_volume / result.days_with_volume : 0,
      total_trades: result.total_trades,
    };
  }

  /**
   * Clean up old volume snapshots (keep 90 days for historical data)
   */
  async cleanupOldSnapshots(): Promise<number> {
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);

    const query = `
      DELETE FROM vip_volume_snapshots
      WHERE snapshot_date < $1
    `;

    const result = await this.db.query(query, [ninetyDaysAgo.toISOString().split('T')[0]]);
    return result.rowCount || 0;
  }

  // ============================================================================
  // VIP STATUS MANAGEMENT
  // ============================================================================

  /**
   * Initialize VIP status for a new retail user
   */
  async initializeVIPStatus(userId: string): Promise<UserVIPStatus> {
    const query = `
      INSERT INTO user_vip_status (
        user_id, current_tier, previous_tier,
        volume_30d_usd, effective_maker_fee, effective_taker_fee
      ) VALUES ($1, 0, 0, 0, 0.001, 0.001)
      RETURNING *
    `;

    const result = await this.db.queryOne(query, [userId]);
    return this.mapToUserVIPStatus(result);
  }

  /**
   * Get current VIP status for a user
   */
  async getVIPStatus(userId: string): Promise<UserVIPStatus | null> {
    const query = `
      SELECT * FROM user_vip_status
      WHERE user_id = $1
    `;

    const result = await this.db.queryOne(query, [userId]);
    return result ? this.mapToUserVIPStatus(result) : null;
  }

  /**
   * Update 30-day volume and recalculate tier
   */
  async updateVolumeAndTier(
    userId: string,
    tokenHolding: number = 0
  ): Promise<{
    oldTier: VIPTierLevel;
    newTier: VIPTierLevel;
    tierChanged: boolean;
    status: UserVIPStatus;
  }> {
    // Calculate current 30-day volume
    const volumeData = await this.calculate30DayVolume(userId);

    // Get current status
    let status = await this.getVIPStatus(userId);
    if (!status) {
      status = await this.initializeVIPStatus(userId);
    }

    const oldTier = status.current_tier;

    // Check if tier is locked
    const now = new Date();
    if (status.tier_lock_until && now < status.tier_lock_until) {
      // Tier is locked, only update volume
      await this.updateVolumeOnly(userId, volumeData.volume_30d_usd, tokenHolding);
      return {
        oldTier,
        newTier: oldTier,
        tierChanged: false,
        status,
      };
    }

    // Calculate new tier based on volume and token holdings
    const newTier = getVIPTierByVolume(volumeData.volume_30d_usd, tokenHolding);

    // Calculate next tier requirements
    const nextTierLevel = (newTier + 1) as VIPTierLevel;
    const nextTier = nextTierLevel <= 9 ? VIP_TIER_CONFIGS[nextTierLevel] : null;

    // Calculate effective fees with VIP discount
    const baseMakerFee = 0.001; // 0.1%
    const baseTakerFee = 0.001; // 0.1%
    const tierConfig = VIP_TIER_CONFIGS[newTier];
    const effectiveMakerFee = baseMakerFee - tierConfig.maker_fee_discount;
    const effectiveTakerFee = baseTakerFee - tierConfig.taker_fee_discount;

    // Update status
    const updateQuery = `
      UPDATE user_vip_status
      SET 
        previous_tier = current_tier,
        current_tier = $1,
        volume_30d_usd = $2,
        current_token_holding = $3,
        next_tier_volume_needed = $4,
        next_tier_tokens_needed = $5,
        tier_upgrade_eligible = $6,
        effective_maker_fee = $7,
        effective_taker_fee = $8,
        last_volume_calculation_at = CURRENT_TIMESTAMP,
        last_tier_check_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $9
    `;

    await this.db.execute(updateQuery, [
      newTier,
      volumeData.volume_30d_usd,
      tokenHolding,
      nextTier ? nextTier.min_30d_volume_usd : null,
      nextTier ? nextTier.min_token_holding : null,
      nextTier ? (volumeData.volume_30d_usd >= nextTier.min_30d_volume_usd && tokenHolding >= nextTier.min_token_holding) : false,
      effectiveMakerFee,
      effectiveTakerFee,
      userId
    ]);

    // Record tier change if tier changed
    const tierChanged = oldTier !== newTier;
    if (tierChanged) {
      await this.recordTierChange(userId, oldTier, newTier, 'volume_threshold', volumeData.volume_30d_usd, tokenHolding);

      // Update tier upgrade timestamp and apply lock period
      const lockDays = newTier > oldTier ? 7 : 0; // 7-day lock for upgrades
      const lockUntil = new Date();
      lockUntil.setDate(lockUntil.getDate() + lockDays);

      const lockQuery = `
        UPDATE user_vip_status
        SET 
          tier_upgraded_at = CASE WHEN $1 > $2 THEN CURRENT_TIMESTAMP ELSE tier_upgraded_at END,
          tier_downgraded_at = CASE WHEN $3 < $4 THEN CURRENT_TIMESTAMP ELSE tier_downgraded_at END,
          total_tier_upgrades = CASE WHEN $5 > $6 THEN total_tier_upgrades + 1 ELSE total_tier_upgrades END,
          highest_tier_achieved = CASE WHEN $7 > highest_tier_achieved THEN $8 ELSE highest_tier_achieved END,
          tier_lock_until = $9
        WHERE user_id = $10
      `;

      await this.db.execute(lockQuery, [
        newTier, oldTier,
        newTier, oldTier,
        newTier, oldTier,
        newTier, newTier,
        lockUntil.toISOString(),
        userId
      ]);
    }

    // Get updated status
    const updatedStatus = await this.getVIPStatus(userId);

    return {
      oldTier,
      newTier,
      tierChanged,
      status: updatedStatus!,
    };
  }

  /**
   * Update only volume without tier recalculation (for locked periods)
   */
  private async updateVolumeOnly(userId: string, volume30d: number, tokenHolding: number): Promise<void> {
    const query = `
      UPDATE user_vip_status
      SET 
        volume_30d_usd = $1,
        current_token_holding = $2,
        last_volume_calculation_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $3
    `;

    await this.db.execute(query, [volume30d, tokenHolding, userId]);
  }

  /**
   * Manually upgrade/downgrade user tier (admin override)
   */
  async manualTierChange(
    userId: string,
    newTier: VIPTierLevel,
    adminUserId: string,
    reason: string
  ): Promise<void> {
    const status = await this.getVIPStatus(userId);
    if (!status) {
      throw new Error('User VIP status not found');
    }

    const oldTier = status.current_tier;

    // Update tier
    const query = `
      UPDATE user_vip_status
      SET 
        previous_tier = current_tier,
        current_tier = $1,
        last_tier_check_at = CURRENT_TIMESTAMP,
        updated_at = CURRENT_TIMESTAMP
      WHERE user_id = $2
    `;

    await this.db.execute(query, [newTier, userId]);

    // Record tier change
    await this.recordTierChange(
      userId,
      oldTier,
      newTier,
      'manual',
      status.volume_30d_usd,
      status.current_token_holding,
      adminUserId,
      reason
    );
  }

  // ============================================================================
  // TIER HISTORY
  // ============================================================================

  /**
   * Record tier change in history
   */
  private async recordTierChange(
    userId: string,
    fromTier: VIPTierLevel,
    toTier: VIPTierLevel,
    triggerReason: string,
    volumeAtChange: number,
    tokenHoldingAtChange: number,
    adminUserId?: string,
    adminNotes?: string
  ): Promise<void> {
    // If triggerReason is 'manual', keep it as 'manual' change type
    const changeType = triggerReason === 'manual' 
      ? 'manual' 
      : toTier > fromTier ? 'upgrade' : toTier < fromTier ? 'downgrade' : 'unchanged';

    const query = `
      INSERT INTO vip_tier_history (
        user_id, from_tier, to_tier, change_type, trigger_reason,
        volume_at_change, token_holding_at_change, admin_user_id, admin_notes
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    `;

    await this.db.execute(query, [
      userId,
      fromTier,
      toTier,
      changeType,
      triggerReason,
      volumeAtChange,
      tokenHoldingAtChange,
      adminUserId || null,
      adminNotes || null
    ]);
  }

  /**
   * Get tier history for a user
   */
  async getTierHistory(userId: string, limit: number = 50): Promise<VIPTierHistory[]> {
    const query = `
      SELECT * FROM vip_tier_history
      WHERE user_id = $1
      ORDER BY effective_date DESC
      LIMIT $2
    `;

    const results = await this.db.queryAll(query, [userId, limit]);
    return results.map((row: any) => this.mapToVIPTierHistory(row));
  }

  // ============================================================================
  // BATCH OPERATIONS
  // ============================================================================

  /**
   * Update all users' VIP tiers (run daily via cron)
   */
  async updateAllUserTiers(): Promise<{
    total: number;
    upgraded: number;
    downgraded: number;
    unchanged: number;
  }> {
    const query = `
      SELECT user_id, current_token_holding 
      FROM user_vip_status
      WHERE tier_lock_until IS NULL OR tier_lock_until < CURRENT_TIMESTAMP
    `;

    const users = await this.db.queryAll(query, []) as Array<{ user_id: string; current_token_holding: number }>;

    let upgraded = 0;
    let downgraded = 0;
    let unchanged = 0;

    for (const user of users) {
      const result = await this.updateVolumeAndTier(user.user_id, user.current_token_holding);

      if (result.newTier > result.oldTier) {
        upgraded++;
      } else if (result.newTier < result.oldTier) {
        downgraded++;
      } else {
        unchanged++;
      }
    }

    return {
      total: users.length,
      upgraded,
      downgraded,
      unchanged,
    };
  }

  /**
   * Get VIP tier statistics
   */
  async getTierStatistics(): Promise<
    Array<{
      tier: VIPTierLevel;
      tier_name: string;
      user_count: number;
      total_volume_30d: number;
      avg_volume_per_user: number;
    }>
  > {
    const query = `
      SELECT 
        uvs.current_tier as tier,
        rvt.tier_name,
        COUNT(uvs.user_id) as user_count,
        SUM(uvs.volume_30d_usd) as total_volume_30d,
        AVG(uvs.volume_30d_usd) as avg_volume_per_user
      FROM user_vip_status uvs
      JOIN retail_vip_tiers rvt ON uvs.current_tier = rvt.tier_level
      GROUP BY uvs.current_tier, rvt.tier_name
      ORDER BY uvs.current_tier
    `;

    return await this.db.queryAll(query, []) as Array<{
      tier: VIPTierLevel;
      tier_name: string;
      user_count: number;
      total_volume_30d: number;
      avg_volume_per_user: number;
    }>;
  }

  /**
   * Get users eligible for tier upgrade
   */
  async getUpgradeEligibleUsers(): Promise<
    Array<{
      user_id: string;
      current_tier: VIPTierLevel;
      volume_30d_usd: number;
      next_tier: VIPTierLevel;
      volume_needed: number;
    }>
  > {
    const query = `
      SELECT 
        user_id,
        current_tier,
        volume_30d_usd,
        next_tier_volume_needed as volume_needed
      FROM user_vip_status
      WHERE tier_upgrade_eligible = true
        AND (tier_lock_until IS NULL OR tier_lock_until < CURRENT_TIMESTAMP)
    `;

    const results = await this.db.queryAll(query, []) as Array<{
      user_id: string;
      current_tier: VIPTierLevel;
      volume_30d_usd: number;
      volume_needed: number;
    }>;

    return results.map((row) => ({
      ...row,
      next_tier: (row.current_tier + 1) as VIPTierLevel,
    }));
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  private mapToUserVIPStatus(row: any): UserVIPStatus {
    return {
      id: row.id,
      user_id: row.user_id,
      current_tier: row.current_tier,
      previous_tier: row.previous_tier,
      volume_30d_usd: parseFloat(row.volume_30d_usd),
      volume_30d_btc: parseFloat(row.volume_30d_btc || 0),
      current_token_holding: parseFloat(row.current_token_holding || 0),
      next_tier_volume_needed: row.next_tier_volume_needed ? parseFloat(row.next_tier_volume_needed) : null,
      next_tier_tokens_needed: row.next_tier_tokens_needed ? parseFloat(row.next_tier_tokens_needed) : null,
      tier_upgrade_eligible: row.tier_upgrade_eligible,
      effective_maker_fee: parseFloat(row.effective_maker_fee),
      effective_taker_fee: parseFloat(row.effective_taker_fee),
      total_tier_upgrades: row.total_tier_upgrades,
      highest_tier_achieved: row.highest_tier_achieved,
      tier_upgraded_at: row.tier_upgraded_at ? new Date(row.tier_upgraded_at) : null,
      tier_downgraded_at: row.tier_downgraded_at ? new Date(row.tier_downgraded_at) : null,
      last_volume_calculation_at: new Date(row.last_volume_calculation_at),
      last_tier_check_at: new Date(row.last_tier_check_at),
      tier_lock_until: row.tier_lock_until ? new Date(row.tier_lock_until) : null,
      created_at: new Date(row.created_at),
      updated_at: new Date(row.updated_at),
    };
  }

  private mapToVIPTierHistory(row: any): VIPTierHistory {
    return {
      id: row.id,
      user_id: row.user_id,
      from_tier: row.from_tier,
      to_tier: row.to_tier,
      change_type: row.change_type,
      trigger_reason: row.trigger_reason,
      volume_at_change: parseFloat(row.volume_at_change),
      token_holding_at_change: parseFloat(row.token_holding_at_change),
      admin_user_id: row.admin_user_id,
      admin_notes: row.admin_notes,
      effective_date: new Date(row.effective_date),
      created_at: new Date(row.created_at),
    };
  }
}
