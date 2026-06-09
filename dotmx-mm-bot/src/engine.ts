/**
 * Market Maker Engine
 *
 * Core quoting engine for a single MM account.
 * Manages the lifecycle: fetch reference price → compute quotes → place orders → monitor fills.
 *
 * Each engine instance runs one MmAccountConfig and manages all its assigned markets.
 */

import { ExchangeClient, OrderRequest, OpenOrder } from "./exchange-client";
import { PriceFeed } from "./price-feed";
import { InventoryManager } from "./inventory";
import { RiskManager } from "./risk";
import { MmAccountConfig, CONFIG } from "./config";
import { log } from "./logger";

export interface QuoteLevel {
  side: "BUY" | "SELL";
  price: number;
  quantity: number;
  clientOrderId: string;
}

export class MarketMakerEngine {
  private client: ExchangeClient;
  private priceFeed: PriceFeed;
  private inventory: InventoryManager;
  private risk: RiskManager;
  private config: MmAccountConfig;
  private dryRun: boolean;

  /** Currently live orders, keyed by clientOrderId */
  private liveOrders = new Map<string, OpenOrder>();

  private intervals: ReturnType<typeof setInterval>[] = [];
  private running = false;
  private cycleCount = 0;

  constructor(
    config: MmAccountConfig,
    priceFeed: PriceFeed,
    opts: { dryRun?: boolean } = {}
  ) {
    this.config = config;
    this.priceFeed = priceFeed;
    this.dryRun = opts.dryRun ?? false;

    this.client = new ExchangeClient();
    this.inventory = new InventoryManager(
      config.maxPositionUsd,
      CONFIG.inventorySkew
    );
    this.risk = new RiskManager({
      maxLossUsd: CONFIG.maxLossUsd,
      maxPositionPerMarketUsd: config.maxPositionUsd,
      maxTotalPositionUsd: config.maxPositionUsd * config.markets.length,
      maxOrdersPerMinute: 120,
    });

    this.risk.onRiskEvent((event, detail) => {
      log.warn(config.id, `Risk event: ${event} — ${detail}`);
    });
  }

  /** Start the market maker */
  async start(apiKey: string) {
    this.client.setApiKey(apiKey);
    this.running = true;

    log.info(
      this.config.id,
      `Starting: markets=${this.config.markets.join(",")} strategy=${this.config.strategy} spread=${this.config.spreadBps}bps`
    );

    // Initial refresh cycle
    await this.refreshAll();

    // Main loop
    const interval = setInterval(async () => {
      if (!this.running) return;
      try {
        await this.refreshAll();
      } catch (err) {
        log.error(
          this.config.id,
          `Refresh error: ${err instanceof Error ? err.message : err}`
        );
      }
    }, CONFIG.refreshIntervalMs);

    this.intervals.push(interval);
  }

  /** Stop the market maker and cancel all orders */
  async stop() {
    this.running = false;
    for (const interval of this.intervals) clearInterval(interval);
    this.intervals = [];

    log.info(this.config.id, "Stopping — cancelling all orders...");
    for (const market of this.config.markets) {
      try {
        await this.cancelAllForMarket(market);
      } catch (err) {
        log.error(
          this.config.id,
          `Error cancelling orders for ${market}: ${err}`
        );
      }
    }
    log.info(this.config.id, "Stopped");
  }

  /** Run one complete refresh cycle across all markets */
  private async refreshAll() {
    this.cycleCount++;

    for (const market of this.config.markets) {
      if (this.risk.isHalted()) {
        log.warn(
          this.config.id,
          `Skipping ${market} — halted: ${this.risk.getHaltReason()}`
        );
        continue;
      }

      try {
        await this.refreshMarket(market);
      } catch (err) {
        log.error(
          this.config.id,
          `${market} error: ${err instanceof Error ? err.message : err}`
        );
      }
    }

    // Periodic status log
    if (this.cycleCount % 12 === 0) {
      this.logStatus();
    }
  }

  /** Refresh quotes for a single market */
  private async refreshMarket(market: string) {
    // ── 1. Get reference price ──
    let refPrice = this.priceFeed.getPrice(market);

    if (!refPrice) {
      // Fall back to orderbook midpoint
      try {
        const book = await this.client.getOrderbook(market, 5);
        if (book.bids.length > 0 && book.asks.length > 0) {
          refPrice = (book.bids[0][0] + book.asks[0][0]) / 2;
          this.priceFeed.setInternalPrice(market, refPrice);
        }
      } catch {
        // If no orderbook data, use ticker
        try {
          const ticker = await this.client.getTicker(market);
          refPrice = ticker.lastPrice;
        } catch {
          log.warn(this.config.id, `${market}: No price data available`);
          return;
        }
      }
    }

    if (!refPrice || refPrice <= 0) {
      log.warn(this.config.id, `${market}: Invalid reference price`);
      return;
    }

    // Update inventory mark-to-market
    this.inventory.markToMarket(market, refPrice);

    // ── 2. Cancel existing orders ──
    await this.cancelAllForMarket(market);

    // ── 3. Compute new quotes ──
    const quotes = this.computeQuotes(market, refPrice);

    if (quotes.length === 0) return;

    // ── 4. Place orders ──
    if (this.dryRun) {
      for (const q of quotes) {
        log.info(
          this.config.id,
          `[DRY] ${market} ${q.side} ${q.quantity.toFixed(6)}@${q.price.toFixed(2)}`
        );
      }
      return;
    }

    const orderRequests: OrderRequest[] = quotes.map((q) => ({
      symbol: market,
      side: q.side,
      type: "LIMIT" as const,
      quantity: q.quantity,
      price: q.price,
      timeInForce: "POST_ONLY" as const,
      clientOrderId: q.clientOrderId,
    }));

    // Use batch API if available, otherwise place individually
    try {
      const results = await this.client.placeBatchOrders(orderRequests);
      let placed = 0;
      for (const r of results.results) {
        if (r.success) {
          placed++;
          this.risk.recordOrder(market);
        } else {
          log.debug(
            this.config.id,
            `${market} order ${r.index} failed: ${r.error}`
          );
        }
      }
      log.debug(
        this.config.id,
        `${market}: placed ${placed}/${quotes.length} orders around $${refPrice.toFixed(2)}`
      );
    } catch {
      // Batch not available, fall back to individual orders
      for (const req of orderRequests) {
        try {
          const check = this.risk.preTradeCheck(
            market,
            req.side,
            req.quantity * (req.price || 0),
            this.inventory
          );
          if (!check.allowed) continue;

          await this.client.placeOrder(req);
          this.risk.recordOrder(market);
        } catch (err) {
          log.debug(
            this.config.id,
            `${market} individual order failed: ${err instanceof Error ? err.message : err}`
          );
        }
      }
    }
  }

  /** Compute bid and ask levels around the reference price */
  private computeQuotes(market: string, refPrice: number): QuoteLevel[] {
    const { spreadBps, levels, orderSizeUsd, strategy } = this.config;
    const quotes: QuoteLevel[] = [];

    // Base half-spread in decimal
    const halfSpread = spreadBps / 2 / 10_000;

    // Get inventory-based spread adjustment
    const [bidMult, askMult] =
      strategy === "skewed"
        ? this.inventory.getSpreadAdjustment(market)
        : [1, 1]; // symmetric strategy doesn't skew

    // Passive strategy uses wider spreads, fewer levels
    const levelMult = strategy === "passive" ? 1.5 : 1;

    for (let i = 0; i < levels; i++) {
      // Each level is spaced further from mid
      const levelOffset = halfSpread * (1 + i * 0.5) * levelMult;

      // ── Bid (buy) levels ──
      const bidPrice = refPrice * (1 - levelOffset * bidMult);
      const bidQty = orderSizeUsd / bidPrice;

      // ── Ask (sell) levels ──
      const askPrice = refPrice * (1 + levelOffset * askMult);
      const askQty = orderSizeUsd / askPrice;

      const suffix = crypto.randomUUID().replace(/-/g, "").substring(0, 12);

      quotes.push({
        side: "BUY",
        price: roundPrice(bidPrice, market),
        quantity: roundQty(bidQty, market),
        clientOrderId: `b${suffix}${i}`,
      });

      quotes.push({
        side: "SELL",
        price: roundPrice(askPrice, market),
        quantity: roundQty(askQty, market),
        clientOrderId: `a${suffix}${i}`,
      });
    }

    return quotes;
  }

  /** Cancel all live orders for a market */
  private async cancelAllForMarket(market: string) {
    try {
      await this.client.cancelAllOrders(market);
    } catch {
      // Ignore cancel errors (orders may have filled)
    }
  }

  /** Log periodic status */
  private logStatus() {
    for (const market of this.config.markets) {
      const inv = this.inventory.getState(market);
      const refPrice = this.priceFeed.getPrice(market);
      log.info(
        this.config.id,
        `${market}: ref=$${refPrice?.toFixed(2) ?? "?"} net=${inv.netPosition.toFixed(6)} val=$${inv.positionValueUsd.toFixed(0)} skew=${inv.skewFactor.toFixed(3)} bought=$${inv.totalBoughtUsd.toFixed(0)} sold=$${inv.totalSoldUsd.toFixed(0)}`
      );
    }
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

/** Tick sizes per market (from seed data) */
export const TICK_SIZES: Record<string, number> = {
  "BTC-USDT": 0.01,
  "ETH-USDT": 0.01,
  "BNB-USDT": 0.01,
  "SOL-USDT": 0.01,
  "ARB-USDT": 0.0001,
  "OP-USDT": 0.0001,
  "DMX-USDT": 0.00001,
  "ETH-BTC": 0.00001,
  "BTC-USDC": 0.01,
  "ETH-USDC": 0.01,
  "DAI-USDT": 0.0001,
  "WBTC-USDT": 0.01,
  "DOGE-USDT": 0.00001,
};

export const LOT_SIZES: Record<string, number> = {
  "BTC-USDT": 0.00001,
  "ETH-USDT": 0.0001,
  "BNB-USDT": 0.001,
  "SOL-USDT": 0.01,
  "ARB-USDT": 0.1,
  "OP-USDT": 0.1,
  "DMX-USDT": 1.0,
  "ETH-BTC": 0.001,
  "BTC-USDC": 0.00001,
  "ETH-USDC": 0.0001,
  "DAI-USDT": 1.0,
  "WBTC-USDT": 0.00001,
  "DOGE-USDT": 1.0,
};

export function roundPrice(price: number, market: string): number {
  const tick = TICK_SIZES[market] || 0.01;
  return Math.round(price / tick) * tick;
}

export function roundQty(qty: number, market: string): number {
  const lot = LOT_SIZES[market] || 0.00001;
  return Math.max(lot, Math.round(qty / lot) * lot);
}
