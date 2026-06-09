#!/usr/bin/env tsx
/**
 * Create deposit_addresses table for new schema
 */

import { getDatabase } from '../packages/shared/src/db';

async function createTable() {
  const db = getDatabase();

  console.log('Creating deposit_addresses table...');

  try {
    // Create table
    await db.execute(`
      CREATE TABLE IF NOT EXISTS deposit_addresses (
        id SERIAL PRIMARY KEY,
        user_id UUID NOT NULL,
        chain_id INTEGER NOT NULL REFERENCES chains(id),
        address VARCHAR(255) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        UNIQUE(user_id, chain_id)
      )
    `);

    console.log('✅ Table created');

    // Create indexes
    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_deposit_addresses_user_id ON deposit_addresses(user_id)
    `);
    console.log('✅ Index on user_id created');

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_deposit_addresses_chain_id ON deposit_addresses(chain_id)
    `);
    console.log('✅ Index on chain_id created');

    await db.execute(`
      CREATE INDEX IF NOT EXISTS idx_deposit_addresses_address ON deposit_addresses(address)
    `);
    console.log('✅ Index on address created');

    console.log('\n✅ deposit_addresses table created successfully!');
  } catch (error) {
    console.error('❌ Error creating table:', error);
    process.exit(1);
  } finally {
    process.exit(0);
  }
}

createTable();
