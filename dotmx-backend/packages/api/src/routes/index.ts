/**
 * REST API Routes
 *
 * HTTP endpoints for order management and market data.
 * Uses Elysia for high-performance routing.
 * Note: CORS is handled by Kong API Gateway.
 */

import { Elysia, t } from "elysia";
import { swagger } from "@elysiajs/swagger";
import type { GatewayAdapter } from "@dotmx/gateway";

// Export auth routes
export { createAuthRoutes } from "./auth.routes";

// Export asset routes
export { createAssetRoutes } from "./assets.routes";

// Export custodial wallet routes
export { createCustodialWalletRoutes, createAdminCustodialWalletRoutes } from "./wallet.routes";

// Export webhook routes
export { createWebhooksRoutes } from "./webhooks.routes";

// Export v1 routes
export { marketDataRoutes, createMarketDataRoutes } from "./marketdata";
export { tradingRoutes, createTradingRoutes } from "./trading";

// Export new route creators
export { createPositionRoutes } from "./positions.routes";
export { createAdvancedTradingRoutes } from "./trading-advanced.routes";
export { createPerpetualMarketRoutes } from "./perpetual-market.routes";
export { createWebhookSubscriptionRoutes } from "./webhook-subscriptions.routes";
export { createExportRoutes } from "./export.routes";

/**
 * Create order routes
 */
export function createOrderRoutes(gateway: GatewayAdapter) {
  return new Elysia({ prefix: "/orders" })
    .post(
      "/",
      async ({ body }) => {
        const result = await gateway.placeOrder({
          userId: body.userId,
          symbol: body.symbol,
          side: body.side,
          type: body.type,
          price: body.price,
          quantity: body.quantity,
          timeInForce: body.timeInForce,
          stopPrice: body.stopPrice,
          clientOrderId: body.clientOrderId,
          takeProfit: body.takeProfit,
          stopLoss: body.stopLoss,
        });

        if (result.success && result.orderId) {
          return { orderId: result.orderId };
        } else {
          return { error: result.error ?? "Unknown error" };
        }
      },
      {
        body: t.Object({
          userId: t.String({ description: "User ID" }),
          symbol: t.String({ description: "Trading pair symbol (e.g., BTC-USDT)" }),
          side: t.Union([t.Literal("BUY"), t.Literal("SELL")], { description: "Order side" }),
          type: t.Union([t.Literal("LIMIT"), t.Literal("MARKET"), t.Literal("STOP_LIMIT"), t.Literal("STOP_MARKET")], { description: "Order type" }),
          price: t.Optional(t.Number({ description: "Limit price (required for LIMIT orders)" })),
          quantity: t.Number({ description: "Order quantity" }),
          timeInForce: t.Optional(
            t.Union([t.Literal("GTC"), t.Literal("IOC"), t.Literal("FOK"), t.Literal("POST_ONLY")], { 
              description: "Time in force: GTC, IOC, FOK, POST_ONLY" 
            })
          ),
          stopPrice: t.Optional(t.Number({ description: "Stop trigger price (required for STOP_LIMIT / STOP_MARKET)" })),
          clientOrderId: t.Optional(t.String()),
          takeProfit: t.Optional(t.Number({ description: "Take profit price" })),
          stopLoss: t.Optional(t.Number({ description: "Stop loss price" })),
        }),
        response: t.Union([
          t.Object({ orderId: t.String() }),
          t.Object({ error: t.String() }),
        ]),
        detail: {
          tags: ["orders"],
          summary: "Place a new order",
          description: "Submit a new buy or sell order to the matching engine",
        },
      }
    )
    .delete(
      "/:orderId",
      async ({ params, query }) => {
        const result = await gateway.cancelOrder(
          query.symbol,
          params.orderId,
          query.userId
        );

        return { success: result.success, error: result.error };
      },
      {
        params: t.Object({
          orderId: t.String({ description: "Order ID to cancel" }),
        }),
        query: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
          userId: t.String({ description: "User ID" }),
        }),
        detail: {
          tags: ["orders"],
          summary: "Cancel an order",
          description: "Cancel an existing open order",
        },
      }
    )
    .get(
      "/:orderId",
      async ({ params }) => {
        const status = await gateway.getOrderStatus(params.orderId);
        if (status) {
          return status;
        }
        return { error: "Order not found" };
      },
      {
        params: t.Object({
          orderId: t.String({ description: "Order ID" }),
        }),
        detail: {
          tags: ["orders"],
          summary: "Get order status",
          description: "Retrieve the current status of an order",
        },
      }
    );
}

/**
 * Create market data routes
 */
export function createMarketRoutes() {
  // Placeholder for market data integration
  const books = new Map<string, { bids: any[]; asks: any[] }>();

  return new Elysia({ prefix: "/market" })
    .get(
      "/orderbook/:symbol",
      ({ params, query }) => {
        const book = books.get(params.symbol);
        const depth = query.depth ?? 20;

        if (!book) {
          return {
            symbol: params.symbol,
            bids: [],
            asks: [],
            timestamp: Date.now(),
          };
        }

        return {
          symbol: params.symbol,
          bids: book.bids.slice(0, depth),
          asks: book.asks.slice(0, depth),
          timestamp: Date.now(),
        };
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
        }),
        query: t.Object({
          depth: t.Optional(t.Numeric({ description: "Order book depth (default: 20)" })),
        }),
        detail: {
          tags: ["market"],
          summary: "Get order book",
          description: "Retrieve the current order book (bids and asks) for a symbol",
        },
      }
    )
    .get("/symbols", () => {
      return {
        symbols: [
          { symbol: "BTC-USD", status: "TRADING", baseAsset: "BTC", quoteAsset: "USD" },
          { symbol: "ETH-USD", status: "TRADING", baseAsset: "ETH", quoteAsset: "USD" },
        ],
      };
    }, {
      detail: {
        tags: ["market"],
        summary: "Get all symbols",
        description: "List all available trading pairs",
      },
    })
    .get(
      "/ticker/:symbol",
      ({ params }) => {
        // Placeholder
        return {
          symbol: params.symbol,
          lastPrice: 0,
          priceChange24h: 0,
          volume24h: 0,
          high24h: 0,
          low24h: 0,
          timestamp: Date.now(),
        };
      },
      {
        params: t.Object({
          symbol: t.String({ description: "Trading pair symbol" }),
        }),
        detail: {
          tags: ["market"],
          summary: "Get ticker for symbol",
          description: "Get 24-hour price statistics for a specific symbol",
        },
      }
    )
    .get("/tickers", () => {
      return {
        tickers: [],
      };
    }, {
      detail: {
        tags: ["market"],
        summary: "Get all tickers",
        description: "Get 24-hour price statistics for all symbols",
      },
    });
}

/**
 * Create health routes
 */
export function createHealthRoutes() {
  return new Elysia({ prefix: "/health" })
    .get("/", () => ({
      status: "ok",
      timestamp: Date.now(),
    }), {
      detail: {
        tags: ["health"],
        summary: "Health check",
        description: "Basic health check endpoint",
      },
    })
    .get("/ready", () => ({
      ready: true,
      services: {
        engine: true,
        database: true,
        redis: true,
      },
    }), {
      detail: {
        tags: ["health"],
        summary: "Readiness check",
        description: "Check if all services are ready to accept traffic",
      },
    })
    .get("/live", () => ({
      live: true,
    }), {
      detail: {
        tags: ["health"],
        summary: "Liveness check",
        description: "Check if the service is alive",
      },
    });
}

/**
 * Create main API application
 */
export function createApiApp(gateway: GatewayAdapter) {
  return new Elysia()
    .use(
      swagger({
        documentation: {
          info: {
            title: "DotMX Exchange API",
            version: "1.0.0",
            description: "High-performance perpetual futures exchange with Binance-style fee structure",
            contact: {
              name: "DotMX Team",
              url: "https://dotmx.xyz",
            },
          },
          tags: [
            { name: "health", description: "Health check endpoints" },
            { name: "orders", description: "Order management endpoints" },
            { name: "market", description: "Market data endpoints" },
          ],
          servers: [
            {
              url: "http://localhost:3000",
              description: "Development server",
            },
            {
              url: "https://api.dotmx.xyz",
              description: "Production server",
            },
          ],
        },
      })
    )
    .get("/", () => ({
      name: "DotMX Exchange API",
      version: "1.0.0",
    }), {
      detail: {
        tags: ["health"],
        summary: "Get API information",
        description: "Returns basic information about the DotMX API",
      }
    })
    .use(createHealthRoutes())
    .use(createOrderRoutes(gateway))
    .use(createMarketRoutes());
}
