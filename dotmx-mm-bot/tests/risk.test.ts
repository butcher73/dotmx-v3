/**
 * Risk Manager Tests
 *
 * Tests circuit breakers, rate limiting, pre-trade checks,
 * and risk event callbacks.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { RiskManager } from "../src/risk";
import { InventoryManager } from "../src/inventory";

describe("RiskManager", () => {
  let risk: RiskManager;
  let inv: InventoryManager;

  beforeEach(() => {
    risk = new RiskManager({
      maxLossUsd: 10_000,
      maxPositionPerMarketUsd: 100_000,
      maxTotalPositionUsd: 500_000,
      maxOrdersPerMinute: 60,
    });
    inv = new InventoryManager(100_000, 0.3);
  });

  // ─── Initial State ─────────────────────────────────────────

  test("not halted initially", () => {
    expect(risk.isHalted()).toBe(false);
    expect(risk.getHaltReason()).toBeNull();
  });

  // ─── Pre-Trade Checks ─────────────────────────────────────

  test("allows normal trade", () => {
    const result = risk.preTradeCheck("BTC-USDT", "BUY", 5000, inv);
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  test("blocks trade when halted", () => {
    // Force halt by triggering max loss
    inv.recordFill("BTC-USDT", "BUY", 1, 50000);
    inv.recordFill("BTC-USDT", "SELL", 1, 38000); // Loss 12000 > 10000

    risk.preTradeCheck("BTC-USDT", "BUY", 1000, inv);
    // Should now be halted
    const result = risk.preTradeCheck("ETH-USDT", "BUY", 1000, inv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("halted");
  });

  test("blocks trade exceeding max position", () => {
    // Fill inventory to max (buy and mark at same price → PnL=0)
    inv.recordFill("BTC-USDT", "BUY", 2, 50000); // 100k position
    inv.markToMarket("BTC-USDT", 50000); // m2m PnL = 0
    const result = risk.preTradeCheck("BTC-USDT", "BUY", 10000, inv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("exceeded");
  });

  test("allows sell even when at max long position", () => {
    inv.recordFill("BTC-USDT", "BUY", 2, 50000); // 100k
    inv.markToMarket("BTC-USDT", 50000); // m2m PnL = 0, no loss halt
    const result = risk.preTradeCheck("BTC-USDT", "SELL", 10000, inv);
    expect(result.allowed).toBe(true);
  });

  // ─── Max Loss Circuit Breaker ──────────────────────────────

  test("triggers halt on max loss exceeded", () => {
    // Simulate large loss
    inv.recordFill("BTC-USDT", "BUY", 1, 60000);
    inv.recordFill("BTC-USDT", "SELL", 1, 48000); // Loss: 12000

    risk.preTradeCheck("BTC-USDT", "BUY", 1000, inv);
    expect(risk.isHalted()).toBe(true);
    expect(risk.getHaltReason()).toContain("Max loss");
  });

  test("does not halt when loss is within limits", () => {
    inv.recordFill("BTC-USDT", "BUY", 1, 50000);
    inv.recordFill("BTC-USDT", "SELL", 1, 45000); // Loss: 5000 < 10000

    risk.preTradeCheck("BTC-USDT", "BUY", 1000, inv);
    expect(risk.isHalted()).toBe(false);
  });

  // ─── Rate Limiting ────────────────────────────────────────

  test("rate limit allows orders within limit", () => {
    for (let i = 0; i < 59; i++) {
      risk.recordOrder("BTC-USDT");
    }
    const result = risk.preTradeCheck("BTC-USDT", "BUY", 1000, inv);
    expect(result.allowed).toBe(true);
  });

  test("rate limit blocks orders at limit", () => {
    for (let i = 0; i < 60; i++) {
      risk.recordOrder("BTC-USDT");
    }
    const result = risk.preTradeCheck("BTC-USDT", "BUY", 1000, inv);
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Rate limit");
  });

  test("rate limit is per-market", () => {
    for (let i = 0; i < 60; i++) {
      risk.recordOrder("BTC-USDT");
    }
    // ETH-USDT should still be fine
    const result = risk.preTradeCheck("ETH-USDT", "BUY", 1000, inv);
    expect(result.allowed).toBe(true);
  });

  // ─── Resume ───────────────────────────────────────────────

  test("resume clears halt state", () => {
    // Trigger halt
    inv.recordFill("BTC-USDT", "BUY", 1, 60000);
    inv.recordFill("BTC-USDT", "SELL", 1, 48000);
    risk.preTradeCheck("BTC-USDT", "BUY", 1000, inv);

    expect(risk.isHalted()).toBe(true);
    risk.resume();
    expect(risk.isHalted()).toBe(false);
    expect(risk.getHaltReason()).toBeNull();
  });

  // ─── Risk Events ──────────────────────────────────────────

  test("fires MAX_LOSS_BREACHED event", () => {
    let firedEvent = "" as string;
    risk.onRiskEvent((event) => {
      firedEvent = event;
    });

    inv.recordFill("BTC-USDT", "BUY", 1, 60000);
    inv.recordFill("BTC-USDT", "SELL", 1, 48000);
    risk.preTradeCheck("BTC-USDT", "BUY", 1000, inv);

    expect(firedEvent).toBe("MAX_LOSS_BREACHED");
  });

  test("fires MAX_POSITION_BREACHED event", () => {
    let firedEvent = "" as string;
    risk.onRiskEvent((event) => {
      firedEvent = event;
    });

    inv.recordFill("BTC-USDT", "BUY", 2, 50000);
    inv.markToMarket("BTC-USDT", 50000); // m2m PnL = 0, no loss halt
    risk.preTradeCheck("BTC-USDT", "BUY", 10000, inv);

    expect(firedEvent).toBe("MAX_POSITION_BREACHED");
  });

  test("fires RATE_LIMIT_WARNING event", () => {
    let firedEvent = "" as string;
    risk.onRiskEvent((event) => {
      firedEvent = event;
    });

    for (let i = 0; i < 60; i++) {
      risk.recordOrder("BTC-USDT");
    }
    risk.preTradeCheck("BTC-USDT", "BUY", 1000, inv);

    expect(firedEvent).toBe("RATE_LIMIT_WARNING");
  });

  test("supports multiple event callbacks", () => {
    const events: string[] = [];
    risk.onRiskEvent((event) => events.push(`cb1:${event}`));
    risk.onRiskEvent((event) => events.push(`cb2:${event}`));

    inv.recordFill("BTC-USDT", "BUY", 2, 50000);
    inv.markToMarket("BTC-USDT", 50000); // m2m PnL = 0
    risk.preTradeCheck("BTC-USDT", "BUY", 10000, inv);

    expect(events).toContain("cb1:MAX_POSITION_BREACHED");
    expect(events).toContain("cb2:MAX_POSITION_BREACHED");
  });
});
