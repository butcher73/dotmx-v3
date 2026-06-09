/**
 * Referral Service
 * Manages referral codes, tracking, and reward distribution
 */

import type { DatabaseService } from './database';
import type { LoyaltyPointsService } from './loyalty.service';

export interface ReferralCode {
  id: string;
  user_id: string;
  code: string;
  is_active: boolean;
  max_uses: number | null;
  current_uses: number;
  expires_at: Date | null;
  signup_reward_points: number;
  first_trade_reward_points: number;
  commission_percentage: number;
  created_at: Date;
  updated_at: Date;
}

export interface Referral {
  id: string;
  referrer_id: string;
  referee_id: string;
  referral_code_id: string;
  status: 'pending' | 'completed' | 'expired' | 'invalid';
  referred_at: Date;
  first_trade_at: Date | null;
  total_volume_usd: number;
  total_rewards_distributed: number;
  created_at: Date;
  updated_at: Date;
}

export interface ReferralReward {
  id: string;
  referral_id: string;
  recipient_id: string;
  recipient_type: 'referrer' | 'referee';
  reward_type: 'signup' | 'first_trade' | 'volume_milestone' | 'monthly_commission';
  points_amount: number;
  commission_percentage: number | null;
  volume_amount_usd: number | null;
  description: string;
  metadata: Record<string, any>;
  distributed_at: Date;
  created_at: Date;
}

export interface ReferralConfig {
  code_length: number;
  code_prefix: string;
  default_signup_reward: number;
  default_first_trade_reward: number;
  default_commission_percentage: number;
  max_active_codes_per_user: number;
  volume_milestones: { volume: number; reward: number }[];
}

export class ReferralService {
  private db: DatabaseService;
  private loyaltyService: LoyaltyPointsService;
  private config: ReferralConfig;

  constructor(
    db: DatabaseService,
    loyaltyService: LoyaltyPointsService,
    config?: Partial<ReferralConfig>
  ) {
    this.db = db;
    this.loyaltyService = loyaltyService;
    this.config = {
      code_length: config?.code_length || 8,
      code_prefix: config?.code_prefix || 'DOTMX',
      default_signup_reward: config?.default_signup_reward || 100,
      default_first_trade_reward: config?.default_first_trade_reward || 500,
      default_commission_percentage: config?.default_commission_percentage || 10,
      max_active_codes_per_user: config?.max_active_codes_per_user || 5,
      volume_milestones: config?.volume_milestones || [
        { volume: 1000, reward: 100 },
        { volume: 10000, reward: 500 },
        { volume: 50000, reward: 2000 },
        { volume: 100000, reward: 5000 },
        { volume: 500000, reward: 20000 },
      ],
    };
  }

  /**
   * Generate a unique referral code
   */
  private generateCode(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let code = this.config.code_prefix;
    for (let i = 0; i < this.config.code_length; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return code;
  }

  /**
   * Create a new referral code
   */
  async createReferralCode(
    user_id: string,
    options?: {
      custom_code?: string;
      max_uses?: number;
      expires_at?: Date;
      signup_reward?: number;
      first_trade_reward?: number;
      commission_percentage?: number;
    }
  ): Promise<ReferralCode> {
    // Check active codes limit
    const activeCount = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM referral_codes WHERE user_id = $1 AND is_active = true',
      [user_id]
    );

    if (activeCount && activeCount.count >= this.config.max_active_codes_per_user) {
      throw new Error(
        `Maximum active referral codes limit reached (${this.config.max_active_codes_per_user})`
      );
    }

    // Generate or validate code
    let code = options?.custom_code || this.generateCode();
    const isCustomCode = !!options?.custom_code;
    
    // Ensure code is unique
    let attempts = 0;
    while (attempts < 10) {
      const existing = await this.db.queryOne(
        'SELECT id FROM referral_codes WHERE code = $1',
        [code]
      );
      if (!existing) break;
      
      // If it's a custom code and already exists, throw error
      if (isCustomCode) {
        throw new Error('Referral code already exists');
      }
      
      code = this.generateCode();
      attempts++;
    }

    if (attempts >= 10) {
      throw new Error('Failed to generate unique referral code');
    }

    const referralCode = await this.db.queryOne<ReferralCode>(
      `INSERT INTO referral_codes 
       (user_id, code, max_uses, expires_at, signup_reward_points, 
        first_trade_reward_points, commission_percentage)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [
        user_id,
        code,
        options?.max_uses || null,
        options?.expires_at || null,
        options?.signup_reward || this.config.default_signup_reward,
        options?.first_trade_reward || this.config.default_first_trade_reward,
        options?.commission_percentage || this.config.default_commission_percentage,
      ]
    );

    if (!referralCode) {
      throw new Error('Failed to create referral code');
    }

    return referralCode;
  }

  /**
   * Get user's referral codes
   */
  async getUserReferralCodes(user_id: string): Promise<ReferralCode[]> {
    return await this.db.query<ReferralCode>(
      'SELECT * FROM referral_codes WHERE user_id = $1 ORDER BY created_at DESC',
      [user_id]
    );
  }

  /**
   * Get referral code by code string
   */
  async getReferralCodeByCode(code: string): Promise<ReferralCode | null> {
    return await this.db.queryOne<ReferralCode>(
      'SELECT * FROM referral_codes WHERE code = $1',
      [code]
    );
  }

  /**
   * Apply referral code during signup
   */
  async applyReferralCode(referee_id: string, code: string): Promise<Referral> {
    // Get referral code
    const referralCode = await this.getReferralCodeByCode(code);
    if (!referralCode) {
      throw new Error('Invalid referral code');
    }

    // Validate referral code
    if (!referralCode.is_active) {
      throw new Error('Referral code is not active');
    }

    if (referralCode.user_id === referee_id) {
      throw new Error('Cannot use your own referral code');
    }

    if (referralCode.expires_at && new Date(referralCode.expires_at) < new Date()) {
      throw new Error('Referral code has expired');
    }

    if (
      referralCode.max_uses !== null &&
      referralCode.current_uses >= referralCode.max_uses
    ) {
      throw new Error('Referral code has reached maximum uses');
    }

    // Check if user already used a referral code
    const existing = await this.db.queryOne(
      'SELECT id FROM referrals WHERE referee_id = $1',
      [referee_id]
    );

    if (existing) {
      throw new Error('User has already used a referral code');
    }

    // Create referral
    const referral = await this.db.queryOne<Referral>(
      `INSERT INTO referrals (referrer_id, referee_id, referral_code_id, referral_code, status)
       VALUES ($1, $2, $3, $4, 'pending')
       RETURNING *`,
      [referralCode.user_id, referee_id, referralCode.id, referralCode.code]
    );

    if (!referral) {
      throw new Error('Failed to create referral');
    }

    // Update referral code usage
    await this.db.execute(
      `UPDATE referral_codes 
       SET current_uses = current_uses + 1 
       WHERE id = $1`,
      [referralCode.id]
    );

    // Award signup rewards
    await this.distributeSignupRewards(referral.id, referralCode);

    // Update user statistics
    await this.db.execute(
      `UPDATE user_statistics
       SET total_referrals = total_referrals + 1
       WHERE user_id = $1`,
      [referralCode.user_id]
    );

    // Update referral multiplier
    await this.updateReferralMultiplier(referralCode.user_id);

    return referral;
  }

  /**
   * Distribute signup rewards
   */
  private async distributeSignupRewards(
    referral_id: string,
    referralCode: ReferralCode
  ): Promise<void> {
    const referral = await this.db.queryOne<Referral>(
      'SELECT * FROM referrals WHERE id = $1',
      [referral_id]
    );

    if (!referral) return;

    // Reward referrer
    if (referralCode.signup_reward_points > 0) {
      await this.loyaltyService.awardBonusPoints(
        referral.referrer_id,
        referralCode.signup_reward_points,
        'referral_signup',
        `Referral signup reward for referring user`,
        { referral_id, referee_id: referral.referee_id }
      );

      await this.db.execute(
        `INSERT INTO referral_rewards 
         (referral_id, recipient_id, recipient_type, reward_type, points_amount, description, metadata)
         VALUES ($1, $2, 'referrer', 'signup', $3, $4, $5)`,
        [
          referral_id,
          referral.referrer_id,
          referralCode.signup_reward_points,
          'Signup reward for referring a new user',
          JSON.stringify({ referee_id: referral.referee_id }),
        ]
      );
    }

    // Reward referee
    if (referralCode.signup_reward_points > 0) {
      await this.loyaltyService.awardBonusPoints(
        referral.referee_id,
        referralCode.signup_reward_points,
        'referral_signup',
        `Welcome bonus for using referral code`,
        { referral_id, referrer_id: referral.referrer_id }
      );

      await this.db.execute(
        `INSERT INTO referral_rewards 
         (referral_id, recipient_id, recipient_type, reward_type, points_amount, description, metadata)
         VALUES ($1, $2, 'referee', 'signup', $3, $4, $5)`,
        [
          referral_id,
          referral.referee_id,
          referralCode.signup_reward_points,
          'Welcome bonus for using referral code',
          JSON.stringify({ referrer_id: referral.referrer_id }),
        ]
      );
    }
  }

  /**
   * Handle first trade completion
   */
  async handleFirstTrade(user_id: string, trade_volume_usd: number): Promise<void> {
    const referral = await this.db.queryOne<Referral>(
      `SELECT r.*, rc.first_trade_reward_points, rc.commission_percentage
       FROM referrals r
       JOIN referral_codes rc ON r.referral_code_id = rc.id
       WHERE r.referee_id = $1 AND r.first_trade_at IS NULL`,
      [user_id]
    );

    if (!referral) return;

    // Update referral
    await this.db.execute(
      `UPDATE referrals 
       SET first_trade_at = NOW(), 
           status = 'completed',
           total_volume_usd = total_volume_usd + $1
       WHERE id = $2`,
      [trade_volume_usd, referral.id]
    );

    // Get referral code for rewards
    const referralCode = await this.db.queryOne<ReferralCode>(
      'SELECT * FROM referral_codes WHERE id = $1',
      [referral.referral_code_id]
    );

    if (!referralCode) return;

    // Award first trade rewards to referrer
    if (referralCode.first_trade_reward_points > 0) {
      await this.loyaltyService.awardBonusPoints(
        referral.referrer_id,
        referralCode.first_trade_reward_points,
        'referral_first_trade',
        `First trade reward for referred user`,
        { referral_id: referral.id, referee_id: user_id, volume: trade_volume_usd }
      );

      await this.db.execute(
        `INSERT INTO referral_rewards 
         (referral_id, recipient_id, recipient_type, reward_type, points_amount, description, metadata)
         VALUES ($1, $2, 'referrer', 'first_trade', $3, $4, $5)`,
        [
          referral.id,
          referral.referrer_id,
          referralCode.first_trade_reward_points,
          'First trade reward for referred user',
          JSON.stringify({ referee_id: user_id, volume: trade_volume_usd }),
        ]
      );
    }

    // Award first trade rewards to referee
    if (referralCode.first_trade_reward_points > 0) {
      await this.loyaltyService.awardBonusPoints(
        user_id,
        referralCode.first_trade_reward_points,
        'referral_first_trade',
        `First trade completion bonus`,
        { referral_id: referral.id, referrer_id: referral.referrer_id, volume: trade_volume_usd }
      );

      await this.db.execute(
        `INSERT INTO referral_rewards 
         (referral_id, recipient_id, recipient_type, reward_type, points_amount, description, metadata)
         VALUES ($1, $2, 'referee', 'first_trade', $3, $4, $5)`,
        [
          referral.id,
          user_id,
          referralCode.first_trade_reward_points,
          'First trade completion bonus',
          JSON.stringify({ referrer_id: referral.referrer_id, volume: trade_volume_usd }),
        ]
      );
    }

    // Update active referrals count
    await this.db.execute(
      `UPDATE user_statistics
       SET active_referrals = active_referrals + 1
       WHERE user_id = $1`,
      [referral.referrer_id]
    );

    // Update referral multiplier
    await this.updateReferralMultiplier(referral.referrer_id);
  }

  /**
   * Handle volume milestone
   */
  async checkVolumeMilestones(user_id: string, total_volume_usd: number): Promise<void> {
    const referral = await this.db.queryOne<Referral>(
      'SELECT * FROM referrals WHERE referee_id = $1',
      [user_id]
    );

    if (!referral) return;

    // Check which milestones have been reached but not yet rewarded
    for (const milestone of this.config.volume_milestones) {
      if (total_volume_usd >= milestone.volume) {
        // Check if milestone already rewarded
        const existing = await this.db.queryOne(
          `SELECT id FROM referral_rewards 
           WHERE referral_id = $1 
           AND reward_type = 'volume_milestone' 
           AND volume_amount_usd = $2`,
          [referral.id, milestone.volume]
        );

        if (!existing) {
          // Award milestone reward to referrer
          await this.loyaltyService.awardBonusPoints(
            referral.referrer_id,
            milestone.reward,
            'referral_milestone',
            `Volume milestone reward: $${milestone.volume}`,
            { referral_id: referral.id, referee_id: user_id, milestone_volume: milestone.volume }
          );

          await this.db.execute(
            `INSERT INTO referral_rewards 
             (referral_id, recipient_id, recipient_type, reward_type, points_amount, 
              volume_amount_usd, description, metadata)
             VALUES ($1, $2, 'referrer', 'volume_milestone', $3, $4, $5, $6)`,
            [
              referral.id,
              referral.referrer_id,
              milestone.reward,
              milestone.volume,
              `Volume milestone reward: $${milestone.volume}`,
              JSON.stringify({ referee_id: user_id, milestone_volume: milestone.volume }),
            ]
          );
        }
      }
    }
  }

  /**
   * Distribute monthly commissions
   */
  async distributeMonthlyCommissions(year: number, month: number): Promise<void> {
    // Get all active referrals with volume in the given month
    const referrals = await this.db.query<any>(
      `SELECT r.id, r.referrer_id, r.referee_id, rc.commission_percentage,
              SUM(tv.total_volume_usd) as monthly_volume
       FROM referrals r
       JOIN referral_codes rc ON r.referral_code_id = rc.id
       JOIN user_trading_volume tv ON tv.user_id = r.referee_id
       WHERE r.status = 'completed'
       AND EXTRACT(YEAR FROM tv.date) = $1
       AND EXTRACT(MONTH FROM tv.date) = $2
       GROUP BY r.id, r.referrer_id, r.referee_id, rc.commission_percentage
       HAVING SUM(tv.total_volume_usd) > 0`,
      [year, month]
    );

    for (const referral of referrals) {
      // Calculate commission (percentage of volume as points)
      const commission = Math.floor(
        (referral.monthly_volume * referral.commission_percentage) / 100
      );

      if (commission > 0) {
        await this.loyaltyService.awardBonusPoints(
          referral.referrer_id,
          commission,
          'referral_commission',
          `Monthly commission for ${year}-${month}`,
          {
            referral_id: referral.id,
            referee_id: referral.referee_id,
            volume: referral.monthly_volume,
            year,
            month,
          }
        );

        await this.db.execute(
          `INSERT INTO referral_rewards 
           (referral_id, recipient_id, recipient_type, reward_type, points_amount,
            commission_percentage, volume_amount_usd, description, metadata)
           VALUES ($1, $2, 'referrer', 'monthly_commission', $3, $4, $5, $6, $7)`,
          [
            referral.id,
            referral.referrer_id,
            commission,
            referral.commission_percentage,
            referral.monthly_volume,
            `Monthly commission for ${year}-${month}`,
            JSON.stringify({
              referee_id: referral.referee_id,
              volume: referral.monthly_volume,
              year,
              month,
            }),
          ]
        );

        // Update total rewards distributed
        await this.db.execute(
          `UPDATE referrals 
           SET total_rewards_distributed = total_rewards_distributed + $1
           WHERE id = $2`,
          [commission, referral.id]
        );
      }
    }
  }

  /**
   * Update referral multiplier
   */
  private async updateReferralMultiplier(user_id: string): Promise<void> {
    // Get active referrals count
    const result = await this.db.queryOne<{ active_count: number }>(
      `SELECT COUNT(*) as active_count
       FROM referrals
       WHERE referrer_id = $1 AND status = 'completed'`,
      [user_id]
    );

    const activeCount = result?.active_count || 0;

    // Calculate multiplier (1.1x if user has active referrals)
    const multiplier = activeCount > 0 ? 1.1 : 1.0;

    // Update loyalty points
    await this.db.execute(
      `UPDATE loyalty_points 
       SET referral_multiplier = $1
       WHERE user_id = $2`,
      [multiplier, user_id]
    );
  }

  /**
   * Get user's referrals
   */
  async getUserReferrals(
    user_id: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<Referral[]> {
    return await this.db.query<Referral>(
      `SELECT * FROM referrals 
       WHERE referrer_id = $1 
       ORDER BY created_at DESC 
       LIMIT $2 OFFSET $3`,
      [user_id, limit, offset]
    );
  }

  /**
   * Get referral statistics
   */
  async getReferralStatistics(user_id: string): Promise<any> {
    const stats = await this.db.queryOne(
      `SELECT 
        COUNT(*) as total_referrals,
        COUNT(*) FILTER (WHERE status = 'completed') as active_referrals,
        SUM(total_volume_usd) as total_referee_volume,
        SUM(total_rewards_distributed) as total_rewards_earned
       FROM referrals
       WHERE referrer_id = $1`,
      [user_id]
    );

    const rewards = await this.db.query(
      `SELECT reward_type, SUM(points_amount) as total_points
       FROM referral_rewards
       WHERE recipient_id = $1 AND recipient_type = 'referrer'
       GROUP BY reward_type`,
      [user_id]
    );

    return {
      ...stats,
      rewards_by_type: rewards,
    };
  }

  /**
   * Deactivate referral code
   */
  async deactivateReferralCode(user_id: string, code_id: string): Promise<void> {
    await this.db.execute(
      `UPDATE referral_codes 
       SET is_active = false 
       WHERE id = $1 AND user_id = $2`,
      [code_id, user_id]
    );
  }

  /**
   * Update referral code
   */
  async updateReferralCode(
    user_id: string,
    code_id: string,
    updates: {
      max_uses?: number;
      expires_at?: Date | null;
      signup_reward?: number;
      first_trade_reward?: number;
      commission_percentage?: number;
      is_active?: boolean;
    }
  ): Promise<ReferralCode> {
    const fields: string[] = [];
    const values: any[] = [];
    let paramIndex = 1;

    if (updates.max_uses !== undefined) {
      fields.push(`max_uses = $${paramIndex++}`);
      values.push(updates.max_uses);
    }
    if (updates.expires_at !== undefined) {
      fields.push(`expires_at = $${paramIndex++}`);
      values.push(updates.expires_at);
    }
    if (updates.signup_reward !== undefined) {
      fields.push(`signup_reward_points = $${paramIndex++}`);
      values.push(updates.signup_reward);
    }
    if (updates.first_trade_reward !== undefined) {
      fields.push(`first_trade_reward_points = $${paramIndex++}`);
      values.push(updates.first_trade_reward);
    }
    if (updates.commission_percentage !== undefined) {
      fields.push(`commission_percentage = $${paramIndex++}`);
      values.push(updates.commission_percentage);
    }
    if (updates.is_active !== undefined) {
      fields.push(`is_active = $${paramIndex++}`);
      values.push(updates.is_active);
    }

    if (fields.length === 0) {
      throw new Error('No updates provided');
    }

    fields.push(`updated_at = NOW()`);
    values.push(code_id, user_id);

    const code = await this.db.queryOne<ReferralCode>(
      `UPDATE referral_codes 
       SET ${fields.join(', ')}
       WHERE id = $${paramIndex++} AND user_id = $${paramIndex++}
       RETURNING *`,
      values
    );

    if (!code) {
      throw new Error('Referral code not found');
    }

    return code;
  }
}
