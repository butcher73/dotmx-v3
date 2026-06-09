/**
 * DotMX Management API Server
 *
 * Protected API for Alfred Admin Panel
 * Only accessible from alfred.dotmx.xyz (or any origin in development)
 */

import { Elysia } from 'elysia';
import { DatabaseService } from '@dotmx/shared';
import { createManagementApp } from '../packages/management/src/routes/app.js';

const PORT = parseInt(process.env.MANAGEMENT_API_PORT ?? process.env.PORT ?? '3004', 10);
const HOST = process.env.HOST ?? '0.0.0.0';
const NODE_ENV = process.env.NODE_ENV ?? 'development';

async function main() {
  console.log('🔐 Starting DotMX Management API Server...');
  console.log(`📍 Environment: ${NODE_ENV}`);

  // Initialize database
  const db = new DatabaseService({
    connection_string: process.env.DATABASE_URL!,
    max_connections: 10,
  });

  // Check database health
  const dbHealthy = await db.healthCheck();
  if (!dbHealthy) {
    console.error('❌ Database health check failed');
    process.exit(1);
  }
  console.log('✅ Database connected');

  // Parse allowed origins from environment
  const allowedOrigins = process.env.MANAGEMENT_ALLOWED_ORIGINS
    ?.split(',')
    .map(o => o.trim()) || ['https://alfred.dotmx.xyz'];

  console.log(`🔒 Allowed origins: ${NODE_ENV === 'development' ? 'ALL (dev mode)' : allowedOrigins.join(', ')}`);

  // Create management app
  const managementApp = createManagementApp({
    db,
    config: {
      allowedOrigins,
      isDevelopment: NODE_ENV === 'development',
      apiKey: process.env.MANAGEMENT_API_KEY
    },
    jwtSecret: process.env.JWT_SECRET!
  });

  // Request timing map for logging
  const requestTimes = new Map<Request, number>();

  // Create main server
  const app = new Elysia()
    .onRequest(({ request, set }) => {
      // Dev logging
      const url = new URL(request.url);
      requestTimes.set(request, Date.now());
      console.log(`[MGMT] → ${request.method} ${url.pathname}`);

      // CORS headers for browser requests (whitelist-based in production)
      const origin = request.headers.get('origin');
      const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3310').split(',');
      if (origin && (NODE_ENV === 'development' || allowedOrigins.includes(origin))) {
        set.headers['Access-Control-Allow-Origin'] = origin;
        set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
        set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Management-API-Key';
        set.headers['Access-Control-Allow-Credentials'] = 'true';
      }
      if (request.method === 'OPTIONS') {
        set.status = 204;
        return new Response(null, { status: 204 });
      }
    })
    .onAfterHandle(({ request, set }) => {
      const url = new URL(request.url);
      const start = requestTimes.get(request) || Date.now();
      const duration = Date.now() - start;
      requestTimes.delete(request);
      console.log(`[MGMT] ← ${request.method} ${url.pathname} ${set.status || 200} (${duration}ms)`);
    })
    .onError(({ request, error, set }) => {
      const url = new URL(request.url);
      const start = requestTimes.get(request) || Date.now();
      const duration = Date.now() - start;
      requestTimes.delete(request);
      console.error(`[MGMT] ✕ ${request.method} ${url.pathname} ${set.status || 500} (${duration}ms) - ${error.message}`);
    })
    .use(managementApp)
    .get('/', () => ({
      service: 'DotMX Management API',
      version: '1.0.0',
      docs: '/api/management/docs'
    }))
    .listen({
      port: PORT,
      hostname: HOST
    });

  console.log(`
╔═══════════════════════════════════════════════════════════╗
║       DotMX Management API Server                         ║
╠═══════════════════════════════════════════════════════════╣
║  🌐 Server: http://${HOST}:${PORT}
║  📚 Swagger: http://${HOST}:${PORT}/api/management/docs
║  🏥 Health: http://${HOST}:${PORT}/api/management/health
╚═══════════════════════════════════════════════════════════╝
  `);

  // Graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down Management API Server...');
    await db.close();
    process.exit(0);
  });

  process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down Management API Server...');
    await db.close();
    process.exit(0);
  });
}

main().catch((error) => {
  console.error('❌ Failed to start Management API Server:', error);
  process.exit(1);
});
