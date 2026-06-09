/**
 * Example: Integrating Authentication with API Server
 *
 * This file shows how to integrate the authentication system
 * into the DotMX API server.
 */

import { Elysia } from "elysia";
import { createApiApp } from "@dotmx/api";
import { createGatewayAdapter, createMemoryCommandBus, createShardRouter } from "@dotmx/gateway";
import { createMemoryFanout } from "@dotmx/marketdata";

// Import authentication services
import {
  DatabaseService,
  AuthService,
  WalletAuthService,
  authPlugin,
  apiKeyPlugin,
} from "@dotmx/shared/auth";

import { createTradeSettlementService } from "@dotmx/shared";

// Import custodial wallet services
import {
  GCPKMSService,
  createGCPKMSService,
  HDWalletService,
  createHDWalletService,
  SweeperService,
  createSweeperService,
  WithdrawalService,
  createWithdrawalService,
  AlchemyWebhookService,
  DepositConfirmationService,
  createDepositConfirmationService,
} from "@dotmx/shared";



// Import auth routes and wallet routes
import {
  createAuthRoutes,
  createAssetRoutes,
  createCustodialWalletRoutes,
  createAdminCustodialWalletRoutes,
  createWebhooksRoutes,
  createPositionRoutes,
  createAdvancedTradingRoutes,
  createTradingRoutes,
  createPerpetualMarketRoutes,
  createWebhookSubscriptionRoutes,
  createExportRoutes,
  createMarketDataRoutes,
} from "@dotmx/api";

const PORT = parseInt(process.env.PORT ?? "3003", 10);
const HOST = process.env.HOST ?? "0.0.0.0";
const NODE_ENV = process.env.NODE_ENV || "development";

async function main() {
  console.log("🚀 Starting DotMX API Server with Authentication...");

  // Initialize database
  const db = new DatabaseService({
    connection_string: process.env.DATABASE_URL!,
    max_connections: 20,
  });

  // Check database health
  const dbHealthy = await db.healthCheck();
  if (!dbHealthy) {
    console.error("❌ Database health check failed");
    process.exit(1);
  }
  console.log("✅ Database connected");

  // Initialize authentication services
  const authService = new AuthService(db, {
    jwt_secret: process.env.JWT_SECRET!,
    jwt_access_expiry: parseInt(process.env.JWT_ACCESS_EXPIRY || "900", 10),
    jwt_refresh_expiry: parseInt(process.env.JWT_REFRESH_EXPIRY || "604800", 10),
    password_min_length: parseInt(process.env.PASSWORD_MIN_LENGTH || "8", 10),
    password_require_uppercase: process.env.PASSWORD_REQUIRE_UPPERCASE !== "false",
    password_require_lowercase: process.env.PASSWORD_REQUIRE_LOWERCASE !== "false",
    password_require_number: process.env.PASSWORD_REQUIRE_NUMBER !== "false",
    password_require_special: process.env.PASSWORD_REQUIRE_SPECIAL !== "false",
    max_failed_login_attempts: parseInt(process.env.MAX_FAILED_LOGIN_ATTEMPTS || "5", 10),
    account_lock_duration: parseInt(process.env.ACCOUNT_LOCK_DURATION || "1800", 10),
  });

  const walletAuthService = new WalletAuthService(db, authService);

  // Initialize custodial wallet services (GCP KMS + HD Wallet)
  let kmsService: GCPKMSService | null = null;
  let alchemyWebhookService: AlchemyWebhookService | null = null;
  let confirmationService: DepositConfirmationService | null = null;
  let hdWalletService: HDWalletService | null = null;
  let sweeperService: SweeperService | null = null;
  let withdrawalService: WithdrawalService | null = null;

  // Check for required GCP KMS configuration
  const kmsConfigured = process.env.GCP_PROJECT_ID && process.env.GCP_KMS_LOCATION && process.env.GCP_KMS_KEYRING;

  if (!kmsConfigured) {
    console.error("❌ GCP KMS configuration is REQUIRED for wallet operations.");
    console.error("   Please set the following environment variables:");
    console.error("   - GCP_PROJECT_ID");
    console.error("   - GCP_KMS_LOCATION");
    console.error("   - GCP_KMS_KEYRING");
    console.error("   - GCP_KMS_KEY_NAME (optional, defaults to 'master-seed-kek')");
    console.error("");
    console.error("   For local development, also set GOOGLE_APPLICATION_CREDENTIALS");
    console.error("   to point to your service account key file.");
    console.error("");
    console.error("   Run scripts/deploy/setup-gcp-kms.sh to create the KMS resources.");
    // Continue server startup but wallet endpoints will return 503
  }

  if (kmsConfigured) {
    try {
      kmsService = createGCPKMSService(db, {
        project_id: process.env.GCP_PROJECT_ID,
        location: process.env.GCP_KMS_LOCATION,
        key_ring: process.env.GCP_KMS_KEYRING,
        key_name: process.env.GCP_KMS_KEY_NAME || 'master-seed-kek',
      });

      hdWalletService = createHDWalletService(db, kmsService);

      const walletHealthy = await hdWalletService.healthCheck();
      if (walletHealthy.healthy) {
        console.log("✅ HD Wallet service initialized");
      } else {
        console.warn("⚠️  HD Wallet service initialized but unhealthy:", walletHealthy.message);
      }

      withdrawalService = createWithdrawalService(db, hdWalletService, {
        default_fee_rate: parseFloat(process.env.WITHDRAWAL_FEE_RATE || '0.001'),
        min_withdrawal: process.env.MIN_WITHDRAWAL || '0.001',
        auto_approve_threshold: process.env.AUTO_APPROVE_THRESHOLD || '1000',
      });

      // Initialize Alchemy webhook service for deposit detection
      alchemyWebhookService = new AlchemyWebhookService(db, {
        apiKey: process.env.ALCHEMY_API_KEY,
      });

      // Initialize deposit confirmation service (lightweight polling)
      confirmationService = createDepositConfirmationService(db, {
        pollIntervalMs: parseInt(process.env.CONFIRMATION_POLL_MS || '30000', 10),
        maxDepositsPerBatch: parseInt(process.env.CONFIRMATION_BATCH_SIZE || '100', 10),
        maxAgeHours: parseInt(process.env.CONFIRMATION_MAX_AGE_HOURS || '48', 10),
      });

      // Start confirmation checker
      confirmationService.start();
      console.log("✅ Deposit confirmation service started");

      sweeperService = createSweeperService(db, hdWalletService, {
        sweep_interval_ms: parseInt(process.env.SWEEP_INTERVAL_MS || '60000', 10),
        min_sweep_amount: process.env.MIN_SWEEP_AMOUNT || '0.001',
        gas_buffer_multiplier: parseFloat(process.env.GAS_BUFFER_MULTIPLIER || '1.2'),
      });

      // Start sweeper if auto-start is enabled
      if (process.env.AUTO_START_SWEEPER === 'true') {
        sweeperService.start();
        console.log("✅ Sweeper service started");
      } else {
        console.log("📢 Sweeper service ready (manual start via admin API)");
      }
    } catch (error) {
      console.error("❌ Failed to initialize custodial wallet services:", (error as Error).message);
      console.error("   Wallet endpoints will return 503 until this is resolved.");
    }
  }

  // Initialize gateway dependencies
  const commandBus = createMemoryCommandBus();
  const router = createShardRouter({ numShards: 4, virtualNodes: 100 });
  const settlementService = createTradeSettlementService(db);
  const gateway = createGatewayAdapter(commandBus, router, settlementService);
  const fanout = createMemoryFanout();

  // Create Elysia app with authentication
  const app = new Elysia()
    .onRequest(({ request, set }) => {
      // Dev logging
      if (NODE_ENV === 'development') {
        const url = new URL(request.url);
        console.log(`[API] → ${request.method} ${url.pathname}`);
        (request as any).__startTime = Date.now();
      }
      // CORS (whitelist-based in production, permissive in dev)
      const origin = request.headers.get('origin');
      const allowedOrigins = (process.env.CORS_ORIGINS || 'http://localhost:3000').split(',');
      if (origin && (NODE_ENV === 'development' || allowedOrigins.includes(origin))) {
        set.headers['Access-Control-Allow-Origin'] = origin;
        set.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, PATCH, DELETE, OPTIONS';
        set.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-API-Key';
        set.headers['Access-Control-Allow-Credentials'] = 'true';
      }
      if (request.method === 'OPTIONS') {
        set.status = 204;
        return new Response(null, { status: 204 });
      }
    })
    .onAfterHandle(({ request, set }) => {
      if (NODE_ENV === 'development') {
        const url = new URL(request.url);
        const duration = Date.now() - ((request as any).__startTime || Date.now());
        console.log(`[API] ← ${request.method} ${url.pathname} ${set.status || 200} (${duration}ms)`);
      }
    })
    .onError(({ request, error, set }) => {
      if (NODE_ENV === 'development') {
        const url = new URL(request.url);
        const duration = Date.now() - ((request as any).__startTime || Date.now());
        console.error(`[API] ✕ ${request.method} ${url.pathname} ${set.status || 500} (${duration}ms) - ${error.message}`);
      }
    })
    .use(authPlugin(db, authService))
    .use(apiKeyPlugin(db))

    // Root endpoint
    .get("/", () => ({
      name: "DotMX Exchange API",
      version: "2.0.0",
      authentication: "enabled",
      endpoints: {
        auth: "/auth/*",
        trading: "/v1/*",
        health: "/health",
      },
    }))

    // Health check
    .get("/health", async () => {
      const dbHealth = await db.healthCheck();
      const walletHealth = hdWalletService ? await hdWalletService.healthCheck() : null;

      return {
        status: dbHealth ? "healthy" : "unhealthy",
        services: {
          database: dbHealth ? "up" : "down",
          custodial_wallet: walletHealth
            ? walletHealth.healthy ? "up" : "degraded"
            : "disabled",
          sweeper: sweeperService
            ? (await sweeperService.getStatus()).is_running ? "running" : "stopped"
            : "disabled",
        },
        timestamp: new Date().toISOString(),
      };
    })

    // Symbols endpoint - fetch trading pairs from database
    .get("/symbols", async () => {
      try {
        const pairs = await db.query<{
          symbol: string;
          base_currency: string;
          quote_currency: string;
          status: string;
          tick_size: string;
          lot_size: string;
          min_order_size: string;
          max_order_size: string | null;
          maker_fee: string;
          taker_fee: string;
        }>(
          `SELECT symbol, base_currency, quote_currency, status,
                  tick_size, lot_size, min_order_size, max_order_size,
                  maker_fee, taker_fee
           FROM trading_pairs
           WHERE status = 'active'
           ORDER BY display_order, symbol`
        );
        return {
          symbols: (pairs ?? []).map((p) => ({
            symbol: p.symbol,
            baseAsset: p.base_currency,
            quoteAsset: p.quote_currency,
            status: p.status?.toUpperCase() ?? 'ACTIVE',
            minOrderSize: p.min_order_size,
            maxOrderSize: p.max_order_size,
            tickSize: p.tick_size,
            lotSize: p.lot_size,
            makerFee: p.maker_fee,
            takerFee: p.taker_fee,
          })),
        };
      } catch (error) {
        console.error("Failed to fetch symbols:", error);
        return { symbols: [] };
      }
    })

    // Authentication routes
    .use(createAuthRoutes(db, authService, walletAuthService))

    // Webhook routes (must be before auth - webhooks are authenticated via signature)
    .use(createWebhooksRoutes(db))

    // Asset routes (deposits, withdrawals, balances) - pass hdWalletService for proper address generation
    .use(createAssetRoutes(db, authService, hdWalletService, alchemyWebhookService))

    // Custodial wallet routes (if configured)
    .use(
      hdWalletService && withdrawalService && kmsService
        ? createCustodialWalletRoutes(db, authService, kmsService, hdWalletService, withdrawalService, alchemyWebhookService || undefined)
        : new Elysia()
    )
    .use(
      hdWalletService && withdrawalService && sweeperService
        ? createAdminCustodialWalletRoutes(db, authService, hdWalletService, withdrawalService, sweeperService)
        : new Elysia()
    )

    // Position & Portfolio routes
    .use(createPositionRoutes(db, undefined, gateway, settlementService))

    // Advanced trading routes (leverage, batch, modify)
    .use(createAdvancedTradingRoutes(db, gateway, settlementService))

    // Core trading routes (orders, cancel, status, open orders, trades)
    .use(createTradingRoutes(db, gateway, authService))

    // Market data routes (orderbook depth, 24h ticker)
    .use(createMarketDataRoutes(db))

    // Perpetual market data routes (funding, mark price, liquidations)
    .use(createPerpetualMarketRoutes(db))

    // Webhook subscription routes (outbound user notifications)
    .use(createWebhookSubscriptionRoutes(db, authService))

    // Historical data export routes (CSV/JSON)
    .use(createExportRoutes(db, authService))

    // Trading API routes (with authentication)
    .group("/v1", (app) =>
      app
        // Example: Protected trading endpoint
        .get(
          "/orders",
          async ({ user, api_key_user }) => {
            const currentUser = user || api_key_user;
            if (!currentUser) {
              return { error: "Authentication required" };
            }

            // Get user's orders from gateway
            try {
              // Import gateway functions
              const { getUserOrders } = await import('@dotmx/gateway');
              const orders = await getUserOrders(currentUser.id);

              return {
                user_id: currentUser.id,
                orders,
              };
            } catch (error) {
              console.error('Failed to fetch orders:', error);
              return {
                user_id: currentUser.id,
                orders: [],
                error: 'Failed to fetch orders',
              };
            }
          },
          {
            beforeHandle: ({ user, api_key_user, set }) => {
              if (!user && !api_key_user) {
                set.status = 401;
                throw new Error("Authentication required");
              }
            },
          }
        )

        // Example: Public market data endpoint
        .get("/market/:symbol", async ({ params }) => {
          try {
            // Import market data functions
            const { getSymbolData } = await import('@dotmx/marketdata');
            const marketData = await getSymbolData(params.symbol);

            return {
              symbol: params.symbol,
              ...marketData,
            };
          } catch (error) {
            console.error('Failed to fetch market data:', error);
            return {
              symbol: params.symbol,
              error: 'Failed to fetch market data',
            };
          }
        })
    )

    // Start server
    .listen({ port: PORT, hostname: HOST });

  console.log(`✅ API Server running at http://${HOST}:${PORT}`);
  console.log(`📡 Authentication endpoints:`);
  console.log(`   - POST http://${HOST}:${PORT}/auth/register`);
  console.log(`   - POST http://${HOST}:${PORT}/auth/login`);
  console.log(`   - POST http://${HOST}:${PORT}/auth/wallet/challenge`);
  console.log(`   - POST http://${HOST}:${PORT}/auth/wallet/verify`);
  console.log(`   - GET  http://${HOST}:${PORT}/auth/me (protected)`);
  console.log(`📈 Trading endpoints:`);
  console.log(`   - GET  http://${HOST}:${PORT}/v1/orders`);
  console.log(`   - GET  http://${HOST}:${PORT}/v1/positions`);
  console.log(`   - GET  http://${HOST}:${PORT}/v1/portfolio`);
  console.log(`   - POST http://${HOST}:${PORT}/v1/orders/leverage`);
  console.log(`   - POST http://${HOST}:${PORT}/v1/orders/batch`);
  console.log(`📊 Market Data endpoints:`);
  console.log(`   - GET  http://${HOST}:${PORT}/v1/market/funding-rates`);
  console.log(`   - GET  http://${HOST}:${PORT}/v1/market/mark-prices`);
  console.log(`   - GET  http://${HOST}:${PORT}/v1/market/liquidations`);

  if (hdWalletService && withdrawalService) {
    console.log(`📦 Custodial Wallet endpoints:`);
    console.log(`   - GET  http://${HOST}:${PORT}/wallet/chains`);
    console.log(`   - POST http://${HOST}:${PORT}/wallet/deposit-address`);
    console.log(`   - GET  http://${HOST}:${PORT}/wallet/deposit-addresses`);
    console.log(`   - GET  http://${HOST}:${PORT}/wallet/balances`);
    console.log(`   - GET  http://${HOST}:${PORT}/wallet/deposits`);
    console.log(`   - POST http://${HOST}:${PORT}/wallet/withdraw`);
    console.log(`   - GET  http://${HOST}:${PORT}/wallet/withdrawals`);
    console.log(`🔐 Admin Wallet endpoints:`);
    console.log(`   - GET  http://${HOST}:${PORT}/admin/wallet/status`);
    console.log(`   - POST http://${HOST}:${PORT}/admin/wallet/withdrawals/batch`);
    console.log(`   - GET  http://${HOST}:${PORT}/admin/wallet/withdrawals/batch/:id/export`);
    console.log(`   - POST http://${HOST}:${PORT}/admin/wallet/sweeper/start`);
  }

  console.log(`📖 Documentation: http://${HOST}:${PORT}/docs/AUTHENTICATION.md`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down...");

    // Stop sweeper first
    if (sweeperService) {
      sweeperService.stop();
      console.log("   - Sweeper stopped");
    }

    await commandBus.close();
    await db.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("❌ Failed to start API server:", err);
  process.exit(1);
});
