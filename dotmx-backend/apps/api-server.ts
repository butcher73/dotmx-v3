/**
 * API Server Entry Point
 *
 * Starts the REST + WebSocket API server.
 *
 * ⚠️  WARNING: This server has NO authentication.
 * Use api-server-with-auth.ts for production deployments.
 */

// Safety guard: prevent accidental unauthenticated deployment
if (!process.env.ALLOW_UNAUTHENTICATED_API) {
  console.error('❌ UNAUTHENTICATED API SERVER IS DISABLED.');
  console.error('   This legacy server has no authentication.');
  console.error('   Use api-server-with-auth.ts for production.');
  console.error('   Set ALLOW_UNAUTHENTICATED_API=true to force start (dev only).');
  process.exit(1);
}

import { Elysia } from "elysia";
import { createApiApp, createWsApp } from "@dotmx/api";
import { createGatewayAdapter, createMemoryCommandBus, createShardRouter } from "@dotmx/gateway";
import { createMemoryFanout } from "@dotmx/marketdata";

const PORT = parseInt(process.env.PORT ?? "3003", 10);
const HOST = process.env.HOST ?? "0.0.0.0";

async function main() {
  console.log("🚀 Starting DotMX API Server...");

  // Initialize dependencies
  const commandBus = createMemoryCommandBus();
  const router = createShardRouter({ numShards: 4, virtualNodes: 100 });
  const gateway = createGatewayAdapter(commandBus, router);
  const fanout = createMemoryFanout();

  // Create combined app
  const app = new Elysia()
    .use(createApiApp(gateway))
    .use(createWsApp(gateway, fanout))
    .listen({ port: PORT, hostname: HOST });

  console.log(`✅ API Server running at http://${HOST}:${PORT}`);
  console.log(`📡 WebSocket endpoints:`);
  console.log(`   - ws://${HOST}:${PORT}/ws/market (market data)`);
  console.log(`   - ws://${HOST}:${PORT}/ws/user (user updates)`);

  // Graceful shutdown
  const shutdown = async () => {
    console.log("\n🛑 Shutting down...");
    await commandBus.close();
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("❌ Failed to start API server:", err);
  process.exit(1);
});
