/**
 * Loyalty Points Service
 * Manages points earning, spending, and multiplier calculation
 */

import type { DatabaseService } from './database';

export interface LoyaltyPoints {
  id: string;
  user_id: string;
  balance: number;
  lifetime_earned: number;
  lifetime_spent: number;
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond';
  multiplier: number;
  daily_profit_multiplier: number;
  referral_multiplier: number;
  last_tier_update: Date;
  created_at: Date;
  updated_at: Date;
}

export interface PointsTransaction {
  id: string;
  user_id: string;
  type: 'earn' | 'spend' | 'bonus' | 'referral' | 'admin_adjust';
  amount: number;
  balance_after: number;
  source: string;
  description: string;
  metadata: Record<string, any>;
  created_at: Date;
}

export interface TradingVolume {
  user_id: string;
  date: Date;
  total_volume_usd: number;
  buy_volume_usd: number;
  sell_volume_usd: number;
  trade_count: number;
}

export interface TradingProfit {
  user_id: string;
  date: Date;
  realized_pnl_usd: number;
  unrealized_pnl_usd: number;
  total_pnl_usd: number;
  profit_percentage: number;
  starting_balance_usd: number;
  ending_balance_usd: number;
  win_rate: number;
  profit_factor: number;
}

export interface PointsConfig {
  base_points_per_usd_volume: number; // Default: 1 point per $100 volume
  min_volume_for_points: number; // Minimum volume to earn points
  max_daily_points: number; // Maximum points per day
  tier_thresholds: {
    bronze: number;
    silver: number;
    gold: number;
    platinum: number;
    diamond: number;
  };
}

export class LoyaltyPointsService {
  private db: DatabaseService;
  private config: PointsConfig;

  constructor(db: DatabaseService, config?: Partial<PointsConfig>) {
    this.db = db;
    this.config = {
      base_points_per_usd_volume: config?.base_points_per_usd_volume || 0.01, // 1 point per $100
      min_volume_for_points: config?.min_volume_for_points || 10, // $10 minimum
      max_daily_points: config?.max_daily_points || 100000, // 100k points max per day
      tier_thresholds: config?.tier_thresholds || {
        bronze: 0,
        silver: 10000,
        gold: 50000,
        platinum: 200000,
        diamond: 1000000,
      },
    };
  }

  /**
   * Get user's loyalty points
   */
  async getUserPoints(user_id: string): Promise<LoyaltyPoints | null> {
    return await this.db.queryOne<LoyaltyPoints>(
      'SELECT * FROM loyalty_points WHERE user_id = $1',
      [user_id]
    );
  }

  /**
   * Award points for trading volume
   */
  async awardPointsForVolume(
    user_id: string,
    volume_usd: number,
    metadata: Record<string, any> = {}
  ): Promise<PointsTransaction | null> {
    if (volume_usd < this.config.min_volume_for_points) {
      return null;
    }

    // Calculate base points
    const basePoints = Math.floor(volume_usd * this.config.base_points_per_usd_volume);
    
    if (basePoints <= 0) {
      return null;
    }

    // Cap at max daily points
    const points = Math.min(basePoints, this.config.max_daily_points);

    // Recalculate multiplier before awarding
    await this.recalculateMultiplier(user_id);

    // Award points (multiplier will be applied in the database function)
    const transactionId = await this.db.queryOne<{ award_loyalty_points: string }>(
      `SELECT award_loyalty_points($1, 'earn', $2, 'trading_volume', $3, $4) as award_loyalty_points`,
      [user_id, points, `Trading volume: $${volume_usd.toFixed(2)}`, JSON.stringify(metadata)]
    );

    if (!transactionId) {
      return null;
    }

    // Get transaction details
    return await this.db.queryOne<PointsTransaction>(
      'SELECT * FROM points_transactions WHERE id = $1',
      [transactionId.award_loyalty_points]
    );
  }

  /**
   * Award bonus points (e.g., promotions, events)
   */
  async awardBonusPoints(
    user_id: string,
    amount: number,
    source: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<PointsTransaction | null> {
    const transactionId = await this.db.queryOne<{ award_loyalty_points: string }>(
      `SELECT award_loyalty_points($1, 'bonus', $2, $3, $4, $5) as award_loyalty_points`,
      [user_id, amount, source, description, JSON.stringify(metadata)]
    );

    if (!transactionId) {
      return null;
    }

    return await this.db.queryOne<PointsTransaction>(
      'SELECT * FROM points_transactions WHERE id = $1',
      [transactionId.award_loyalty_points]
    );
  }

  /**
   * Spend points (e.g., redeem for rewards)
   */
  async spendPoints(
    user_id: string,
    amount: number,
    source: string,
    description: string,
    metadata: Record<string, any> = {}
  ): Promise<PointsTransaction | null> {
    // Check if user has enough points
    const points = await this.getUserPoints(user_id);
    if (!points || points.balance < amount) {
      throw new Error('Insufficient points balance');
    }

    const transactionId = await this.db.queryOne<{ award_loyalty_points: string }>(
      `SELECT award_loyalty_points($1, 'spend', $2, $3, $4, $5) as award_loyalty_points`,
      [user_id, -amount, source, description, JSON.stringify(metadata)]
    );

    if (!transactionId) {
      return null;
    }

    return await this.db.queryOne<PointsTransaction>(
      'SELECT * FROM points_transactions WHERE id = $1',
      [transactionId.award_loyalty_points]
    );
  }

  /**
   * Record trading volume (synced from exchange DB)
   */
  async recordTradingVolume(data: TradingVolume): Promise<void> {
    await this.db.execute(
      `INSERT INTO user_trading_volume 
       (user_id, date, total_volume_usd, buy_volume_usd, sell_volume_usd, trade_count)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (user_id, date) 
       DO UPDATE SET 
         total_volume_usd = user_trading_volume.total_volume_usd + EXCLUDED.total_volume_usd,
         buy_volume_usd = user_trading_volume.buy_volume_usd + EXCLUDED.buy_volume_usd,
         sell_volume_usd = user_trading_volume.sell_volume_usd + EXCLUDED.sell_volume_usd,
         trade_count = user_trading_volume.trade_count + EXCLUDED.trade_count,
         updated_at = NOW()`,
      [
        data.user_id,
        data.date,
        data.total_volume_usd,
        data.buy_volume_usd,
        data.sell_volume_usd,
        data.trade_count,
      ]
    );

    // Update user statistics
    await this.db.execute(
      `UPDATE user_statistics
       SET total_trades = total_trades + $1,
           total_volume_usd = total_volume_usd + $2,
           last_trade_at = NOW()
       WHERE user_id = $3`,
      [data.trade_count, data.total_volume_usd, data.user_id]
    );
  }

  /**
   * Record daily profit (synced from exchange DB)
   */
  async recordDailyProfit(data: TradingProfit): Promise<void> {
    await this.db.execute(
      `INSERT INTO user_trading_profit 
       (user_id, date, realized_pnl_usd, unrealized_pnl_usd, total_pnl_usd, 
        profit_percentage, starting_balance_usd, ending_balance_usd, win_rate, profit_factor)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
       ON CONFLICT (user_id, date) 
       DO UPDATE SET 
         realized_pnl_usd = EXCLUDED.realized_pnl_usd,
         unrealized_pnl_usd = EXCLUDED.unrealized_pnl_usd,
         total_pnl_usd = EXCLUDED.total_pnl_usd,
         profit_percentage = EXCLUDED.profit_percentage,
         starting_balance_usd = EXCLUDED.starting_balance_usd,
         ending_balance_usd = EXCLUDED.ending_balance_usd,
         win_rate = EXCLUDED.win_rate,
         profit_factor = EXCLUDED.profit_factor,
         updated_at = NOW()`,
      [
        data.user_id,
        data.date,
        data.realized_pnl_usd,
        data.unrealized_pnl_usd,
        data.total_pnl_usd,
        data.profit_percentage,
        data.starting_balance_usd,
        data.ending_balance_usd,
        data.win_rate,
        data.profit_factor,
      ]
    );

    // Update consecutive profit days
    await this.updateConsecutiveProfitDays(data.user_id);

    // Update user statistics
    await this.db.execute(
      `UPDATE user_statistics
       SET total_pnl_usd = total_pnl_usd + $1,
           best_day_pnl_usd = GREATEST(best_day_pnl_usd, $2),
           worst_day_pnl_usd = LEAST(worst_day_pnl_usd, $2),
           last_profit_calculation_at = NOW()
       WHERE user_id = $3`,
      [data.total_pnl_usd, data.total_pnl_usd, data.user_id]
    );

    // Recalculate multiplier after profit update
    await this.recalculateMultiplier(data.user_id);
  }

  /**
   * Update consecutive profit days
   */
  private async updateConsecutiveProfitDays(user_id: string): Promise<void> {
    const result = await this.db.queryOne<{ consecutive_days: number }>(
      `WITH profit_days AS (
        SELECT date, profit_percentage,
               LAG(date) OVER (ORDER BY date) as prev_date
        FROM user_trading_profit
        WHERE user_id = $1 AND profit_percentage > 0
        ORDER BY date DESC
        LIMIT 90
      ),
      consecutive AS (
        SELECT COUNT(*) as consecutive_days
        FROM profit_days
        WHERE prev_date IS NULL OR (date - prev_date) = 1
      )
      SELECT COALESCE(MAX(consecutive_days), 0) as consecutive_days FROM consecutive`,
      [user_id]
    );

    const consecutiveDays = result?.consecutive_days || 0;

    await this.db.execute(
      `UPDATE user_statistics
       SET consecutive_profit_days = $1,
           max_consecutive_profit_days = GREATEST(max_consecutive_profit_days, $1)
       WHERE user_id = $2`,
      [consecutiveDays, user_id]
    );
  }

  /**
   * Recalculate points multiplier based on profit and other factors
   */
  async recalculateMultiplier(user_id: string): Promise<number> {
    const result = await this.db.queryOne<{ calculate_points_multiplier: number }>(
      'SELECT calculate_points_multiplier($1) as calculate_points_multiplier',
      [user_id]
    );

    return result?.calculate_points_multiplier || 1.0;
  }

  /**
   * Get user's points transactions
   */
  async getPointsTransactions(
    user_id: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<PointsTransaction[]> {
    return await this.db.query<PointsTransaction>(
      `SELECT * FROM points_transactions 
       WHERE user_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [user_id, limit, offset]
    );
  }

  /**
   * Update user tier based on lifetime earned points
   */
  async updateUserTier(user_id: string): Promise<string> {
    const points = await this.getUserPoints(user_id);
    if (!points) {
      return 'bronze';
    }

    let newTier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond' = 'bronze';

    if (points.lifetime_earned >= this.config.tier_thresholds.diamond) {
      newTier = 'diamond';
    } else if (points.lifetime_earned >= this.config.tier_thresholds.platinum) {
      newTier = 'platinum';
    } else if (points.lifetime_earned >= this.config.tier_thresholds.gold) {
      newTier = 'gold';
    } else if (points.lifetime_earned >= this.config.tier_thresholds.silver) {
      newTier = 'silver';
    }

    if (newTier !== points.tier) {
      await this.db.execute(
        `UPDATE loyalty_points 
         SET tier = $1, last_tier_update = NOW() 
         WHERE user_id = $2`,
        [newTier, user_id]
      );

      await this.db.execute(
        'UPDATE users SET tier = $1 WHERE id = $2',
        [newTier, user_id]
      );
    }

    return newTier;
  }

  /**
   * Get leaderboard
   */
  async getLeaderboard(
    type: 'points' | 'volume' | 'profit',
    period: 'daily' | 'weekly' | 'monthly' | 'all_time' = 'all_time',
    limit: number = 100
  ): Promise<any[]> {
    if (type === 'points') {
      return await this.db.query(
        `SELECT u.id, u.username, u.tier, lp.balance, lp.lifetime_earned, lp.multiplier
         FROM loyalty_points lp
         JOIN users u ON lp.user_id = u.id
         WHERE u.status = 'active'
         ORDER BY lp.balance DESC
         LIMIT $1`,
        [limit]
      );
    }

    if (type === 'volume') {
      const dateFilter = this.getPeriodDateFilter(period);
      return await this.db.query(
        `SELECT u.id, u.username, u.tier, 
                SUM(tv.total_volume_usd) as total_volume,
                COUNT(DISTINCT tv.date) as trading_days
         FROM user_trading_volume tv
         JOIN users u ON tv.user_id = u.id
         WHERE u.status = 'active' ${dateFilter}
         GROUP BY u.id, u.username, u.tier
         ORDER BY total_volume DESC
         LIMIT $1`,
        [limit]
      );
    }

    if (type === 'profit') {
      const dateFilter = this.getPeriodDateFilter(period);
      return await this.db.query(
        `SELECT u.id, u.username, u.tier,
                SUM(tp.total_pnl_usd) as total_pnl,
                AVG(tp.profit_percentage) as avg_profit_pct,
                COUNT(DISTINCT tp.date) as trading_days
         FROM user_trading_profit tp
         JOIN users u ON tp.user_id = u.id
         WHERE u.status = 'active' ${dateFilter}
         GROUP BY u.id, u.username, u.tier
         ORDER BY total_pnl DESC
         LIMIT $1`,
        [limit]
      );
    }

    return [];
  }

  /**
   * Get period date filter SQL
   */
  private getPeriodDateFilter(period: string): string {
    switch (period) {
      case 'daily':
        return "AND date = CURRENT_DATE";
      case 'weekly':
        return "AND date >= CURRENT_DATE - INTERVAL '7 days'";
      case 'monthly':
        return "AND date >= CURRENT_DATE - INTERVAL '30 days'";
      default:
        return '';
    }
  }

  /**
   * Get user statistics
   */
  async getUserStatistics(user_id: string): Promise<any> {
    return await this.db.queryOne(
      'SELECT * FROM user_statistics WHERE user_id = $1',
      [user_id]
    );
  }
}
