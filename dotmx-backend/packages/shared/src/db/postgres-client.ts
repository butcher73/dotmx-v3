// @ts-nocheck
/**
 * PostgreSQL Database Client Wrapper
 * Provides convenient methods for database operations
 */

import type { Client, Pool, QueryResult } from 'pg';

export type PgConnection = Client | Pool;

/**
 * PostgreSQL database wrapper with convenient query methods
 */
export class PostgresDB {
  private client: PgConnection;

  constructor(client: PgConnection) {
    this.client = client;
  }

  /**
   * Execute a query and return the first row
   */
  async queryOne<T = any>(sql: string, params: any[] = []): Promise<T | null> {
    const result = await this.client.query(sql, params);
    return result.rows[0] || null;
  }

  /**
   * Execute a query and return all rows
   */
  async queryAll<T = any>(sql: string, params: any[] = []): Promise<T[]> {
    const result = await this.client.query(sql, params);
    return result.rows;
  }

  /**
   * Execute a query without returning results (for INSERT/UPDATE/DELETE)
   */
  async execute(sql: string, params: any[] = []): Promise<void> {
    await this.client.query(sql, params);
  }

  /**
   * Execute a raw query and return the full result
   */
  async query<T = any>(sql: string, params: any[] = []): Promise<QueryResult<T>> {
    return this.client.query(sql, params);
  }

  /**
   * Get the underlying pg client
   */
  getClient(): PgConnection {
    return this.client;
  }
}

/**
 * Create a PostgresDB instance from a pg client
 */
export function createPostgresDB(client: PgConnection): PostgresDB {
  return new PostgresDB(client);
}
