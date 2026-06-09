/**
 * API Server Entry Point
 * 
 * Note: Rate limiting, CORS, and IP filtering are handled by Kong API Gateway.
 * This keeps the application focused on business logic.
 */

import { Elysia } from "elysia";
import { tradingRoutes } from "./routes/trading";
import { marketDataRoutes } from "./routes/marketdata";

const app = new Elysia()
  .use(tradingRoutes)
  .use(marketDataRoutes)
  .get("/health", () => ({ status: "ok", timestamp: Date.now() }))
  .listen(process.env.PORT || 3001);

console.log(`🚀 DotMX API running at http://localhost:${app.server?.port}`);

export { app };
