/**
 * Order Generator
 *
 * Generates realistic order flow for testing and benchmarking.
 */

import { generateId, nowMs } from "@dotmx/shared";
import type { CreateOrderCommand, OrderSide, OrderType, TimeInForce } from "@dotmx/shared";

export interface GeneratorConfig {
  symbol: string;
  basePrice: number;
  priceVolatility: number; // Standard deviation as percentage
  orderRatePerSecond: number;
  buyProbability: number; // 0-1
  limitProbability: number; // 0-1
  cancelProbability: number; // 0-1 for existing orders
  meanOrderSize: number;
  sizeVolatility: number;
  userCount: number;
  tickSize: number;
  lotSize: number;
}

export const defaultGeneratorConfig: GeneratorConfig = {
  symbol: "BTC-USD",
  basePrice: 50000,
  priceVolatility: 0.001, // 0.1%
  orderRatePerSecond: 100,
  buyProbability: 0.5,
  limitProbability: 0.8,
  cancelProbability: 0.1,
  meanOrderSize: 0.1,
  sizeVolatility: 0.5,
  userCount: 100,
  tickSize: 0.01,
  lotSize: 0.001,
};

/**
 * Random number with normal distribution
 */
function randomNormal(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return mean + z * stdDev;
}

/**
 * Round to tick/lot size
 */
function roundToTick(value: number, tick: number): number {
  return Math.round(value / tick) * tick;
}

/**
 * Create order generator
 */
export interface OrderGenerator {
  generate(): CreateOrderCommand;
  generateBatch(count: number): CreateOrderCommand[];
  updatePrice(newPrice: number): void;
  getStats(): GeneratorStats;
}

export interface GeneratorStats {
  ordersGenerated: number;
  buyOrders: number;
  sellOrders: number;
  limitOrders: number;
  marketOrders: number;
  averagePrice: number;
  averageSize: number;
}

export function createOrderGenerator(config: GeneratorConfig = defaultGeneratorConfig): OrderGenerator {
  let currentPrice = config.basePrice;
  let ordersGenerated = 0;
  let buyOrders = 0;
  let sellOrders = 0;
  let limitOrders = 0;
  let marketOrders = 0;
  let totalPrice = 0;
  let totalSize = 0;

  function generateUserId(): string {
    return `user-${Math.floor(Math.random() * config.userCount)}`;
  }

  function generatePrice(side: OrderSide): number {
    // Add some spread based on side
    const spread = currentPrice * 0.0001; // 0.01% spread
    const deviation = randomNormal(0, config.priceVolatility * currentPrice);

    let price: number;
    if (side === "BUY") {
      price = currentPrice - spread / 2 + deviation;
    } else {
      price = currentPrice + spread / 2 + deviation;
    }

    return roundToTick(Math.max(price, config.tickSize), config.tickSize);
  }

  function generateSize(): number {
    const size = Math.abs(randomNormal(config.meanOrderSize, config.sizeVolatility * config.meanOrderSize));
    return roundToTick(Math.max(size, config.lotSize), config.lotSize);
  }

  function generateTimeInForce(): TimeInForce {
    const r = Math.random();
    if (r < 0.85) return "GTC";
    if (r < 0.95) return "IOC";
    return "FOK";
  }

  return {
    generate(): CreateOrderCommand {
      const side: OrderSide = Math.random() < config.buyProbability ? "BUY" : "SELL";
      const type: OrderType = Math.random() < config.limitProbability ? "LIMIT" : "MARKET";
      const quantity = generateSize();
      const price = type === "LIMIT" ? generatePrice(side) : undefined;

      ordersGenerated++;
      if (side === "BUY") buyOrders++;
      else sellOrders++;
      if (type === "LIMIT") limitOrders++;
      else marketOrders++;
      if (price) totalPrice += price;
      totalSize += quantity;

      return {
        requestId: generateId(),
        userId: generateUserId(),
        symbol: config.symbol,
        side,
        type,
        price,
        quantity,
        timeInForce: generateTimeInForce(),
        timestamp: nowMs(),
      };
    },

    generateBatch(count: number): CreateOrderCommand[] {
      return Array.from({ length: count }, () => this.generate());
    },

    updatePrice(newPrice: number): void {
      currentPrice = newPrice;
    },

    getStats(): GeneratorStats {
      return {
        ordersGenerated,
        buyOrders,
        sellOrders,
        limitOrders,
        marketOrders,
        averagePrice: limitOrders > 0 ? totalPrice / limitOrders : 0,
        averageSize: ordersGenerated > 0 ? totalSize / ordersGenerated : 0,
      };
    },
  };
}

/**
 * Create market maker generator (two-sided quotes)
 */
export interface MarketMakerGenerator {
  generateQuotes(): { bid: CreateOrderCommand; ask: CreateOrderCommand };
  updateMidPrice(price: number): void;
}

export function createMarketMakerGenerator(
  userId: string,
  symbol: string,
  config: {
    spreadBps: number; // Spread in basis points
    sizePerLevel: number;
    levels: number;
    tickSize: number;
  }
): MarketMakerGenerator {
  let midPrice = 50000;

  return {
    generateQuotes() {
      const halfSpread = midPrice * (config.spreadBps / 10000) / 2;
      const bidPrice = roundToTick(midPrice - halfSpread, config.tickSize);
      const askPrice = roundToTick(midPrice + halfSpread, config.tickSize);

      const bid: CreateOrderCommand = {
        requestId: generateId(),
        userId,
        symbol,
        side: "BUY",
        type: "LIMIT",
        price: bidPrice,
        quantity: config.sizePerLevel,
        timeInForce: "GTC",
        timestamp: nowMs(),
      };

      const ask: CreateOrderCommand = {
        requestId: generateId(),
        userId,
        symbol,
        side: "SELL",
        type: "LIMIT",
        price: askPrice,
        quantity: config.sizePerLevel,
        timeInForce: "GTC",
        timestamp: nowMs(),
      };

      return { bid, ask };
    },

    updateMidPrice(price: number): void {
      midPrice = price;
    },
  };
}
