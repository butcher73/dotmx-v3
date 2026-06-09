/**
 * PostgreSQL Test Database Helper
 * Manages test database setup, teardown, and seeding
 */

import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const { Client } = pg;

export class TestDatabase {
  private client: pg.Client | null = null;
  private pool: pg.Pool | null = null;
  private dbType: 'exchange' | 'user';

  constructor(dbType: 'exchange' | 'user' = 'user') {
    this.dbType = dbType;
  }

  async connect() {
    // Use environment variables if available, otherwise use defaults
    const database = this.dbType === 'user'
      ? (process.env.TEST_USER_DB_NAME || 'dotmx_users_test')
      : (process.env.TEST_EXCHANGE_DB_NAME || 'dotmx_test');
    
    const config = {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      user: process.env.DB_USER || 'kowito',
      password: process.env.DB_PASSWORD || '',
      database,
    };

    this.client = new Client(config);
    await this.client.connect();
    console.log(`✓ Connected to test database: ${config.database}`);
  }

  async setupDatabase() {
    if (!this.client) throw new Error('Database not connected');

    // Check if schema already exists by looking for the users table
    const result = await this.client.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name = 'users'
      ) as exists
    `);
    
    if (result.rows[0]?.exists) {
      console.log('✓ Schema already exists, skipping setup');
      return;
    }

    console.log('Setting up test database schema...');

    // Load and execute main schema - ORDER MATTERS!
    // user_service_schema.sql must load first (contains users table)
    // fee_tier_schema.sql references users table so must load after
    const schemaFiles = [
      'user_service_schema.sql',
      'schema.sql',
      'fee_tier_schema.sql',
      'perpetual_fee_schema.sql'
    ];

    for (const schemaFile of schemaFiles) {
      const schemaPath = join(__dirname, 'db', schemaFile);
      if (existsSync(schemaPath)) {
        console.log(`  Loading schema: ${schemaFile}`);
        await this.executeSQL(schemaPath);
      }
    }

    console.log('✓ Schema setup complete');
  }

  async seedTestData() {
    if (!this.client) throw new Error('Database not connected');

    console.log('Seeding test data...');

    // Load initial data files
    const seedFiles = [
      'init_fee_tiers.sql',
      'init_perpetual_fees.sql',
      'test_seed_data.sql'
    ];

    for (const seedFile of seedFiles) {
      const seedPath = join(__dirname, 'db', seedFile);
      if (existsSync(seedPath)) {
        console.log(`  Loading seed data: ${seedFile}`);
        await this.executeSQL(seedPath);
      }
    }

    console.log('✓ Test data seeded successfully');
  }

  private async executeSQL(filePath: string) {
    if (!this.client) throw new Error('Database not connected');

    const sql = readFileSync(filePath, 'utf-8');
    
    // Smart split: handle $$ delimited functions
    const statements: string[] = [];
    let current = '';
    let inDollarQuote = false;
    
    for (let i = 0; i < sql.length; i++) {
      const char = sql[i];
      const next = sql[i + 1];
      
      // Check for $$ delimiter
      if (char === '$' && next === '$') {
        inDollarQuote = !inDollarQuote;
        current += '$$';
        i++; // Skip next $
        continue;
      }
      
      // If we hit a semicolon outside of $$, that's a statement boundary
      if (char === ';' && !inDollarQuote) {
        const stmt = current.trim();
        if (stmt.length > 0 && !stmt.startsWith('--')) {
          statements.push(stmt);
        }
        current = '';
      } else {
        current += char;
      }
    }
    
    // Add last statement if any
    const lastStmt = current.trim();
    if (lastStmt.length > 0 && !lastStmt.startsWith('--')) {
      statements.push(lastStmt);
    }

    for (const statement of statements) {
      try {
        // Skip CREATE EXTENSION if it fails (might already exist)
        if (statement.includes('CREATE EXTENSION')) {
          try {
            await this.client.query(statement);
          } catch (e) {
            // Ignore extension already exists errors
            if ((e as any).code !== '42710' && (e as any).code !== 'X42710') {
              throw e;
            }
          }
        } else {
          await this.client.query(statement);
        }
      } catch (e) {
        // Ignore duplicate key errors, table/index/trigger already exists errors during initialization
        // Also ignore "relation does not exist" for COMMENT statements since they are optional
        const ignoredCodes = ['23505', '42P07', '42710'];
        const isCommentStatement = statement.trim().toUpperCase().startsWith('COMMENT');
        const isRelationNotExist = (e as any).code === '42P01';
        
        if (isCommentStatement && isRelationNotExist) {
          // COMMENT on non-existent table is ok, just skip
          continue;
        }
        
        if (!ignoredCodes.includes((e as any).code)) {
          console.error('Failed to execute statement:', statement.substring(0, 100));
          console.error('Error:', (e as any).message);
          throw e;
        }
      }
    }
  }

  async clearDatabase() {
    if (!this.client) throw new Error('Database not connected');

    // Reference/config tables that should not be truncated
    const preserveTables = new Set([
      'retail_vip_tiers',
      'institutional_vip_tiers',
      'fee_tiers',
      'perpetual_fee_tiers',
      'market_maker_tiers',
      'dmx_fee_discount_config',
      'profit_multiplier_tiers',
    ]);

    // Get all tables and truncate them (except reference tables)
    const result = await this.client.query(`
      SELECT tablename FROM pg_tables 
      WHERE schemaname = 'public'
    `);

    for (const row of result.rows) {
      if (preserveTables.has(row.tablename)) {
        continue; // Skip reference tables
      }
      try {
        await this.client.query(`TRUNCATE TABLE "${row.tablename}" CASCADE;`);
      } catch (e) {
        // Continue on error
      }
    }

    // Ensure reference tables have data (might have been truncated in previous runs)
    await this.ensureReferenceTables();
  }

  /**
   * Ensure reference tables have their initial data
   * This is idempotent - won't duplicate data if already exists
   */
  async ensureReferenceTables() {
    if (!this.client) throw new Error('Database not connected');

    // Check if retail_vip_tiers is empty
    const vipResult = await this.client.query('SELECT COUNT(*) as count FROM retail_vip_tiers');
    if (parseInt(vipResult.rows[0].count) === 0) {
      // Re-seed retail_vip_tiers from user_service_schema.sql INSERT
      const schemaPath = join(__dirname, 'db', 'user_service_schema.sql');
      if (existsSync(schemaPath)) {
        const sql = readFileSync(schemaPath, 'utf-8');
        // Extract only the INSERT INTO retail_vip_tiers statement
        const insertMatch = sql.match(/INSERT INTO retail_vip_tiers[^;]+;/s);
        if (insertMatch) {
          await this.client.query(insertMatch[0]);
        }
      }
    }

    // Check if fee_tiers is empty
    try {
      const feeResult = await this.client.query('SELECT COUNT(*) as count FROM fee_tiers');
      if (parseInt(feeResult.rows[0].count) === 0) {
        const seedPath = join(__dirname, 'db', 'init_fee_tiers.sql');
        if (existsSync(seedPath)) {
          await this.executeSQL(seedPath);
        }
      }
    } catch (e) {
      // fee_tiers table might not exist
    }

    // Check if perpetual_fee_tiers is empty
    try {
      const perpResult = await this.client.query('SELECT COUNT(*) as count FROM perpetual_fee_tiers');
      if (parseInt(perpResult.rows[0].count) === 0) {
        const seedPath = join(__dirname, 'db', 'init_perpetual_fees.sql');
        if (existsSync(seedPath)) {
          await this.executeSQL(seedPath);
        }
      }
    } catch (e) {
      // perpetual_fee_tiers table might not exist
    }

    // Check if dmx_fee_discount_config is empty
    try {
      const dmxResult = await this.client.query('SELECT COUNT(*) as count FROM dmx_fee_discount_config');
      if (parseInt(dmxResult.rows[0].count) === 0) {
        // Insert default DMX fee discount config (25% discount)
        await this.client.query(`
          INSERT INTO dmx_fee_discount_config (
            discount_percentage, is_enabled, min_dmx_balance, 
            auto_convert_enabled, stackable_with_vip, 
            description, effective_from
          ) VALUES (
            0.25, true, 0, true, true, 
            'DMX token fee discount - 25%', NOW()
          )
        `);
      }
    } catch (e) {
      // dmx_fee_discount_config table might not exist
    }

    // Check if profit_multiplier_tiers is empty
    try {
      const profitResult = await this.client.query('SELECT COUNT(*) as count FROM profit_multiplier_tiers');
      if (parseInt(profitResult.rows[0].count) === 0) {
        // Insert default profit multiplier tiers
        await this.client.query(`
          INSERT INTO profit_multiplier_tiers (tier_name, min_profit_percentage, max_profit_percentage, multiplier, consecutive_days_required, description) VALUES
          ('no_bonus', -999999, 0, 1.00, 1, 'No profit or loss'),
          ('small_profit', 0.01, 2, 1.10, 1, 'Small daily profit (0.01% - 2%)'),
          ('medium_profit', 2.01, 5, 1.25, 1, 'Medium daily profit (2% - 5%)'),
          ('high_profit', 5.01, 10, 1.50, 1, 'High daily profit (5% - 10%)'),
          ('exceptional_profit', 10.01, 999999, 2.00, 1, 'Exceptional daily profit (>10%)'),
          ('consistent_winner_3d', 0.01, 999999, 1.30, 3, '3 consecutive days of profit'),
          ('consistent_winner_7d', 0.01, 999999, 1.60, 7, '7 consecutive days of profit'),
          ('consistent_winner_30d', 0.01, 999999, 2.50, 30, '30 consecutive days of profit')
          ON CONFLICT (tier_name) DO NOTHING
        `);
      }
    } catch (e) {
      // profit_multiplier_tiers table might not exist
    }
  }

  getClient(): pg.Client {
    if (!this.client) throw new Error('Database not connected');
    return this.client;
  }

  async disconnect() {
    if (this.client) {
      await this.client.end();
      this.client = null;
    }
  }

  async query(text: string, values?: any[]) {
    if (!this.client) throw new Error('Database not connected');
    return this.client.query(text, values);
  }
}

/**
 * Create test database and ensure it exists
 */
export async function ensureTestDatabase(dbType: 'exchange' | 'user' = 'user') {
  const adminClient = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432'),
    user: process.env.DB_USER || 'kowito',
    password: process.env.DB_PASSWORD || '',
    database: 'postgres', // Connect to default database
  });

  try {
    await adminClient.connect();

    const dbName = dbType === 'user'
      ? (process.env.TEST_USER_DB_NAME || 'dotmx_users_test')
      : (process.env.TEST_EXCHANGE_DB_NAME || 'dotmx_test');

    // Check if database exists
    const result = await adminClient.query(
      `SELECT 1 FROM pg_database WHERE datname = $1`,
      [dbName]
    );

    if (result.rows.length === 0) {
      // Create database
      await adminClient.query(`CREATE DATABASE "${dbName}";`);
      console.log(`✓ Created test database: ${dbName}`);
    } else {
      console.log(`✓ Test database already exists: ${dbName}`);
    }
  } finally {
    await adminClient.end();
  }
}
