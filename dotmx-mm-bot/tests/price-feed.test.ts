/**
 * Price Feed Tests
 *
 * Tests internal price setting, reverse symbol lookup, and callbacks.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { PriceFeed } from "../src/price-feed";
import { CONFIG } from "../src/config";

describe("PriceFeed", () => {
  let feed: PriceFeed;

  beforeEach(() => {
    feed = new PriceFeed();
  });

  // ─── Basic Price Storage ───────────────────────────────────

  test("getPrice returns undefined for unknown symbol", () => {
    expect(feed.getPrice("BTC-USDT")).toBeUndefined();
  });

  test("setInternalPrice stores and retrieves price", () => {
    feed.setInternalPrice("BTC-USDT", 50000);
    expect(feed.getPrice("BTC-USDT")).toBe(50000);
  });

  test("setInternalPrice overwrites previous price", () => {
    feed.setInternalPrice("BTC-USDT", 50000);
    feed.setInternalPrice("BTC-USDT", 51000);
    expect(feed.getPrice("BTC-USDT")).toBe(51000);
  });

  test("stores prices per-symbol independently", () => {
    feed.setInternalPrice("BTC-USDT", 50000);
    feed.setInternalPrice("ETH-USDT", 3000);
    expect(feed.getPrice("BTC-USDT")).toBe(50000);
    expect(feed.getPrice("ETH-USDT")).toBe(3000);
  });

  // ─── Callbacks ─────────────────────────────────────────────

  test("onPrice callback fires on setInternalPrice", () => {
    let received: { symbol: string; price: number } | null = null;
    feed.onPrice((symbol, price) => {
      received = { symbol, price };
    });

    feed.setInternalPrice("ETH-USDT", 3000);
    expect(received!).toEqual({ symbol: "ETH-USDT", price: 3000 });
  });

  test("multiple callbacks all fire", () => {
    const events: string[] = [];
    feed.onPrice((s, p) => events.push(`cb1:${s}:${p}`));
    feed.onPrice((s, p) => events.push(`cb2:${s}:${p}`));

    feed.setInternalPrice("BTC-USDT", 50000);
    expect(events).toEqual(["cb1:BTC-USDT:50000", "cb2:BTC-USDT:50000"]);
  });

  // ─── Stop ──────────────────────────────────────────────────

  test("stop does not throw when never started", () => {
    expect(() => feed.stop()).not.toThrow();
  });
});

// ─── Symbol Mapping ──────────────────────────────────────────────────

describe("CONFIG.symbolMap", () => {
  test("maps DotMX symbols to Binance format correctly", () => {
    expect(CONFIG.symbolMap["BTC-USDT"]).toBe("btcusdt");
    expect(CONFIG.symbolMap["ETH-USDT"]).toBe("ethusdt");
    expect(CONFIG.symbolMap["SOL-USDT"]).toBe("solusdt");
  });

  test("DMX-USDT maps to null (no Binance equivalent)", () => {
    expect(CONFIG.symbolMap["DMX-USDT"]).toBeNull();
  });

  test("all non-null Binance symbols are lowercase without separators", () => {
    for (const [, v] of Object.entries(CONFIG.symbolMap)) {
      if (v === null) continue;
      expect(v).toBe(v.toLowerCase());
      expect(v).not.toContain("-");
      expect(v).not.toContain("/");
    }
  });
});
