/**
 * Database Service
 * PostgreSQL connection and query methods
 */

import { Pool, type PoolClient, type QueryResult, Client } from 'pg';

export interface DatabaseConfig {
  connection_string: string;
  max_connections?: number;
  idle_timeout?: number;
  connection_timeout?: number;
}

export class DatabaseService {
  private pool: Pool;
  private dbName: string;

  constructor(config: DatabaseConfig) {
    // Extract database name from connection string
    const dbNameMatch = config.connection_string.match(/\/([^/?]+)(\?|$)/);
    this.dbName = dbNameMatch ? dbNameMatch[1] : '';

    this.pool = new Pool({
      connectionString: config.connection_string,
      max: config.max_connections || 20,
      idleTimeoutMillis: config.idle_timeout || 30000,
      connectionTimeoutMillis: config.connection_timeout || 10000,
    });

    // Handle pool errors
    this.pool.on('error', (err) => {
      console.error('Unexpected database pool error:', err);
    });

    // Auto-create database if not exists
    this.ensureDatabase(config.connection_string).catch(err => {
      console.error('Failed to ensure database exists:', err);
    });
  }

  /**
   * Ensure database exists, create if not
   */
  private async ensureDatabase(connectionString: string): Promise<void> {
    if (!this.dbName) return;

    // Parse connection string to connect to postgres database
    const adminConnectionString = connectionString.replace(/\/[^/?]+(\?|$)/, '/postgres$1');
    const adminClient = new Client({ connectionString: adminConnectionString });

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
        console.log(`✓ Created database: ${this.dbName}`);
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
   * Execute a query with parameters
   */
  async execute(
    query: string,
    params?: any[]
  ): Promise<void> {
    await this.pool.query(query, params);
  }

  /**
   * Query and return all results
   */
  async query<T = any>(
    query: string,
    params?: any[]
  ): Promise<T[]> {
    const result = await this.pool.query(query, params);
    return result.rows as T[];
  }

  /**
   * Query and return first result
   */
  async queryOne<T = any>(
    query: string,
    params?: any[]
  ): Promise<T | null> {
    const result = await this.pool.query(query, params);
    return (result.rows[0] as T) || null;
  }

  /**
   * Execute in transaction
   */
  async transaction<T>(
    callback: (client: PoolClient) => Promise<T>
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
   * Get pool statistics
   */
  getStats() {
    return {
      total: this.pool.totalCount,
      idle: this.pool.idleCount,
      waiting: this.pool.waitingCount,
    };
  }

  /**
   * Close all connections
   */
  async close(): Promise<void> {
    await this.pool.end();
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<boolean> {
    try {
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      console.error('Database health check failed:', error);
      return false;
    }
  }

  /**
   * Run migrations from a directory of numbered SQL files.
   * Files must follow the pattern: NNN_name.sql (e.g., 001_users.sql)
   * Already-executed migrations are skipped.
   */
  async runMigrations(migrationsDir?: string): Promise<{ applied: string[]; skipped: string[] }> {
    const { readdirSync, readFileSync } = await import('fs');
    const { join, resolve } = await import('path');

    // Create migrations table if not exists
    await this.execute(`
      CREATE TABLE IF NOT EXISTS migrations (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      )
    `);

    // Resolve migrations directory
    const dir = migrationsDir
      ? resolve(migrationsDir)
      : resolve(import.meta.dir, '../../../../scripts/db/migrations');

    // Read and sort migration files
    let files: string[];
    try {
      files = readdirSync(dir)
        .filter((f: string) => f.endsWith('.sql'))
        .sort();
    } catch {
      console.warn(`Migrations directory not found: ${dir}`);
      return { applied: [], skipped: [] };
    }

    // Get already-executed migrations
    const executed = await this.query<{ name: string }>(
      'SELECT name FROM migrations ORDER BY name'
    );
    const executedSet = new Set(executed.map((r) => r.name));

    const applied: string[] = [];
    const skipped: string[] = [];

    for (const file of files) {
      const name = file.replace(/\.sql$/, '');

      if (executedSet.has(name)) {
        skipped.push(name);
        continue;
      }

      const sql = readFileSync(join(dir, file), 'utf-8');

      await this.transaction(async (client) => {
        await client.query(sql);
        await client.query(
          'INSERT INTO migrations (name) VALUES ($1)',
          [name]
        );
      });

      applied.push(name);
      console.log(`✓ Applied migration: ${name}`);
    }

    if (applied.length === 0) {
      console.log('No new migrations to apply.');
    } else {
      console.log(`Applied ${applied.length} migration(s).`);
    }

    return { applied, skipped };
  }
}
