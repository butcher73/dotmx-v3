#!/usr/bin/env bun
/**
 * Test Database Connection and Seeding Script
 * Creates test database, sets up schema, and seeds test data
 */

import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Get the directory of the current module
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = resolve(__dirname, '..');

// Import after setting up paths
const { TestDatabase, ensureTestDatabase } = await import(resolve(projectRoot, 'packages/shared/src/test-db-helper.ts'));

async function main() {
  console.log('🧪 Testing Database Connection and Seeding\n');

  try {
    // Step 1: Ensure test database exists
    console.log('Step 1: Ensuring test database exists...');
    await ensureTestDatabase();
    console.log('');

    // Step 2: Connect to test database
    console.log('Step 2: Connecting to test database...');
    const testDb = new TestDatabase();
    await testDb.connect();
    console.log('');

    // Step 3: Setup schema
    console.log('Step 3: Setting up database schema...');
    await testDb.setupDatabase();
    console.log('');

    // Step 4: Seed test data
    console.log('Step 4: Seeding test data...');
    await testDb.seedTestData();
    console.log('');

    // Step 5: Verify data
    console.log('Step 5: Verifying test data...');
    const users = await testDb.query('SELECT id, username, email, role FROM users ORDER BY created_at');
    console.log(`  Found ${users.rows.length} users:`);
    users.rows.forEach((user: any) => {
      console.log(`    - ${user.username} (${user.email}) - Role: ${user.role}`);
    });
    console.log('');

    // Step 6: Check tables
    console.log('Step 6: Checking database tables...');
    const tables = await testDb.query(`
      SELECT tablename 
      FROM pg_tables 
      WHERE schemaname = 'public' 
      ORDER BY tablename
    `);
    console.log(`  Found ${tables.rows.length} tables:`);
    tables.rows.forEach((table: any, index: number) => {
      console.log(`    ${index + 1}. ${table.tablename}`);
    });
    console.log('');

    // Disconnect
    await testDb.disconnect();

    console.log('✅ All tests passed! Test database is ready.');
    console.log('\nYou can now run your tests with: bun test');

  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

main();
