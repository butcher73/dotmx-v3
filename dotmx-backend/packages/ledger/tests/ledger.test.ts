/**
 * Ledger Package Tests
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  createBalanceStore,
  createPositionStore,
  calculateMarginState,
  canOpenPosition,
  calculateRequiredMargin,
  calculateFundingPayment,
  defaultMarginConfig,
} from "../src";
import type { Position } from "../src/positions";

// =============================================================================
// BALANCE TESTS
// =============================================================================

describe("Balance Store", () => {
  let store: ReturnType<typeof createBalanceStore>;

  beforeEach(() => {
    store = createBalanceStore();
  });

  it("should get zero balance for new user", () => {
    const balance = store.getBalance("user1", "USDT");
    expect(balance.available).toBe(0);
    expect(balance.locked).toBe(0);
    expect(balance.total).toBe(0);
  });

  it("should credit balance", () => {
    store.credit("user1", "USDT", 1000);
    const balance = store.getBalance("user1", "USDT");
    expect(balance.available).toBe(1000);
    expect(balance.total).toBe(1000);
  });

  it("should debit balance", () => {
    store.credit("user1", "USDT", 1000);
    const result = store.debit("user1", "USDT", 300);
    expect(result).toBe(true);
    expect(store.getBalance("user1", "USDT").available).toBe(700);
  });

  it("should fail to debit more than available", () => {
    store.credit("user1", "USDT", 100);
    const result = store.debit("user1", "USDT", 200);
    expect(result).toBe(false);
    expect(store.getBalance("user1", "USDT").available).toBe(100);
  });

  it("should lock balance", () => {
    store.credit("user1", "USDT", 1000);
    const result = store.lock("user1", "USDT", 400);
    expect(result).toBe(true);
    const balance = store.getBalance("user1", "USDT");
    expect(balance.available).toBe(600);
    expect(balance.locked).toBe(400);
    expect(balance.total).toBe(1000);
  });

  it("should unlock balance", () => {
    store.credit("user1", "USDT", 1000);
    store.lock("user1", "USDT", 400);
    store.unlock("user1", "USDT", 200);
    const balance = store.getBalance("user1", "USDT");
    expect(balance.available).toBe(800);
    expect(balance.locked).toBe(200);
  });

  it("should fail to lock more than available", () => {
    store.credit("user1", "USDT", 100);
    const result = store.lock("user1", "USDT", 200);
    expect(result).toBe(false);
  });

  it("should transfer between users", () => {
    store.credit("user1", "USDT", 1000);
    const result = store.transfer("user1", "user2", "USDT", 300);
    expect(result).toBe(true);
    expect(store.getBalance("user1", "USDT").available).toBe(700);
    expect(store.getBalance("user2", "USDT").available).toBe(300);
  });

  it("should get all balances for user", () => {
    store.credit("user1", "USDT", 1000);
    store.credit("user1", "BTC", 0.5);
    store.credit("user1", "ETH", 10);
    const balances = store.getAllBalances("user1");
    expect(balances.size).toBe(3);
  });
});

// =============================================================================
// POSITION TESTS
// =============================================================================

describe("Position Store", () => {
  let store: ReturnType<typeof createPositionStore>;

  beforeEach(() => {
    store = createPositionStore();
  });

  it("should return null for no position", () => {
    const position = store.getPosition("user1", "BTC-USD");
    expect(position).toBeNull();
  });

  it("should open long position", () => {
    store.openPosition("user1", "BTC-USD", 1, 50000, 5000, 10);
    const position = store.getPosition("user1", "BTC-USD");
    expect(position).not.toBeNull();
    expect(position!.size).toBe(1);
    expect(position!.entryPrice).toBe(50000);
    expect(position!.margin).toBe(5000);
    expect(position!.leverage).toBe(10);
  });

  it("should calculate unrealized PnL for long", () => {
    store.openPosition("user1", "BTC-USD", 1, 50000, 5000, 10);
    const pnl = store.calculatePnL("user1", "BTC-USD", 55000);
    expect(pnl).toBe(5000); // (55000 - 50000) * 1
  });

  it("should calculate unrealized PnL for short", () => {
    store.openPosition("user1", "BTC-USD", -1, 50000, 5000, 10);
    const pnl = store.calculatePnL("user1", "BTC-USD", 45000);
    expect(pnl).toBe(5000); // (50000 - 45000) * 1
  });

  it("should update position size", () => {
    store.openPosition("user1", "BTC-USD", 1, 50000, 5000, 10);
    store.updatePosition("user1", "BTC-USD", { size: 2, entryPrice: 52500 });
    const position = store.getPosition("user1", "BTC-USD");
    expect(position!.size).toBe(2);
    expect(position!.entryPrice).toBe(52500);
  });

  it("should close position", () => {
    store.openPosition("user1", "BTC-USD", 1, 50000, 5000, 10);
    const closed = store.closePosition("user1", "BTC-USD");
    expect(closed).not.toBeNull();
    expect(store.getPosition("user1", "BTC-USD")).toBeNull();
  });

  it("should get all positions for user", () => {
    store.openPosition("user1", "BTC-USD", 1, 50000, 5000, 10);
    store.openPosition("user1", "ETH-USD", 10, 3000, 3000, 10);
    const positions = store.getUserPositions("user1");
    expect(positions.length).toBe(2);
  });

  it("should calculate liquidation price for long", () => {
    store.openPosition("user1", "BTC-USD", 1, 50000, 5000, 10);
    const liqPrice = store.getLiquidationPrice("user1", "BTC-USD", 0.05);
    // Long: entry - (margin * (1 - mmr)) / size = 50000 - (5000 * 0.95) / 1 = 45250
    expect(liqPrice).toBeCloseTo(45250);
  });

  it("should calculate liquidation price for short", () => {
    store.openPosition("user1", "BTC-USD", -1, 50000, 5000, 10);
    const liqPrice = store.getLiquidationPrice("user1", "BTC-USD", 0.05);
    // Short: entry + (margin * (1 - mmr)) / |size| = 50000 + 4750 = 54750
    expect(liqPrice).toBeCloseTo(54750);
  });
});

// =============================================================================
// MARGIN CALCULATION TESTS
// =============================================================================

describe("Margin Calculations", () => {
  it("should calculate required margin", () => {
    const required = calculateRequiredMargin(1, 50000, 10);
    // notional / leverage = 50000 / 10 = 5000
    expect(required).toBe(5000);
  });

  it("should check if position can be opened", () => {
    const marginState = {
      userId: "user1",
      totalCollateral: 10000,
      totalMarginUsed: 5000,
      totalUnrealizedPnl: 0,
      freeMargin: 5000,
      marginRatio: 0.5,
      maintenanceMargin: 250,
      isLiquidatable: false,
    };

    const result = canOpenPosition(marginState, 40000, 10); // Need 4000 margin
    expect(result.allowed).toBe(true);

    const result2 = canOpenPosition(marginState, 60000, 10); // Need 6000 margin
    expect(result2.allowed).toBe(false);
    expect(result2.reason).toBe("INSUFFICIENT_MARGIN");
  });

  it("should calculate funding payment for long position", () => {
    const position: Position = {
      userId: "user1",
      symbol: "BTC-USD",
      side: "LONG",
      size: 1,
      entryPrice: 50000,
      leverage: 10,
      liquidationPrice: 45000,
      margin: 5000,
      unrealizedPnl: 0,
      realizedPnl: 0,
      openedAt: Date.now(),
      lastUpdated: Date.now(),
    };

    // Positive rate = longs pay
    const payment = calculateFundingPayment(position, 0.0001);
    expect(payment).toBe(-5); // -(50000 * 0.0001)
  });

  it("should calculate funding payment for short position", () => {
    const position: Position = {
      userId: "user1",
      symbol: "BTC-USD",
      side: "SHORT",
      size: 1,
      entryPrice: 50000,
      leverage: 10,
      liquidationPrice: 55000,
      margin: 5000,
      unrealizedPnl: 0,
      realizedPnl: 0,
      openedAt: Date.now(),
      lastUpdated: Date.now(),
    };

    // Positive rate = shorts receive
    const payment = calculateFundingPayment(position, 0.0001);
    expect(payment).toBe(5); // +(50000 * 0.0001)
  });
});
