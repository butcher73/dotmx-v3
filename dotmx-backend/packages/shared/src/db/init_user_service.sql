-- User Service Database Initialization Script
-- Run this to create the user service database and initialize the schema

-- Step 1: Create the database (run as postgres superuser)
-- psql -U postgres
-- CREATE DATABASE dotmx_users;
-- \c dotmx_users

-- Step 2: Run the schema
\i user_service_schema.sql

-- Step 3: Create default data

-- Insert default profit multiplier tiers
INSERT INTO profit_multiplier_tiers (tier_name, min_profit_pct, max_profit_pct, consecutive_days_required, multiplier, description) VALUES
  ('no_bonus', NULL, 0, NULL, 1.0, 'No bonus - zero or negative profit'),
  ('small_profit', 0.01, 2.0, NULL, 1.1, 'Small daily profit (0.01% - 2%)'),
  ('medium_profit', 2.0, 5.0, NULL, 1.25, 'Medium daily profit (2% - 5%)'),
  ('high_profit', 5.0, 10.0, NULL, 1.5, 'High daily profit (5% - 10%)'),
  ('exceptional_profit', 10.0, NULL, NULL, 2.0, 'Exceptional daily profit (>10%)'),
  ('consistent_winner_3d', 0.01, NULL, 3, 1.3, '3 consecutive days of profit'),
  ('consistent_winner_7d', 0.01, NULL, 7, 1.6, '7 consecutive days of profit'),
  ('consistent_winner_30d', 0.01, NULL, 30, 2.5, '30 consecutive days of profit')
ON CONFLICT (tier_name) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_loyalty_points_user_id ON loyalty_points(user_id);
CREATE INDEX IF NOT EXISTS idx_loyalty_points_tier ON loyalty_points(tier);
CREATE INDEX IF NOT EXISTS idx_points_transactions_user_id ON points_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_points_transactions_created_at ON points_transactions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_trading_volume_user_date ON user_trading_volume(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_trading_profit_user_date ON user_trading_profit(user_id, date);
CREATE INDEX IF NOT EXISTS idx_user_trading_profit_profit_pct ON user_trading_profit(profit_percentage);
CREATE INDEX IF NOT EXISTS idx_referral_codes_code ON referral_codes(code);
CREATE INDEX IF NOT EXISTS idx_referral_codes_user_active ON referral_codes(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
CREATE INDEX IF NOT EXISTS idx_referrals_referee ON referrals(referee_id);
CREATE INDEX IF NOT EXISTS idx_referrals_status ON referrals(status);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_recipient ON referral_rewards(recipient_id);
CREATE INDEX IF NOT EXISTS idx_referral_rewards_referral ON referral_rewards(referral_id);
CREATE INDEX IF NOT EXISTS idx_user_statistics_user_id ON user_statistics(user_id);

-- Create materialized view for leaderboards (optional, for performance)
CREATE MATERIALIZED VIEW IF NOT EXISTS loyalty_leaderboard AS
SELECT 
  u.id as user_id,
  u.username,
  u.tier,
  lp.balance as current_points,
  lp.lifetime_earned,
  lp.multiplier,
  us.total_volume_usd,
  us.total_pnl_usd,
  us.total_trades,
  us.win_rate,
  us.total_referrals,
  us.active_referrals,
  ROW_NUMBER() OVER (ORDER BY lp.balance DESC) as rank_points,
  ROW_NUMBER() OVER (ORDER BY us.total_volume_usd DESC) as rank_volume,
  ROW_NUMBER() OVER (ORDER BY us.total_pnl_usd DESC) as rank_profit
FROM users u
JOIN loyalty_points lp ON u.id = lp.user_id
JOIN user_statistics us ON u.id = us.user_id
WHERE u.status = 'active';

CREATE UNIQUE INDEX IF NOT EXISTS idx_loyalty_leaderboard_user ON loyalty_leaderboard(user_id);

-- Create function to refresh leaderboard (call periodically)
CREATE OR REPLACE FUNCTION refresh_loyalty_leaderboard()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY loyalty_leaderboard;
END;
$$ LANGUAGE plpgsql;

-- Grant permissions
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- Print success message
DO $$ 
BEGIN 
  RAISE NOTICE 'User service database initialized successfully!';
  RAISE NOTICE 'Database: dotmx_users';
  RAISE NOTICE 'Tables created: %', (SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public');
  RAISE NOTICE 'Functions created: %', (SELECT COUNT(*) FROM information_schema.routines WHERE routine_schema = 'public');
END $$;

-- Show database statistics
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS size
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;
