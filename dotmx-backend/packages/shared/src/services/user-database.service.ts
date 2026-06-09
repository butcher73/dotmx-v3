// @ts-nocheck
/**
 * User Database Service
 * Manages connection to the separate user service database
 */

import { Pool, type PoolConfig, type QueryResult, Client } from 'pg';

export class UserDatabaseService {
  private pool: Pool;
  private static instance: UserDatabaseService;
  private dbName: string;

  constructor(config?: PoolConfig) {
    const dbConfig: PoolConfig = config || {
      host: process.env.DB_HOST || 'localhost',
      port: parseInt(process.env.DB_PORT || '5432'),
      database: process.env.USER_DB_NAME || 'dotmx_users',
      user: process.env.DB_USER || 'kowito',
      password: process.env.DB_PASSWORD || '',
      max: parseInt(process.env.USER_DB_POOL_SIZE || '20'),
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };

    this.dbName = dbConfig.database || 'dotmx_users';
    this.pool = new Pool(dbConfig);

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected error on idle user database client', err);
    });

    // Auto-create database if not exists
    this.ensureDatabase(dbConfig).catch(err => {
      console.error('Failed to ensure user database exists:', err);
    });
  }

  /**
   * Ensure database exists, create if not
   */
  private async ensureDatabase(config: PoolConfig): Promise<void> {
    const adminConfig = { ...config, database: 'postgres' };
    const adminClient = new Client(adminConfig);

    try {
      await adminClient.connect();
      
      // Check if database exists
      const result = await adminClient.query(
        'SELECT 1 FROM pg_database WHERE datname = $1',
        [this.dbName]
      );

      if (result.rows.length === 0) {
        // Create database
        await adminClient.query(`CREATE DATABASE "${this.dbName}"`);
        console.log(`✓ Created user database: ${this.dbName}`);
      }
    } catch (error) {
      // Ignore errors if database already exists or we don't have permission
      if (error instanceof Error && !error.message.includes('already exists')) {
        console.warn(`Could not ensure database ${this.dbName} exists:`, error.message);
      }
    } finally {
      await adminClient.end();
    }
  }

  /**
   * Get singleton instance
   */
  static getInstance(config?: PoolConfig): UserDatabaseService {
    if (!UserDatabaseService.instance) {
      UserDatabaseService.instance = new UserDatabaseService(config);
    }
    return UserDatabaseService.instance;
  }

  /**
   * Execute a query and return all rows
   */
  async query<T = any>(text: string, params?: any[]): Promise<T[]> {
    const client = await this.pool.connect();
    try {
      const result: QueryResult<T> = await client.query(text, params);
      return result.rows;
    } finally {
      client.release();
    }
  }

  /**
   * Execute a query and return first row
   */
  async queryOne<T = any>(text: string, params?: any[]): Promise<T | null> {
    const rows = await this.query<T>(text, params);
    return rows.length > 0 ? rows[0] : null;
  }

  /**
   * Execute a query without returning rows
   */
  async execute(text: string, params?: any[]): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query(text, params);
    } finally {
      client.release();
    }
  }

  /**
   * Execute a transaction
   */
  async transaction<T>(
    callback: (client: any) => Promise<T>
  ): Promise<T> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const result = await callback(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Check database connection
   */
  async ping(): Promise<boolean> {
    try {
      await this.queryOne('SELECT 1');
      return true;
    } catch (error) {
      console.error('User database ping failed:', error);
      return false;
    }
  }

  /**
   * Get pool statistics
   */
  getPoolStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }
}
