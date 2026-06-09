/**
 * E2E Test Server Setup
 * 
 * Starts a real API server for E2E testing with test database
 */

import { Elysia } from 'elysia';
import { createApiApp, createWsApp, createAuthRoutes, marketDataRoutes, tradingRoutes } from '@dotmx/api';
import { createGatewayAdapter, createMemoryCommandBus, createShardRouter } from '@dotmx/gateway';
import { createMemoryFanout } from '@dotmx/marketdata';
import {
  DatabaseService,
  AuthService,
  WalletAuthService,
  authPlugin,
} from '@dotmx/shared/auth';

// Test server configuration
const TEST_PORT = parseInt(process.env.E2E_TEST_PORT ?? '3099', 10);
const TEST_HOST = '127.0.0.1';
const TEST_DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://dotmx:dotmx@localhost:5432/dotmx_users_test';

export interface TestServer {
  app: Elysia;
  server: any;
  db: DatabaseService;
  authService: AuthService;
  walletAuthService: WalletAuthService;
  baseUrl: string;
  wsUrl: string;
  stop: () => Promise<void>;
}

let testServerInstance: TestServer | null = null;

/**
 * Start a real API server for E2E testing
 * Uses singleton pattern - returns existing instance if already running
 */
export async function startTestServer(): Promise<TestServer> {
  // Return existing instance if already running
  if (testServerInstance) {
    return testServerInstance;
  }

  console.log('🚀 Starting E2E Test Server...');

  // Initialize database
  const db = new DatabaseService({
    connection_string: TEST_DATABASE_URL,
    max_connections: 5,
  });

  // Check database health
  const dbHealthy = await db.healthCheck();
  if (!dbHealthy) {
    throw new Error('E2E Test Database health check failed. Make sure dotmx_users_test exists.');
  }

  // Initialize authentication services
  const authService = new AuthService(db, {
    jwt_secret: 'e2e-test-jwt-secret-key-very-long-and-secure',
    jwt_access_expiry: 900,
    jwt_refresh_expiry: 604800,
    password_min_length: 8,
    password_require_uppercase: true,
    password_require_lowercase: true,
    password_require_number: true,
    password_require_special: true,
    max_failed_login_attempts: 5,
    account_lock_duration: 1800,
  });

  const walletAuthService = new WalletAuthService(db, authService);

  // Initialize gateway dependencies
  const commandBus = createMemoryCommandBus();
  const router = createShardRouter({ numShards: 4, virtualNodes: 100 });
  const gateway = createGatewayAdapter(commandBus, router);
  const fanout = createMemoryFanout();

  // Create Elysia app with full production-like setup
  const app = new Elysia()
    // Note: CORS, logging, and error handling are managed by Kong API Gateway
    // Note: Don't apply global authPlugin here - let each route set apply its own
    // to avoid Elysia plugin naming conflicts

    // Root endpoint
    .get('/', () => ({
      name: 'DotMX Exchange API (E2E Test)',
      version: '1.0.0',
      environment: 'test',
    }))

    // Health check
    .get('/health', async () => {
      const dbHealth = await db.healthCheck();
      return {
        status: dbHealth ? 'healthy' : 'unhealthy',
        services: { database: dbHealth ? 'up' : 'down' },
        timestamp: new Date().toISOString(),
      };
    })

    // Auth routes
    .use(createAuthRoutes(db, authService, walletAuthService))

    // Trading API routes (both /orders/ and /v1/ prefixes)
    .use(createApiApp(gateway))
    .use(marketDataRoutes)
    .use(tradingRoutes)
    
    // WebSocket routes
    .use(createWsApp(gateway, fanout));

  // Start server
  const server = app.listen({ port: TEST_PORT, hostname: TEST_HOST });

  const baseUrl = `http://${TEST_HOST}:${TEST_PORT}`;
  const wsUrl = `ws://${TEST_HOST}:${TEST_PORT}`;

  console.log(`✅ E2E Test Server running at ${baseUrl}`);

  testServerInstance = {
    app,
    server,
    db,
    authService,
    walletAuthService,
    baseUrl,
    wsUrl,
    stop: async () => {
      // Don't actually stop - let the process exit handle cleanup
      // This prevents issues with multiple describe blocks sharing the server
    },
  };

  return testServerInstance;
}

/**
 * Force stop the test server - only call at very end
 */
export async function forceStopTestServer(): Promise<void> {
  if (testServerInstance) {
    console.log('🛑 Force Stopping E2E Test Server...');
    testServerInstance.server.stop();
    await testServerInstance.db.close();
    testServerInstance = null;
  }
}

/**
 * Stop the test server if running
 */
export async function stopTestServer(): Promise<void> {
  if (testServerInstance) {
    await testServerInstance.stop();
  }
}

/**
 * Get the current test server instance
 */
export function getTestServer(): TestServer | null {
  return testServerInstance;
}

/**
 * Generate a unique test email
 */
export function generateTestEmail(): string {
  return `e2e-test-${Date.now()}-${Math.random().toString(36).substring(7)}@test.local`;
}

/**
 * Generate a valid test password
 */
export function generateTestPassword(): string {
  return 'TestP@ssword123!';
}
