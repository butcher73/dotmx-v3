/**
 * Management API Application Factory
 *
 * Creates the complete Management API Elysia application
 * CORS is handled by Kong API Gateway
 */

import { Elysia } from 'elysia';
import { swagger } from '@elysiajs/swagger';
import type { DatabaseService } from '@dotmx/shared';
import type { ManagementApiConfig } from '../types';
import {
  managementApiKeyPlugin,
  adminAuthPlugin
} from '../middleware';
import { createDashboardRoutes } from './dashboard.routes';
import { createUsersRoutes } from './users.routes';
import { createTransactionsRoutes } from './transactions.routes';
import { createKycRoutes } from './kyc.routes';
import { createTradingPairsRoutes } from './trading-pairs.routes';
import { createAuditLogRoutes } from './audit-log.routes';
import { createSettingsRoutes } from './settings.routes';
import { createAuthRoutes } from './auth.routes';
import { createChainsRoutes } from './chains.routes';
import { createTokensRoutes } from './tokens.routes';
import { createDepositsWithdrawalsRoutes } from './deposits-withdrawals.routes';
import { createCircuitBreakerRoutes } from './circuit-breaker.routes';
import { createMetricsRoutes } from './metrics.routes';
import { createWithdrawalLimitsRoutes } from './withdrawal-limits.routes';
import { createAlertRoutes } from './alerts.routes';

export interface CreateManagementAppOptions {
  db: DatabaseService;
  config: ManagementApiConfig;
  jwtSecret: string;
}

/**
 * Create the Management API application
 */
export function createManagementApp(options: CreateManagementAppOptions) {
  const { db, config, jwtSecret } = options;

  const app = new Elysia({ prefix: '/api/management' })
    // Swagger documentation
    .use(
      swagger({
        documentation: {
          info: {
            title: 'DotMX Management API',
            version: '1.0.0',
            description: 'Internal management API for Alfred Admin Panel. Protected API - only accessible from authorized origins.'
          },
          tags: [
            { name: 'dashboard', description: 'Dashboard statistics' },
            { name: 'users', description: 'User management' },
            { name: 'transactions', description: 'Transaction management' },
            { name: 'deposits-withdrawals', description: 'Deposits, withdrawals, and sweeper monitoring' },
            { name: 'kyc', description: 'KYC application management' },
            { name: 'trading-pairs', description: 'Trading pair configuration' },
            { name: 'chains', description: 'Blockchain chain management' },
            { name: 'tokens', description: 'Token management' },
            { name: 'audit-logs', description: 'Audit log viewing' },
            { name: 'settings', description: 'Platform settings' },
            { name: 'circuit-breaker', description: 'Market circuit breaker management' },
            { name: 'metrics', description: 'System metrics and monitoring' },
            { name: 'withdrawal-limits', description: 'Withdrawal limit management' },
            { name: 'alerts', description: 'Alert configuration and history' }
          ]
        },
        path: '/docs'
      })
    )

    // API key authentication for service-to-service calls
    .use(managementApiKeyPlugin(config.apiKey || ''))

    // Admin authentication
    .use(adminAuthPlugin(db, jwtSecret))

    // Health check (unprotected)
    .get('/health', () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'management-api'
    }))

    // Test chains route directly (protected)
    .guard({ requireAdmin: true }, (app) =>
      app.get('/chains-test', () => ({
        test: 'chains route works directly'
      }), {
        detail: {
          tags: ['chains'],
          summary: 'Test chains',
          description: 'Test if chains tag works'
        }
      })
    )

    // Auth routes (unprotected)
    .use(createAuthRoutes(db, jwtSecret))

    // Protected routes (require admin authentication)
    .guard({ requireAdmin: true }, (app) =>
      app
        .use(createDashboardRoutes(db))
        .use(createUsersRoutes(db))
        .use(createTransactionsRoutes(db))
        .use(createDepositsWithdrawalsRoutes(db))
        .use(createChainsRoutes(db))
        .use(createTokensRoutes(db))
        .use(createKycRoutes(db))
        .use(createTradingPairsRoutes(db))
        .use(createAuditLogRoutes(db))
        .use(createSettingsRoutes(db))
        .use(createCircuitBreakerRoutes(db))
        .use(createMetricsRoutes(db))
        .use(createWithdrawalLimitsRoutes(db))
        .use(createAlertRoutes(db))
    );

  return app;
}
