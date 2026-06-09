// @ts-nocheck
/**
 * Volume Sync Service
 * Syncs trading volume from exchange database to user service database
 */

import type { DatabaseService } from './database';
import type { UserDatabaseService } from './user-database.service';
import type { LoyaltyPointsService } from './loyalty.service';
import type { ReferralService } from './referral.service';

export interface VolumeData {
  user_id: string;
  date: Date;
  total_volume_usd: number;
  buy_volume_usd: number;
  sell_volume_usd: number;
  trade_count: number;
}

export interface ProfitData {
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

export class VolumeSyncService {
  private exchangeDb: DatabaseService;
  private userDb: UserDatabaseService;
  private loyaltyService: LoyaltyPointsService;
  private referralService: ReferralService;
  private syncInterval: number;
  private isRunning: boolean = false;
  private timer?: NodeJS.Timeout;

  constructor(
    exchangeDb: DatabaseService,
    userDb: UserDatabaseService,
    loyaltyService: LoyaltyPointsService,
    referralService: ReferralService,
    syncIntervalMinutes: number = 5
  ) {
    this.exchangeDb = exchangeDb;
    this.userDb = userDb;
    this.loyaltyService = loyaltyService;
    this.referralService = referralService;
    this.syncInterval = syncIntervalMinutes * 60 * 1000;
  }

  /**
   * Start automatic syncing
   */
  start(): void {
    if (this.isRunning) {
      console.log('Volume sync service is already running');
      return;
    }

    this.isRunning = true;
    console.log(`Starting volume sync service (interval: ${this.syncInterval / 1000}s)`);

    // Run immediately on start
    this.syncAll().catch((error) => {
      console.error('Initial volume sync failed:', error);
    });

    // Schedule periodic syncing
    this.timer = setInterval(() => {
      this.syncAll().catch((error) => {
        console.error('Periodic volume sync failed:', error);
      });
    }, this.syncInterval);
  }

  /**
   * Stop automatic syncing
   */
  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    this.isRunning = false;
    console.log('Volume sync service stopped');
  }

  /**
   * Sync all data (volume, profit, points, referrals)
   */
  async syncAll(): Promise<void> {
    const startTime = Date.now();
    console.log('Starting full data sync...');

    try {
      // Sync yesterday's data (finalized)
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      yesterday.setHours(0, 0, 0, 0);

      // Sync today's data (real-time)
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      await Promise.all([
        this.syncVolumeForDate(yesterday),
        this.syncVolumeForDate(today),
        this.syncProfitForDate(yesterday),
        this.syncProfitForDate(today),
      ]);

      const duration = Date.now() - startTime;
      console.log(`Full data sync completed in ${duration}ms`);
    } catch (error) {
      console.error('Full data sync failed:', error);
      throw error;
    }
  }

  /**
   * Sync volume data for a specific date
   */
  async syncVolumeForDate(date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    console.log(`Syncing volume for ${dateStr}...`);

    try {
      // Get volume data from exchange database
      // This query assumes you have a trades table with user_id, timestamp, and volume
      const volumeData = await this.exchangeDb.query<VolumeData>(
        `SELECT 
          user_id,
          DATE($1) as date,
          SUM(CASE WHEN side = 'buy' THEN price * size ELSE 0 END) as buy_volume_usd,
          SUM(CASE WHEN side = 'sell' THEN price * size ELSE 0 END) as sell_volume_usd,
          SUM(price * size) as total_volume_usd,
          COUNT(*) as trade_count
         FROM trades
         WHERE DATE(created_at) = DATE($1)
         GROUP BY user_id`,
        [date]
      );

      console.log(`Found ${volumeData.length} users with volume on ${dateStr}`);

      // Sync to user database and award points
      for (const data of volumeData) {
        try {
          // Record volume
          await this.loyaltyService.recordTradingVolume({
            user_id: data.user_id,
            date: new Date(dateStr),
            total_volume_usd: data.total_volume_usd,
            buy_volume_usd: data.buy_volume_usd,
            sell_volume_usd: data.sell_volume_usd,
            trade_count: data.trade_count,
          });

          // Award loyalty points for volume
          await this.loyaltyService.awardPointsForVolume(data.user_id, data.total_volume_usd, {
            date: dateStr,
            trade_count: data.trade_count,
          });

          // Check if this is user's first trade (for referral rewards)
          const isFirstTrade = await this.checkIfFirstTrade(data.user_id);
          if (isFirstTrade) {
            await this.referralService.handleFirstTrade(data.user_id, data.total_volume_usd);
          }

          // Check volume milestones
          const totalVolume = await this.getTotalUserVolume(data.user_id);
          await this.referralService.checkVolumeMilestones(data.user_id, totalVolume);
        } catch (error) {
          console.error(`Failed to sync volume for user ${data.user_id}:`, error);
        }
      }

      console.log(`Volume sync completed for ${dateStr}`);
    } catch (error) {
      console.error(`Volume sync failed for ${dateStr}:`, error);
      throw error;
    }
  }

  /**
   * Sync profit data for a specific date
   */
  async syncProfitForDate(date: Date): Promise<void> {
    const dateStr = date.toISOString().split('T')[0];
    console.log(`Syncing profit for ${dateStr}...`);

    try {
      // Get profit data from exchange database
      // This assumes you have position history or balance snapshots
      const profitData = await this.exchangeDb.query<ProfitData>(
        `WITH daily_balances AS (
          SELECT 
            user_id,
            DATE($1) as date,
            FIRST_VALUE(balance_usd) OVER (PARTITION BY user_id ORDER BY timestamp) as starting_balance,
            LAST_VALUE(balance_usd) OVER (PARTITION BY user_id ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as ending_balance,
            SUM(realized_pnl_usd) OVER (PARTITION BY user_id) as realized_pnl,
            LAST_VALUE(unrealized_pnl_usd) OVER (PARTITION BY user_id ORDER BY timestamp ROWS BETWEEN UNBOUNDED PRECEDING AND UNBOUNDED FOLLOWING) as unrealized_pnl
          FROM balance_snapshots
          WHERE DATE(timestamp) = DATE($1)
        ),
        daily_trades AS (
          SELECT 
            user_id,
            COUNT(*) FILTER (WHERE pnl > 0) as winning_trades,
            COUNT(*) as total_trades,
            SUM(CASE WHEN pnl > 0 THEN pnl ELSE 0 END) as gross_profit,
            SUM(CASE WHEN pnl < 0 THEN ABS(pnl) ELSE 0 END) as gross_loss
          FROM trades
          WHERE DATE(created_at) = DATE($1) AND status = 'closed'
          GROUP BY user_id
        )
        SELECT DISTINCT ON (db.user_id)
          db.user_id,
          db.date,
          db.realized_pnl as realized_pnl_usd,
          db.unrealized_pnl as unrealized_pnl_usd,
          (db.realized_pnl + db.unrealized_pnl) as total_pnl_usd,
          CASE 
            WHEN db.starting_balance > 0 
            THEN ((db.ending_balance - db.starting_balance) / db.starting_balance * 100)
            ELSE 0
          END as profit_percentage,
          db.starting_balance as starting_balance_usd,
          db.ending_balance as ending_balance_usd,
          COALESCE(dt.winning_trades::float / NULLIF(dt.total_trades, 0) * 100, 0) as win_rate,
          CASE 
            WHEN dt.gross_loss > 0 
            THEN dt.gross_profit / dt.gross_loss 
            ELSE 0 
          END as profit_factor
        FROM daily_balances db
        LEFT JOIN daily_trades dt ON db.user_id = dt.user_id`,
        [date]
      );

      console.log(`Found ${profitData.length} users with profit data on ${dateStr}`);

      // Sync to user database
      for (const data of profitData) {
        try {
          await this.loyaltyService.recordDailyProfit({
            user_id: data.user_id,
            date: new Date(dateStr),
            realized_pnl_usd: data.realized_pnl_usd,
            unrealized_pnl_usd: data.unrealized_pnl_usd,
            total_pnl_usd: data.total_pnl_usd,
            profit_percentage: data.profit_percentage,
            starting_balance_usd: data.starting_balance_usd,
            ending_balance_usd: data.ending_balance_usd,
            win_rate: data.win_rate,
            profit_factor: data.profit_factor,
          });

          // Update user statistics
          await this.userDb.execute(
            `UPDATE user_statistics
             SET total_pnl_usd = total_pnl_usd + $1,
                 win_rate = $2,
                 profit_factor = $3,
                 last_profit_calculation_at = NOW()
             WHERE user_id = $4`,
            [data.total_pnl_usd, data.win_rate, data.profit_factor, data.user_id]
          );
        } catch (error) {
          console.error(`Failed to sync profit for user ${data.user_id}:`, error);
        }
      }

      console.log(`Profit sync completed for ${dateStr}`);
    } catch (error) {
      console.error(`Profit sync failed for ${dateStr}:`, error);
      throw error;
    }
  }

  /**
   * Sync monthly commissions
   */
  async syncMonthlyCommissions(): Promise<void> {
    const now = new Date();
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const year = lastMonth.getFullYear();
    const month = lastMonth.getMonth() + 1;

    console.log(`Syncing monthly commissions for ${year}-${month}...`);

    try {
      await this.referralService.distributeMonthlyCommissions(year, month);
      console.log(`Monthly commissions synced for ${year}-${month}`);
    } catch (error) {
      console.error(`Failed to sync monthly commissions:`, error);
      throw error;
    }
  }

  /**
   * Check if this is user's first trade
   */
  private async checkIfFirstTrade(user_id: string): Promise<boolean> {
    const result = await this.userDb.queryOne<{ first_trade_at: Date | null }>(
      `SELECT first_trade_at FROM referrals WHERE referee_id = $1`,
      [user_id]
    );

    return result !== null && result.first_trade_at === null;
  }

  /**
   * Get total user volume
   */
  private async getTotalUserVolume(user_id: string): Promise<number> {
    const result = await this.userDb.queryOne<{ total_volume: number }>(
      `SELECT SUM(total_volume_usd) as total_volume 
       FROM user_trading_volume 
       WHERE user_id = $1`,
      [user_id]
    );

    return result?.total_volume || 0;
  }

  /**
   * Manual sync for specific user
   */
  async syncUser(user_id: string, date?: Date): Promise<void> {
    const syncDate = date || new Date();
    console.log(`Manually syncing user ${user_id} for ${syncDate.toISOString().split('T')[0]}...`);

    try {
      // Sync volume
      await this.syncVolumeForDate(syncDate);

      // Sync profit
      await this.syncProfitForDate(syncDate);

      console.log(`Manual sync completed for user ${user_id}`);
    } catch (error) {
      console.error(`Manual sync failed for user ${user_id}:`, error);
      throw error;
    }
  }

  /**
   * Get sync status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      syncInterval: this.syncInterval,
      exchangeDb: this.exchangeDb.getPoolStats(),
      userDb: this.userDb.getPoolStats(),
    };
  }
}
