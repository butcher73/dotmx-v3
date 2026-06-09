/**
 * Inventory Manager Tests
 *
 * Tests position tracking, skew calculation, spread adjustment,
 * and risk limit enforcement.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { InventoryManager } from "../src/inventory";

describe("InventoryManager", () => {
  let inv: InventoryManager;

  beforeEach(() => {
    inv = new InventoryManager(100_000, 0.3);
  });

  // ─── Initial State ─────────────────────────────────────────

  test("initial state is zero for unknown symbol", () => {
    const state = inv.getState("BTC-USDT");
    expect(state.netPosition).toBe(0);
    expect(state.positionValueUsd).toBe(0);
    expect(state.skewFactor).toBe(0);
    expect(state.totalBoughtUsd).toBe(0);
    expect(state.totalSoldUsd).toBe(0);
  });

  // ─── Fill Recording ───────────────────────────────────────

  test("recordFill BUY increases net position", () => {
    inv.recordFill("BTC-USDT", "BUY", 1.0, 50000);
    const state = inv.getState("BTC-USDT");
    expect(state.netPosition).toBe(1.0);
    expect(state.totalBoughtUsd).toBe(50000);
    expect(state.totalSoldUsd).toBe(0);
  });

  test("recordFill SELL decreases net position", () => {
    inv.recordFill("BTC-USDT", "SELL", 0.5, 50000);
    const state = inv.getState("BTC-USDT");
    expect(state.netPosition).toBe(-0.5);
    expect(state.totalSoldUsd).toBe(25000);
  });

  test("multiple fills accumulate correctly", () => {
    inv.recordFill("ETH-USDT", "BUY", 10, 3000);
    inv.recordFill("ETH-USDT", "BUY", 5, 3100);
    inv.recordFill("ETH-USDT", "SELL", 3, 3200);

    const state = inv.getState("ETH-USDT");
    expect(state.netPosition).toBe(12); // 10 + 5 - 3
    expect(state.totalBoughtUsd).toBe(10 * 3000 + 5 * 3100); // 45500
    expect(state.totalSoldUsd).toBe(3 * 3200); // 9600
  });

  test("position value updates on fill", () => {
    inv.recordFill("BTC-USDT", "BUY", 2, 50000);
    const state = inv.getState("BTC-USDT");
    expect(state.positionValueUsd).toBe(100000);
  });

  // ─── Mark to Market ───────────────────────────────────────

  test("markToMarket updates position value", () => {
    inv.recordFill("BTC-USDT", "BUY", 1, 50000);
    inv.markToMarket("BTC-USDT", 55000);
    const state = inv.getState("BTC-USDT");
    expect(state.positionValueUsd).toBe(55000);
  });

  test("markToMarket with short position", () => {
    inv.recordFill("ETH-USDT", "SELL", 10, 3000);
    inv.markToMarket("ETH-USDT", 3200);
    const state = inv.getState("ETH-USDT");
    expect(state.positionValueUsd).toBe(32000); // abs(-10 * 3200)
    expect(state.netPosition).toBe(-10);
  });

  // ─── Skew Calculation ─────────────────────────────────────

  test("skew is positive when long", () => {
    inv.recordFill("BTC-USDT", "BUY", 1, 50000);
    const state = inv.getState("BTC-USDT");
    expect(state.skewFactor).toBeGreaterThan(0);
  });

  test("skew is negative when short", () => {
    inv.recordFill("BTC-USDT", "SELL", 1, 50000);
    const state = inv.getState("BTC-USDT");
    expect(state.skewFactor).toBeLessThan(0);
  });

  test("skew is clamped to [-1, 1]", () => {
    // Way over max position
    inv.recordFill("BTC-USDT", "BUY", 100, 50000);
    const state = inv.getState("BTC-USDT");
    expect(state.skewFactor).toBeLessThanOrEqual(1);
    expect(state.skewFactor).toBeGreaterThanOrEqual(-1);
  });

  test("skew at max position equals 1.0", () => {
    // maxPositionUsd = 100_000, so 2 BTC at 50000 = exactly at max
    inv.recordFill("BTC-USDT", "BUY", 2, 50000);
    const state = inv.getState("BTC-USDT");
    expect(state.skewFactor).toBe(1.0);
  });

  // ─── Spread Adjustment ────────────────────────────────────

  test("spread adjustment is [1, 1] when flat", () => {
    const [bid, ask] = inv.getSpreadAdjustment("BTC-USDT");
    expect(bid).toBe(1);
    expect(ask).toBe(1);
  });

  test("long inventory widens bid, tightens ask", () => {
    inv.recordFill("BTC-USDT", "BUY", 1, 50000);
    const [bid, ask] = inv.getSpreadAdjustment("BTC-USDT");
    expect(bid).toBeGreaterThan(1); // Wider bid → discourages more buys
    expect(ask).toBeLessThan(1); // Tighter ask → attracts sells
  });

  test("short inventory tightens bid, widens ask", () => {
    inv.recordFill("BTC-USDT", "SELL", 1, 50000);
    const [bid, ask] = inv.getSpreadAdjustment("BTC-USDT");
    expect(bid).toBeLessThan(1); // Tighter bid → attracts buys
    expect(ask).toBeGreaterThan(1); // Wider ask → discourages more sells
  });

  test("spread adjustment multipliers are symmetric", () => {
    inv.recordFill("BTC-USDT", "BUY", 1, 50000);
    const [bid, ask] = inv.getSpreadAdjustment("BTC-USDT");
    // bid + ask should equal 2 (symmetric around 1)
    expect(bid + ask).toBeCloseTo(2, 10);
  });

  // ─── canTrade ─────────────────────────────────────────────

  test("canTrade allows trade within limits", () => {
    expect(inv.canTrade("BTC-USDT", "BUY", 50000)).toBe(true);
  });

  test("canTrade blocks trade exceeding max position", () => {
    inv.recordFill("BTC-USDT", "BUY", 2, 50000); // 100k = at max
    expect(inv.canTrade("BTC-USDT", "BUY", 10000)).toBe(false);
  });

  test("canTrade allows reducing position when at limit", () => {
    inv.recordFill("BTC-USDT", "BUY", 2, 50000); // 100k
    // Selling should reduce position
    expect(inv.canTrade("BTC-USDT", "SELL", 10000)).toBe(true);
  });

  // ─── PnL ──────────────────────────────────────────────────

  test("getTotalPnl is zero initially", () => {
    expect(inv.getTotalPnl()).toBe(0);
  });

  test("getTotalPnl reflects realized PnL", () => {
    inv.recordFill("BTC-USDT", "BUY", 1, 50000);
    inv.recordFill("BTC-USDT", "SELL", 1, 51000);
    // Sold 51000 - Bought 50000 = 1000 profit
    // Net position = 0, so no inventory adjustment
    expect(inv.getTotalPnl()).toBe(1000);
  });

  test("getTotalPnl includes unrealized m2m value", () => {
    inv.recordFill("BTC-USDT", "BUY", 1, 50000);
    inv.markToMarket("BTC-USDT", 52000);
    // Flow: 0 - 50000 = -50000
    // Inventory value: +52000 (long)
    // M2M PnL = -50000 + 52000 = 2000
    expect(inv.getTotalPnl()).toBe(2000);
  });

  test("getTotalPnl aggregates across markets", () => {
    inv.recordFill("BTC-USDT", "BUY", 1, 50000);
    inv.recordFill("BTC-USDT", "SELL", 1, 51000);
    inv.recordFill("ETH-USDT", "BUY", 10, 3000);
    inv.recordFill("ETH-USDT", "SELL", 10, 2900);
    // BTC: sold-bought = 51000-50000 = +1000, net=0 -> pnl=1000
    // ETH: sold-bought = 29000-30000 = -1000, net=0 -> pnl=-1000
    // total = 0
    expect(inv.getTotalPnl()).toBe(0);
  });

  // ─── Reset ────────────────────────────────────────────────

  test("reset clears state for a symbol", () => {
    inv.recordFill("BTC-USDT", "BUY", 1, 50000);
    inv.reset("BTC-USDT");
    const state = inv.getState("BTC-USDT");
    expect(state.netPosition).toBe(0);
    expect(state.positionValueUsd).toBe(0);
  });

  test("reset only affects specified symbol", () => {
    inv.recordFill("BTC-USDT", "BUY", 1, 50000);
    inv.recordFill("ETH-USDT", "BUY", 10, 3000);
    inv.reset("BTC-USDT");
    expect(inv.getState("BTC-USDT").netPosition).toBe(0);
    expect(inv.getState("ETH-USDT").netPosition).toBe(10);
  });

  // ─── Edge Cases ───────────────────────────────────────────

  test("handles zero max position gracefully", () => {
    const zeroInv = new InventoryManager(0, 0.3);
    const state = zeroInv.getState("BTC-USDT");
    expect(state.skewFactor).toBe(0);
  });

  test("handles very small quantities", () => {
    inv.recordFill("BTC-USDT", "BUY", 0.00001, 50000);
    const state = inv.getState("BTC-USDT");
    expect(state.netPosition).toBe(0.00001);
    expect(state.positionValueUsd).toBeCloseTo(0.5, 5);
  });
});
