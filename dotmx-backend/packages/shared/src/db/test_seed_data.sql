-- Test Database Seed Data
-- This file contains sample data for testing purposes

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Clear existing test data (if any)
TRUNCATE TABLE IF EXISTS 
  user_sessions,
  wallet_addresses,
  refresh_tokens,
  password_reset_tokens,
  email_verification_tokens,
  users
CASCADE;

-- Insert test users
INSERT INTO users (id, email, email_verified, password_hash, username, role, status, created_at, updated_at)
VALUES 
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    'testuser1@example.com',
    true,
    crypt('TestPassword123!', gen_salt('bf', 10)),
    'testuser1',
    'user',
    'active',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002'::uuid,
    'testuser2@example.com',
    true,
    crypt('TestPassword123!', gen_salt('bf', 10)),
    'testuser2',
    'user',
    'active',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000003'::uuid,
    'admin@example.com',
    true,
    crypt('AdminPassword123!', gen_salt('bf', 10)),
    'admin',
    'admin',
    'active',
    NOW(),
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000004'::uuid,
    'trader@example.com',
    true,
    crypt('TraderPassword123!', gen_salt('bf', 10)),
    'trader1',
    'user',
    'active',
    NOW(),
    NOW()
  )
ON CONFLICT (id) DO NOTHING;

-- Insert test wallet addresses
INSERT INTO wallet_addresses (user_id, wallet_address, blockchain, is_primary, verified, created_at)
VALUES 
  (
    '00000000-0000-0000-0000-000000000001'::uuid,
    '0x1234567890123456789012345678901234567890',
    'ethereum',
    true,
    true,
    NOW()
  ),
  (
    '00000000-0000-0000-0000-000000000002'::uuid,
    '0x2234567890123456789012345678901234567891',
    'ethereum',
    true,
    true,
    NOW()
  )
ON CONFLICT DO NOTHING;

-- Note: Additional seed data can be added here as needed
-- Examples: test orders, test balances, test transactions, etc.

SELECT 'Test database seeded successfully with ' || COUNT(*) || ' users' 
FROM users 
WHERE id IN (
  '00000000-0000-0000-0000-000000000001'::uuid,
  '00000000-0000-0000-0000-000000000002'::uuid,
  '00000000-0000-0000-0000-000000000003'::uuid,
  '00000000-0000-0000-0000-000000000004'::uuid
);
