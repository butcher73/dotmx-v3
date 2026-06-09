/**
 * Engine Tests
 *
 * Tests quote computation, price/quantity rounding, tick/lot enforcement,
 * and clientOrderId randomness.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  MarketMakerEngine,
  roundPrice,
  roundQty,
  TICK_SIZES,
  LOT_SIZES,
} from "../src/engine";
import { PriceFeed } from "../src/price-feed";
import { MM_ACCOUNTS, MmAccountConfig } from "../src/config";

// ─── roundPrice Tests ────────────────────────────────────────────────

describe("roundPrice", () => {
  test("rounds BTC-USDT to 0.01 tick", () => {
    expect(roundPrice(50000.123, "BTC-USDT")).toBeCloseTo(50000.12, 2);
    expect(roundPrice(50000.126, "BTC-USDT")).toBeCloseTo(50000.13, 2);
    expect(roundPrice(50000.005, "BTC-USDT")).toBeCloseTo(50000.01, 2);
  });

  test("rounds ARB-USDT to 0.0001 tick", () => {
    expect(roundPrice(1.23456, "ARB-USDT")).toBeCloseTo(1.2346, 4);
    expect(roundPrice(1.23454, "ARB-USDT")).toBeCloseTo(1.2345, 4);
  });

  test("rounds DMX-USDT to 0.00001 tick", () => {
    expect(roundPrice(0.123456, "DMX-USDT")).toBeCloseTo(0.12346, 5);
  });

  test("rounds ETH-BTC to 0.00001 tick", () => {
    expect(roundPrice(0.054321, "ETH-BTC")).toBeCloseTo(0.05432, 5);
  });

  test("uses default 0.01 for unknown market", () => {
    expect(roundPrice(100.456, "UNKNOWN-PAIR")).toBeCloseTo(100.46, 2);
  });

  test("handles exact tick values", () => {
    expect(roundPrice(50000.01, "BTC-USDT")).toBeCloseTo(50000.01, 2);
    expect(roundPrice(50000.00, "BTC-USDT")).toBeCloseTo(50000.00, 2);
  });
});

// ─── roundQty Tests ──────────────────────────────────────────────────

describe("roundQty", () => {
  test("rounds BTC-USDT to 0.00001 lot", () => {
    expect(roundQty(0.123456, "BTC-USDT")).toBeCloseTo(0.12346, 5);
  });

  test("rounds ETH-USDT to 0.0001 lot", () => {
    expect(roundQty(1.23456, "ETH-USDT")).toBeCloseTo(1.2346, 4);
  });

  test("rounds DMX-USDT to 1.0 lot", () => {
    expect(roundQty(123.456, "DMX-USDT")).toBe(123);
  });

  test("rounds DOGE-USDT to 1.0 lot", () => {
    expect(roundQty(1500.7, "DOGE-USDT")).toBe(1501);
  });

  test("enforces minimum lot size", () => {
    expect(roundQty(0.000001, "BTC-USDT")).toBe(0.00001);
    expect(roundQty(0.0000001, "ETH-USDT")).toBe(0.0001);
  });

  test("rounds SOL-USDT to 0.01 lot", () => {
    expect(roundQty(12.345, "SOL-USDT")).toBeCloseTo(12.35, 2);
  });
});

// ─── Tick/Lot Size Coverage ──────────────────────────────────────────

describe("tick and lot sizes", () => {
  test("all 13 trading pairs have defined tick sizes", () => {
    const allPairs = [
      "BTC-USDT", "ETH-USDT", "BNB-USDT", "SOL-USDT",
      "ARB-USDT", "OP-USDT", "DMX-USDT", "ETH-BTC",
      "BTC-USDC", "ETH-USDC", "DAI-USDT", "WBTC-USDT", "DOGE-USDT",
    ];
    for (const pair of allPairs) {
      expect(TICK_SIZES[pair]).toBeDefined();
      expect(TICK_SIZES[pair]).toBeGreaterThan(0);
    }
  });

  test("all 13 trading pairs have defined lot sizes", () => {
    const allPairs = [
      "BTC-USDT", "ETH-USDT", "BNB-USDT", "SOL-USDT",
      "ARB-USDT", "OP-USDT", "DMX-USDT", "ETH-BTC",
      "BTC-USDC", "ETH-USDC", "DAI-USDT", "WBTC-USDT", "DOGE-USDT",
    ];
    for (const pair of allPairs) {
      expect(LOT_SIZES[pair]).toBeDefined();
      expect(LOT_SIZES[pair]).toBeGreaterThan(0);
    }
  });
});

// ─── Quote Computation (via Engine) ──────────────────────────────────

describe("MarketMakerEngine: computeQuotes", () => {
  const testAccount: MmAccountConfig = {
    id: "test-01",
    email: "test@example.com",
    firstName: "Test",
    lastName: "User",
    username: "testuser",
    markets: ["BTC-USDT"],
    seedBalanceUsd: 1_000_000,
    strategy: "symmetric",
    spreadBps: 100, // 1% spread = easy to verify
    levels: 3,
    orderSizeUsd: 5000,
    maxPositionUsd: 100_000,
  };

  test("generates correct number of quotes (2 per level)", () => {
    const priceFeed = new PriceFeed();
    const engine = new MarketMakerEngine(testAccount, priceFeed, {
      dryRun: true,
    });

    // Access private computeQuotes via casting
    const quotes = (engine as any).computeQuotes("BTC-USDT", 50000);
    // 3 levels × 2 (bid + ask) = 6 quotes
    expect(quotes).toHaveLength(6);
  });

  test("bids are below ref price, asks are above", () => {
    const priceFeed = new PriceFeed();
    const engine = new MarketMakerEngine(testAccount, priceFeed, {
      dryRun: true,
    });

    const refPrice = 50000;
    const quotes = (engine as any).computeQuotes("BTC-USDT", refPrice);

    const bids = quotes.filter((q: any) => q.side === "BUY");
    const asks = quotes.filter((q: any) => q.side === "SELL");

    expect(bids).toHaveLength(3);
    expect(asks).toHaveLength(3);

    for (const bid of bids) {
      expect(bid.price).toBeLessThan(refPrice);
    }
    for (const ask of asks) {
      expect(ask.price).toBeGreaterThan(refPrice);
    }
  });

  test("bid levels decrease further from mid", () => {
    const priceFeed = new PriceFeed();
    const engine = new MarketMakerEngine(testAccount, priceFeed, {
      dryRun: true,
    });

    const quotes = (engine as any).computeQuotes("BTC-USDT", 50000);
    const bids = quotes
      .filter((q: any) => q.side === "BUY")
      .sort((a: any, b: any) => b.price - a.price);

    for (let i = 1; i < bids.length; i++) {
      expect(bids[i].price).toBeLessThan(bids[i - 1].price);
    }
  });

  test("ask levels increase further from mid", () => {
    const priceFeed = new PriceFeed();
    const engine = new MarketMakerEngine(testAccount, priceFeed, {
      dryRun: true,
    });

    const quotes = (engine as any).computeQuotes("BTC-USDT", 50000);
    const asks = quotes
      .filter((q: any) => q.side === "SELL")
      .sort((a: any, b: any) => a.price - b.price);

    for (let i = 1; i < asks.length; i++) {
      expect(asks[i].price).toBeGreaterThan(asks[i - 1].price);
    }
  });

  test("prices are rounded to tick size", () => {
    const priceFeed = new PriceFeed();
    const engine = new MarketMakerEngine(testAccount, priceFeed, {
      dryRun: true,
    });

    const quotes = (engine as any).computeQuotes("BTC-USDT", 50000);
    const tick = TICK_SIZES["BTC-USDT"]; // 0.01

    for (const q of quotes) {
      const remainder = (q.price / tick) % 1;
      expect(remainder).toBeCloseTo(0, 8);
    }
  });

  test("quantities are rounded to lot size", () => {
    const priceFeed = new PriceFeed();
    const engine = new MarketMakerEngine(testAccount, priceFeed, {
      dryRun: true,
    });

    const quotes = (engine as any).computeQuotes("BTC-USDT", 50000);
    const lot = LOT_SIZES["BTC-USDT"]; // 0.00001

    for (const q of quotes) {
      const remainder = (q.quantity / lot) % 1;
      expect(remainder).toBeCloseTo(0, 8);
    }
  });

  test("quantities approximate orderSizeUsd / price", () => {
    const priceFeed = new PriceFeed();
    const engine = new MarketMakerEngine(testAccount, priceFeed, {
      dryRun: true,
    });

    const refPrice = 50000;
    const quotes = (engine as any).computeQuotes("BTC-USDT", refPrice);

    for (const q of quotes) {
      const usdValue = q.quantity * q.price;
      // Should be within 10% of target orderSizeUsd (5000)
      expect(usdValue).toBeGreaterThan(4000);
      expect(usdValue).toBeLessThan(6000);
    }
  });
});

// ─── ClientOrderId Format ────────────────────────────────────────────

describe("clientOrderId stealth", () => {
  test("clientOrderIds do not contain bot account IDs", () => {
    const priceFeed = new PriceFeed();
    const account = MM_ACCOUNTS[0];
    const engine = new MarketMakerEngine(account, priceFeed, { dryRun: true });

    const quotes = (engine as any).computeQuotes("BTC-USDT", 50000);

    for (const q of quotes) {
      expect(q.clientOrderId).not.toContain(account.id);
      expect(q.clientOrderId).not.toContain("mm-");
      expect(q.clientOrderId).not.toContain("mm_");
      expect(q.clientOrderId).not.toContain("bot");
    }
  });

  test("clientOrderIds are unique across calls", () => {
    const priceFeed = new PriceFeed();
    const engine = new MarketMakerEngine(MM_ACCOUNTS[0], priceFeed, {
      dryRun: true,
    });

    const quotes1 = (engine as any).computeQuotes("BTC-USDT", 50000);
    const quotes2 = (engine as any).computeQuotes("BTC-USDT", 50000);

    const ids1 = new Set(quotes1.map((q: any) => q.clientOrderId));
    const ids2 = new Set(quotes2.map((q: any) => q.clientOrderId));

    // No overlap between batches
    for (const id of ids1) {
      expect(ids2.has(id)).toBe(false);
    }
  });

  test("clientOrderIds start with b (bid) or a (ask)", () => {
    const priceFeed = new PriceFeed();
    const engine = new MarketMakerEngine(MM_ACCOUNTS[0], priceFeed, {
      dryRun: true,
    });

    const quotes = (engine as any).computeQuotes("BTC-USDT", 50000);

    for (const q of quotes) {
      if (q.side === "BUY") {
        expect(q.clientOrderId.startsWith("b")).toBe(true);
      } else {
        expect(q.clientOrderId.startsWith("a")).toBe(true);
      }
    }
  });
});

// ─── Strategy Modes ──────────────────────────────────────────────────

describe("strategy modes", () => {
  test("passive strategy produces wider spreads", () => {
    const priceFeed = new PriceFeed();

    const symmetricAccount: MmAccountConfig = {
      id: "test-sym",
      email: "sym@example.com",
      firstName: "Sym",
      lastName: "Test",
      username: "symtest",
      markets: ["BTC-USDT"],
      seedBalanceUsd: 1_000_000,
      strategy: "symmetric",
      spreadBps: 50,
      levels: 5,
      orderSizeUsd: 5000,
      maxPositionUsd: 100_000,
    };

    const passiveAccount: MmAccountConfig = {
      ...symmetricAccount,
      id: "test-pas",
      email: "pas@example.com",
      username: "pastest",
      strategy: "passive",
    };

    const symEngine = new MarketMakerEngine(symmetricAccount, priceFeed, {
      dryRun: true,
    });
    const pasEngine = new MarketMakerEngine(passiveAccount, priceFeed, {
      dryRun: true,
    });

    const refPrice = 50000;
    const symQuotes = (symEngine as any).computeQuotes("BTC-USDT", refPrice);
    const pasQuotes = (pasEngine as any).computeQuotes("BTC-USDT", refPrice);

    // Compare first level bid distance from mid
    const symBid = symQuotes.find((q: any) => q.side === "BUY")!;
    const pasBid = pasQuotes.find((q: any) => q.side === "BUY")!;

    const symDistance = refPrice - symBid.price;
    const pasDistance = refPrice - pasBid.price;

    // Passive should be 1.5x wider
    expect(pasDistance).toBeGreaterThan(symDistance);
    expect(pasDistance / symDistance).toBeCloseTo(1.5, 1);
  });
});
