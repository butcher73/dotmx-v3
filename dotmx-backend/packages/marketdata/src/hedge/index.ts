/**
 * Delta Hedging Engine (A-Book Model)
 *
 * Hedges user positions on external exchanges (Bitget) to:
 * 1. Remain delta neutral (no market risk)
 * 2. Profit from fee spread (user fees > hedge fees)
 *
 * Business Model:
 * - User pays 0.05% taker fee on DotMX
 * - DotMX hedges on Bitget VIP at 0.02%
 * - Profit = 0.03% per hedged volume
 *
 * Hedging Strategies:
 * - Real-time: Hedge every trade immediately
 * - Threshold: Hedge when net exposure exceeds threshold
 * - Batched: Aggregate and hedge at intervals
 */

import { createHmac } from "crypto";

// =============================================================================
// TYPES
// =============================================================================

export interface Position {
  symbol: string;
  size: number; // Positive = long, Negative = short
  avgEntryPrice: number;
  unrealizedPnl: number;
  margin: number;
  leverage: number;
  timestamp: number;
}

export interface HedgeOrder {
  orderId: string;
  clientOrderId: string;
  symbol: string;
  side: "buy" | "sell";
  size: number;
  price: number;
  orderType: "market" | "limit";
  status: "pending" | "filled" | "partial" | "cancelled" | "failed";
  filledSize: number;
  avgFillPrice: number;
  fee: number;
  feeCurrency: string;
  timestamp: number;
  exchange: string;
}

export interface NetExposure {
  symbol: string;
  userLongSize: number;
  userShortSize: number;
  netSize: number; // userLong - userShort (positive = users are net long)
  hedgeSize: number; // Our hedge position (should be opposite of netSize)
  unhedgedSize: number; // netSize + hedgeSize (should be ~0)
  notionalValue: number;
  lastPrice: number;
  timestamp: number;
}

export interface HedgeStats {
  symbol: string;
  totalHedgeVolume: number;
  totalHedgeFees: number;
  totalUserFees: number;
  netProfit: number;
  hedgeCount: number;
  avgHedgeSize: number;
  lastHedgeTime: number;
}

export interface HedgeDecision {
  shouldHedge: boolean;
  symbol: string;
  side: "buy" | "sell";
  size: number;
  reason: string;
  urgency: "low" | "medium" | "high";
}

export type HedgeEventHandler = (event: HedgeEvent) => void;

export type HedgeEvent =
  | { type: "exposure_update"; data: NetExposure }
  | { type: "hedge_triggered"; data: HedgeDecision }
  | { type: "hedge_executed"; data: HedgeOrder }
  | { type: "hedge_failed"; data: { symbol: string; error: string } }
  | { type: "position_sync"; data: Position }
  | { type: "pnl_update"; data: HedgeStats };

// =============================================================================
// CONFIGURATION
// =============================================================================

export interface HedgeEngineConfig {
  /** Hedging strategy */
  strategy: "realtime" | "threshold" | "batched";

  /** Minimum size to hedge (in base currency) */
  minHedgeSize: number;

  /** Threshold for threshold strategy (in quote currency notional) */
  exposureThreshold: number;

  /** Batch interval for batched strategy (ms) */
  batchIntervalMs: number;

  /** Max position size per symbol (risk limit) */
  maxPositionSize: number;

  /** Use market or limit orders */
  orderType: "market" | "limit";

  /** Limit order offset from mid (in %) for limit orders */
  limitOrderOffset: number;

  /** Retry failed hedges */
  retryAttempts: number;

  /** Retry delay (ms) */
  retryDelayMs: number;

  /** Sync positions interval (ms) */
  positionSyncIntervalMs: number;
}

export const defaultHedgeConfig: HedgeEngineConfig = {
  strategy: "threshold",
  minHedgeSize: 0.001, // Min 0.001 BTC
  exposureThreshold: 10000, // Hedge when exposure > $10k
  batchIntervalMs: 5000, // 5 second batches
  maxPositionSize: 100, // Max 100 BTC per symbol
  orderType: "market",
  limitOrderOffset: 0.01, // 0.01% from mid
  retryAttempts: 3,
  retryDelayMs: 1000,
  positionSyncIntervalMs: 30000, // Sync every 30s
};

// =============================================================================
// BITGET API CLIENT
// =============================================================================

export interface BitgetCredentials {
  apiKey: string;
  apiSecret: string;
  passphrase: string;
}

export interface BitgetClientConfig {
  baseUrl: string;
  credentials: BitgetCredentials;
  productType: "USDT-FUTURES" | "COIN-FUTURES" | "USDC-FUTURES";
}

export const defaultBitgetClientConfig: Partial<BitgetClientConfig> = {
  baseUrl: "https://api.bitget.com",
  productType: "USDT-FUTURES",
};

/**
 * Bitget Futures API Client for hedging
 */
export function createBitgetHedgeClient(config: BitgetClientConfig) {
  const { baseUrl, credentials, productType } = config;

  function generateSignature(
    timestamp: string,
    method: string,
    path: string,
    body: string = ""
  ): string {
    const message = timestamp + method.toUpperCase() + path + body;
    return createHmac("sha256", credentials.apiSecret)
      .update(message)
      .digest("base64");
  }

  async function request<T>(
    method: "GET" | "POST" | "DELETE",
    path: string,
    params?: Record<string, unknown>
  ): Promise<T> {
    const timestamp = Date.now().toString();
    let fullPath = path;
    let body = "";

    if (method === "GET" && params) {
      const searchParams = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        searchParams.append(k, String(v));
      }
      fullPath = `${path}?${searchParams.toString()}`;
    } else if (params) {
      body = JSON.stringify(params);
    }

    const signature = generateSignature(timestamp, method, fullPath, body);

    const headers: Record<string, string> = {
      "ACCESS-KEY": credentials.apiKey,
      "ACCESS-SIGN": signature,
      "ACCESS-TIMESTAMP": timestamp,
      "ACCESS-PASSPHRASE": credentials.passphrase,
      "Content-Type": "application/json",
      locale: "en-US",
    };

    const response = await fetch(`${baseUrl}${fullPath}`, {
      method,
      headers,
      body: method !== "GET" ? body : undefined,
    });

    const data = await response.json() as { code: string; msg: string; data: T };

    if (data.code !== "00000") {
      throw new Error(`Bitget API Error: ${data.msg} (${data.code})`);
    }

    return data.data;
  }

  // Symbol mapping: DotMX -> Bitget
  function toBitgetSymbol(symbol: string): string {
    // "BTC-USDT" -> "BTCUSDT"
    return symbol.replace(/-/g, "");
  }

  return {
    /**
     * Get account balance
     */
    async getBalance(): Promise<{
      available: number;
      equity: number;
      unrealizedPnl: number;
    }> {
      const data = await request<{ marginCoin: string; available: string; equity: string; unrealizedPL: string }[]>(
        "GET",
        "/api/v2/mix/account/accounts",
        { productType }
      );

      const usdtAccount = data.find((a) => a.marginCoin === "USDT");
      return {
        available: parseFloat(usdtAccount?.available ?? "0"),
        equity: parseFloat(usdtAccount?.equity ?? "0"),
        unrealizedPnl: parseFloat(usdtAccount?.unrealizedPL ?? "0"),
      };
    },

    /**
     * Get current positions
     */
    async getPositions(symbol?: string): Promise<Position[]> {
      const params: Record<string, unknown> = { productType };
      if (symbol) {
        params.symbol = toBitgetSymbol(symbol);
      }

      const data = await request<{
        symbol: string;
        holdSide: string;
        total: string;
        available: string;
        averageOpenPrice: string;
        unrealizedPL: string;
        margin: string;
        leverage: string;
        cTime: string;
      }[]>("GET", "/api/v2/mix/position/all-position", params);

      return data.map((p) => ({
        symbol: symbol ?? p.symbol,
        size: p.holdSide === "long" ? parseFloat(p.total) : -parseFloat(p.total),
        avgEntryPrice: parseFloat(p.averageOpenPrice),
        unrealizedPnl: parseFloat(p.unrealizedPL),
        margin: parseFloat(p.margin),
        leverage: parseFloat(p.leverage),
        timestamp: parseInt(p.cTime, 10),
      }));
    },

    /**
     * Place hedge order
     */
    async placeOrder(
      symbol: string,
      side: "buy" | "sell",
      size: number,
      orderType: "market" | "limit" = "market",
      price?: number
    ): Promise<HedgeOrder> {
      const bitgetSymbol = toBitgetSymbol(symbol);
      const clientOrderId = `hedge_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

      const params: Record<string, unknown> = {
        symbol: bitgetSymbol,
        productType,
        marginMode: "crossed",
        marginCoin: "USDT",
        side: side,
        tradeSide: "open", // or "close" for closing positions
        orderType: orderType,
        size: size.toString(),
        clientOid: clientOrderId,
      };

      if (orderType === "limit" && price) {
        params.price = price.toString();
      }

      const data = await request<{ orderId: string; clientOid: string }>(
        "POST",
        "/api/v2/mix/order/place-order",
        params
      );

      return {
        orderId: data.orderId,
        clientOrderId: data.clientOid,
        symbol,
        side,
        size,
        price: price ?? 0,
        orderType,
        status: "pending",
        filledSize: 0,
        avgFillPrice: 0,
        fee: 0,
        feeCurrency: "USDT",
        timestamp: Date.now(),
        exchange: "bitget",
      };
    },

    /**
     * Get order status
     */
    async getOrder(symbol: string, orderId: string): Promise<HedgeOrder> {
      const bitgetSymbol = toBitgetSymbol(symbol);

      const data = await request<{
        orderId: string;
        clientOid: string;
        side: string;
        size: string;
        price: string;
        orderType: string;
        state: string;
        baseVolume: string;
        priceAvg: string;
        fee: string;
        feeCcy: string;
        cTime: string;
      }>("GET", "/api/v2/mix/order/detail", {
        symbol: bitgetSymbol,
        productType,
        orderId,
      });

      const statusMap: Record<string, HedgeOrder["status"]> = {
        live: "pending",
        partially_filled: "partial",
        filled: "filled",
        cancelled: "cancelled",
      };

      return {
        orderId: data.orderId,
        clientOrderId: data.clientOid,
        symbol,
        side: data.side as "buy" | "sell",
        size: parseFloat(data.size),
        price: parseFloat(data.price),
        orderType: data.orderType as "market" | "limit",
        status: statusMap[data.state] ?? "pending",
        filledSize: parseFloat(data.baseVolume),
        avgFillPrice: parseFloat(data.priceAvg),
        fee: parseFloat(data.fee),
        feeCurrency: data.feeCcy,
        timestamp: parseInt(data.cTime, 10),
        exchange: "bitget",
      };
    },

    /**
     * Cancel order
     */
    async cancelOrder(symbol: string, orderId: string): Promise<boolean> {
      const bitgetSymbol = toBitgetSymbol(symbol);

      try {
        await request("POST", "/api/v2/mix/order/cancel-order", {
          symbol: bitgetSymbol,
          productType,
          orderId,
        });
        return true;
      } catch (e) {
        console.error("Failed to cancel order:", e);
        return false;
      }
    },

    /**
     * Get recent trades (for fee tracking)
     */
    async getRecentTrades(symbol: string, limit = 100): Promise<{
      tradeId: string;
      orderId: string;
      price: number;
      size: number;
      side: string;
      fee: number;
      timestamp: number;
    }[]> {
      const bitgetSymbol = toBitgetSymbol(symbol);

      const data = await request<{
        tradeId: string;
        orderId: string;
        price: string;
        size: string;
        side: string;
        fee: string;
        cTime: string;
      }[]>("GET", "/api/v2/mix/order/fills", {
        symbol: bitgetSymbol,
        productType,
        limit,
      });

      return data.map((t) => ({
        tradeId: t.tradeId,
        orderId: t.orderId,
        price: parseFloat(t.price),
        size: parseFloat(t.size),
        side: t.side,
        fee: parseFloat(t.fee),
        timestamp: parseInt(t.cTime, 10),
      }));
    },
  };
}

// =============================================================================
// HEDGE ENGINE
// =============================================================================

export interface HedgeEngine {
  /** Start the hedge engine */
  start(): Promise<void>;

  /** Stop the hedge engine */
  stop(): void;

  /** Update user exposure (called when user trades) */
  onUserTrade(
    symbol: string,
    side: "buy" | "sell",
    size: number,
    price: number,
    fee: number
  ): void;

  /** Get current net exposure */
  getExposure(symbol: string): NetExposure | null;

  /** Get all exposures */
  getAllExposures(): NetExposure[];

  /** Get hedge statistics */
  getStats(symbol: string): HedgeStats | null;

  /** Get all stats */
  getAllStats(): HedgeStats[];

  /** Force hedge for a symbol */
  forceHedge(symbol: string): Promise<HedgeOrder | null>;

  /** Subscribe to hedge events */
  onEvent(handler: HedgeEventHandler): void;

  /** Get hedge positions on exchange */
  getHedgePositions(): Promise<Position[]>;

  /** Get account balance */
  getBalance(): Promise<{ available: number; equity: number }>;
}

export function createHedgeEngine(
  client: ReturnType<typeof createBitgetHedgeClient>,
  config: HedgeEngineConfig = defaultHedgeConfig
): HedgeEngine {
  // State
  const exposures = new Map<string, NetExposure>();
  const hedgePositions = new Map<string, Position>();
  const stats = new Map<string, HedgeStats>();
  const pendingHedges = new Map<string, HedgeOrder>();
  const eventHandlers = new Set<HedgeEventHandler>();

  // Timers
  let batchTimer: Timer | null = null;
  let syncTimer: Timer | null = null;
  let running = false;

  // Emit event
  function emit(event: HedgeEvent) {
    for (const handler of eventHandlers) {
      try {
        handler(event);
      } catch (e) {
        console.error("Hedge event handler error:", e);
      }
    }
  }

  // Get or create exposure
  function getOrCreateExposure(symbol: string): NetExposure {
    let exposure = exposures.get(symbol);
    if (!exposure) {
      exposure = {
        symbol,
        userLongSize: 0,
        userShortSize: 0,
        netSize: 0,
        hedgeSize: 0,
        unhedgedSize: 0,
        notionalValue: 0,
        lastPrice: 0,
        timestamp: Date.now(),
      };
      exposures.set(symbol, exposure);
    }
    return exposure;
  }

  // Get or create stats
  function getOrCreateStats(symbol: string): HedgeStats {
    let stat = stats.get(symbol);
    if (!stat) {
      stat = {
        symbol,
        totalHedgeVolume: 0,
        totalHedgeFees: 0,
        totalUserFees: 0,
        netProfit: 0,
        hedgeCount: 0,
        avgHedgeSize: 0,
        lastHedgeTime: 0,
      };
      stats.set(symbol, stat);
    }
    return stat;
  }

  // Check if should hedge
  function checkHedge(exposure: NetExposure): HedgeDecision {
    const unhedgedNotional = Math.abs(exposure.unhedgedSize * exposure.lastPrice);
    const unhedgedSize = Math.abs(exposure.unhedgedSize);

    // Not enough to hedge
    if (unhedgedSize < config.minHedgeSize) {
      return {
        shouldHedge: false,
        symbol: exposure.symbol,
        side: exposure.unhedgedSize > 0 ? "sell" : "buy",
        size: 0,
        reason: "Below minimum hedge size",
        urgency: "low",
      };
    }

    // Check strategy
    let shouldHedge = false;
    let urgency: HedgeDecision["urgency"] = "low";

    switch (config.strategy) {
      case "realtime":
        shouldHedge = true;
        urgency = "high";
        break;

      case "threshold":
        if (unhedgedNotional >= config.exposureThreshold) {
          shouldHedge = true;
          urgency = unhedgedNotional >= config.exposureThreshold * 2 ? "high" : "medium";
        }
        break;

      case "batched":
        // Handled by timer
        shouldHedge = false;
        break;
    }

    // Determine hedge direction
    // If users are net long (netSize > 0), we need to SHORT to hedge
    // If users are net short (netSize < 0), we need to LONG to hedge
    const hedgeSide: "buy" | "sell" = exposure.unhedgedSize > 0 ? "sell" : "buy";

    return {
      shouldHedge,
      symbol: exposure.symbol,
      side: hedgeSide,
      size: unhedgedSize,
      reason: shouldHedge
        ? `Unhedged exposure $${unhedgedNotional.toFixed(2)} exceeds threshold`
        : `Unhedged exposure $${unhedgedNotional.toFixed(2)} below threshold`,
      urgency,
    };
  }

  // Execute hedge
  async function executeHedge(decision: HedgeDecision): Promise<HedgeOrder | null> {
    if (!decision.shouldHedge || decision.size < config.minHedgeSize) {
      return null;
    }

    // Check if already have pending hedge for this symbol
    if (pendingHedges.has(decision.symbol)) {
      console.log(`Hedge already pending for ${decision.symbol}`);
      return null;
    }

    emit({ type: "hedge_triggered", data: decision });

    let lastError: Error | null = null;

    for (let attempt = 0; attempt < config.retryAttempts; attempt++) {
      try {
        console.log(
          `🔄 Hedging ${decision.symbol}: ${decision.side} ${decision.size} (attempt ${attempt + 1})`
        );

        const order = await client.placeOrder(
          decision.symbol,
          decision.side,
          decision.size,
          config.orderType
        );

        pendingHedges.set(decision.symbol, order);

        // Wait for fill (market orders usually instant)
        await new Promise((r) => setTimeout(r, 500));

        // Check order status
        const filledOrder = await client.getOrder(decision.symbol, order.orderId);
        pendingHedges.delete(decision.symbol);

        if (filledOrder.status === "filled" || filledOrder.status === "partial") {
          console.log(
            `✅ Hedge filled: ${filledOrder.side} ${filledOrder.filledSize} @ ${filledOrder.avgFillPrice}`
          );

          // Update exposure
          const exposure = getOrCreateExposure(decision.symbol);
          if (decision.side === "buy") {
            exposure.hedgeSize += filledOrder.filledSize;
          } else {
            exposure.hedgeSize -= filledOrder.filledSize;
          }
          exposure.unhedgedSize = exposure.netSize + exposure.hedgeSize;
          exposure.timestamp = Date.now();

          // Update stats
          const stat = getOrCreateStats(decision.symbol);
          stat.totalHedgeVolume += filledOrder.filledSize * filledOrder.avgFillPrice;
          stat.totalHedgeFees += filledOrder.fee;
          stat.hedgeCount++;
          stat.avgHedgeSize = stat.totalHedgeVolume / stat.hedgeCount;
          stat.lastHedgeTime = Date.now();
          stat.netProfit = stat.totalUserFees - stat.totalHedgeFees;

          emit({ type: "hedge_executed", data: filledOrder });
          emit({ type: "pnl_update", data: stat });

          return filledOrder;
        }
      } catch (e) {
        lastError = e as Error;
        console.error(`Hedge attempt ${attempt + 1} failed:`, e);
        await new Promise((r) => setTimeout(r, config.retryDelayMs));
      }
    }

    pendingHedges.delete(decision.symbol);
    emit({
      type: "hedge_failed",
      data: {
        symbol: decision.symbol,
        error: lastError?.message ?? "Unknown error",
      },
    });

    return null;
  }

  // Sync positions from exchange
  async function syncPositions() {
    try {
      const positions = await client.getPositions();

      for (const pos of positions) {
        hedgePositions.set(pos.symbol, pos);

        // Update exposure with actual hedge position
        const exposure = exposures.get(pos.symbol);
        if (exposure) {
          exposure.hedgeSize = pos.size;
          exposure.unhedgedSize = exposure.netSize + exposure.hedgeSize;
        }

        emit({ type: "position_sync", data: pos });
      }
    } catch (e) {
      console.error("Failed to sync positions:", e);
    }
  }

  // Batch hedge all symbols
  async function batchHedge() {
    for (const [symbol, exposure] of exposures) {
      const decision = checkHedge(exposure);
      if (decision.shouldHedge) {
        await executeHedge(decision);
      }
    }
  }

  return {
    async start() {
      if (running) return;
      running = true;

      console.log("🚀 Starting Hedge Engine...");

      // Initial position sync
      await syncPositions();

      // Start position sync timer
      syncTimer = setInterval(syncPositions, config.positionSyncIntervalMs);

      // Start batch timer if using batched strategy
      if (config.strategy === "batched") {
        batchTimer = setInterval(batchHedge, config.batchIntervalMs);
      }

      console.log(`✅ Hedge Engine started (strategy: ${config.strategy})`);
    },

    stop() {
      running = false;

      if (batchTimer) {
        clearInterval(batchTimer);
        batchTimer = null;
      }

      if (syncTimer) {
        clearInterval(syncTimer);
        syncTimer = null;
      }

      console.log("🛑 Hedge Engine stopped");
    },

    onUserTrade(
      symbol: string,
      side: "buy" | "sell",
      size: number,
      price: number,
      fee: number
    ) {
      const exposure = getOrCreateExposure(symbol);
      const stat = getOrCreateStats(symbol);

      // Update exposure
      // User buying = they are going long = increases userLongSize
      // User selling = they are going short = increases userShortSize
      if (side === "buy") {
        exposure.userLongSize += size;
      } else {
        exposure.userShortSize += size;
      }

      exposure.netSize = exposure.userLongSize - exposure.userShortSize;
      exposure.unhedgedSize = exposure.netSize + exposure.hedgeSize;
      exposure.lastPrice = price;
      exposure.notionalValue = Math.abs(exposure.netSize * price);
      exposure.timestamp = Date.now();

      // Update stats
      stat.totalUserFees += fee;
      stat.netProfit = stat.totalUserFees - stat.totalHedgeFees;

      emit({ type: "exposure_update", data: exposure });

      // Check if should hedge (for realtime/threshold strategies)
      if (config.strategy !== "batched") {
        const decision = checkHedge(exposure);
        if (decision.shouldHedge) {
          // Execute async, don't block
          executeHedge(decision).catch(console.error);
        }
      }
    },

    getExposure(symbol: string): NetExposure | null {
      return exposures.get(symbol) ?? null;
    },

    getAllExposures(): NetExposure[] {
      return Array.from(exposures.values());
    },

    getStats(symbol: string): HedgeStats | null {
      return stats.get(symbol) ?? null;
    },

    getAllStats(): HedgeStats[] {
      return Array.from(stats.values());
    },

    async forceHedge(symbol: string): Promise<HedgeOrder | null> {
      const exposure = exposures.get(symbol);
      if (!exposure) return null;

      const decision: HedgeDecision = {
        shouldHedge: true,
        symbol,
        side: exposure.unhedgedSize > 0 ? "sell" : "buy",
        size: Math.abs(exposure.unhedgedSize),
        reason: "Manual force hedge",
        urgency: "high",
      };

      return executeHedge(decision);
    },

    onEvent(handler: HedgeEventHandler) {
      eventHandlers.add(handler);
    },

    async getHedgePositions(): Promise<Position[]> {
      return client.getPositions();
    },

    async getBalance() {
      const balance = await client.getBalance();
      return {
        available: balance.available,
        equity: balance.equity,
      };
    },
  };
}

// =============================================================================
// PROFIT CALCULATOR
// =============================================================================

export interface ProfitSummary {
  period: string;
  totalUserVolume: number;
  totalHedgeVolume: number;
  totalUserFees: number;
  totalHedgeFees: number;
  grossProfit: number;
  netProfit: number;
  profitMargin: number;
  avgUserFeeRate: number;
  avgHedgeFeeRate: number;
  feeSpread: number;
  bySymbol: Record<string, HedgeStats>;
}

export function calculateProfitSummary(stats: HedgeStats[]): ProfitSummary {
  let totalUserFees = 0;
  let totalHedgeFees = 0;
  let totalHedgeVolume = 0;
  const bySymbol: Record<string, HedgeStats> = {};

  for (const stat of stats) {
    totalUserFees += stat.totalUserFees;
    totalHedgeFees += stat.totalHedgeFees;
    totalHedgeVolume += stat.totalHedgeVolume;
    bySymbol[stat.symbol] = stat;
  }

  // Estimate user volume (assuming average 0.05% fee)
  const avgUserFeeRate = 0.0005; // 0.05%
  const totalUserVolume = totalUserFees / avgUserFeeRate;

  // Calculate actual hedge fee rate
  const avgHedgeFeeRate = totalHedgeVolume > 0 ? totalHedgeFees / totalHedgeVolume : 0;

  const grossProfit = totalUserFees - totalHedgeFees;

  return {
    period: "all-time",
    totalUserVolume,
    totalHedgeVolume,
    totalUserFees,
    totalHedgeFees,
    grossProfit,
    netProfit: grossProfit, // Could subtract other costs
    profitMargin: totalUserFees > 0 ? (grossProfit / totalUserFees) * 100 : 0,
    avgUserFeeRate: avgUserFeeRate * 100,
    avgHedgeFeeRate: avgHedgeFeeRate * 100,
    feeSpread: (avgUserFeeRate - avgHedgeFeeRate) * 100,
    bySymbol,
  };
}

// =============================================================================
// EXAMPLE USAGE
// =============================================================================

/*
// Initialize Bitget client
const bitgetClient = createBitgetHedgeClient({
  baseUrl: "https://api.bitget.com",
  credentials: {
    apiKey: process.env.BITGET_API_KEY!,
    apiSecret: process.env.BITGET_API_SECRET!,
    passphrase: process.env.BITGET_PASSPHRASE!,
  },
  productType: "USDT-FUTURES",
});

// Create hedge engine
const hedgeEngine = createHedgeEngine(bitgetClient, {
  strategy: "threshold",
  exposureThreshold: 5000, // Hedge when > $5k exposure
  minHedgeSize: 0.001,
  orderType: "market",
});

// Subscribe to events
hedgeEngine.onEvent((event) => {
  switch (event.type) {
    case "hedge_executed":
      console.log(`Hedged ${event.data.size} ${event.data.symbol} @ ${event.data.avgFillPrice}`);
      console.log(`Fee: $${event.data.fee}`);
      break;
    case "pnl_update":
      console.log(`Net Profit: $${event.data.netProfit.toFixed(2)}`);
      break;
  }
});

// Start engine
await hedgeEngine.start();

// When user trades on your exchange:
hedgeEngine.onUserTrade("BTC-USD", "buy", 0.5, 50000, 12.5); // User bought 0.5 BTC, paid $12.50 fee

// Get profit summary
const summary = calculateProfitSummary(hedgeEngine.getAllStats());
console.log(`
  User Fees Collected: $${summary.totalUserFees.toFixed(2)}
  Hedge Fees Paid: $${summary.totalHedgeFees.toFixed(2)}
  Net Profit: $${summary.netProfit.toFixed(2)}
  Profit Margin: ${summary.profitMargin.toFixed(1)}%
`);
*/
