#!/usr/bin/env bun
/**
 * Update Admin Password Script
 * 
 * Usage: bun scripts/update-admin-password.ts <new-password>
 * 
 * Or run without args for interactive mode
 */

import { DatabaseService } from '@dotmx/shared';

const NEW_PASSWORD = process.argv[2] || 'Admin@123!';
const ADMIN_EMAIL = process.argv[3] || 'admin@dotmx.xyz';

async function main() {
  console.log('🔐 Updating admin password...\n');
  
  const db = new DatabaseService({
    connection_string: process.env.DATABASE_URL || 'postgresql://dotmx:dotmx@localhost:5432/dotmx',
    max_connections: 5,
  });

  try {
    // Check if admin exists
    const existingAdmin = await db.query<{ id: string; email: string }>(
      `SELECT id, email FROM users WHERE email = $1`,
      [ADMIN_EMAIL]
    );

    if (existingAdmin.length === 0) {
      console.log(`⚠️  Admin user ${ADMIN_EMAIL} not found. Creating...`);
      
      // Hash password
      const passwordHash = await Bun.password.hash(NEW_PASSWORD, {
        algorithm: 'argon2id',
        memoryCost: 65536,
        timeCost: 3,
      });

      // Create admin user
      await db.query(
        `INSERT INTO users (
          email, password_hash, role, first_name, last_name, 
          email_verified, status, created_at, updated_at
        ) VALUES (
          $1, $2, 'admin', 'Admin', 'User',
          true, 'active', NOW(), NOW()
        )`,
        [ADMIN_EMAIL, passwordHash]
      );
      
      console.log(`✅ Created admin user: ${ADMIN_EMAIL}`);
    } else {
      console.log(`📧 Found admin: ${ADMIN_EMAIL}`);
      
      // Hash new password
      const passwordHash = await Bun.password.hash(NEW_PASSWORD, {
        algorithm: 'argon2id',
        memoryCost: 65536,
        timeCost: 3,
      });

      // Update password
      await db.query(
        `UPDATE users SET password_hash = $1, updated_at = NOW() WHERE email = $2`,
        [passwordHash, ADMIN_EMAIL]
      );
      
      console.log(`✅ Password updated for: ${ADMIN_EMAIL}`);
    }

    console.log(`\n🔑 New credentials:`);
    console.log(`   Email:    ${ADMIN_EMAIL}`);
    console.log(`   Password: ${NEW_PASSWORD}`);
    console.log(`\n📍 Login at: http://localhost:3310/login`);
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
  
  process.exit(0);
}

main();
