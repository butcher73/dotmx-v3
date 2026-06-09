/**
 * Config Tests
 *
 * Validates MM account definitions: uniqueness, realistic identities,
 * no bot-revealing patterns, complete market coverage.
 */

import { describe, test, expect } from "bun:test";
import { MM_ACCOUNTS, CONFIG, MmAccountConfig } from "../src/config";

describe("MM_ACCOUNTS", () => {
  test("has exactly 10 accounts", () => {
    expect(MM_ACCOUNTS).toHaveLength(10);
  });

  test("all IDs are unique", () => {
    const ids = MM_ACCOUNTS.map((a) => a.id);
    expect(new Set(ids).size).toBe(10);
  });

  test("all emails are unique", () => {
    const emails = MM_ACCOUNTS.map((a) => a.email);
    expect(new Set(emails).size).toBe(10);
  });

  test("all usernames are unique", () => {
    const usernames = MM_ACCOUNTS.map((a) => a.username);
    expect(new Set(usernames).size).toBe(10);
  });

  test("emails use realistic domains (no @dotmx.exchange)", () => {
    const botDomains = ["dotmx.exchange", "dotmx.com", "bot.com"];
    for (const account of MM_ACCOUNTS) {
      const domain = account.email.split("@")[1];
      expect(botDomains).not.toContain(domain);
      expect(account.email).toMatch(/^[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}$/i);
    }
  });

  test("names do not contain bot-revealing patterns", () => {
    const botPatterns = /\b(bot|mm|market[- ]?maker|automated|system)\b/i;
    for (const account of MM_ACCOUNTS) {
      expect(account.firstName).not.toMatch(botPatterns);
      expect(account.lastName).not.toMatch(botPatterns);
      expect(account.username).not.toMatch(botPatterns);
    }
  });

  test("usernames do not contain mm- prefix", () => {
    for (const account of MM_ACCOUNTS) {
      expect(account.username).not.toMatch(/^mm[-_]/);
    }
  });

  test("each account has firstName and lastName", () => {
    for (const account of MM_ACCOUNTS) {
      expect(account.firstName.length).toBeGreaterThan(0);
      expect(account.lastName.length).toBeGreaterThan(0);
    }
  });

  test("each account has at least one market", () => {
    for (const account of MM_ACCOUNTS) {
      expect(account.markets.length).toBeGreaterThan(0);
    }
  });

  test("seed balance is $1,000,000 for all accounts", () => {
    for (const account of MM_ACCOUNTS) {
      expect(account.seedBalanceUsd).toBe(1_000_000);
    }
  });

  test("strategy is one of: symmetric, skewed, passive", () => {
    const validStrategies = ["symmetric", "skewed", "passive"];
    for (const account of MM_ACCOUNTS) {
      expect(validStrategies).toContain(account.strategy);
    }
  });

  test("spread is positive and reasonable (1-200 bps)", () => {
    for (const account of MM_ACCOUNTS) {
      expect(account.spreadBps).toBeGreaterThan(0);
      expect(account.spreadBps).toBeLessThanOrEqual(200);
    }
  });

  test("levels is between 1 and 20", () => {
    for (const account of MM_ACCOUNTS) {
      expect(account.levels).toBeGreaterThanOrEqual(1);
      expect(account.levels).toBeLessThanOrEqual(20);
    }
  });

  test("orderSizeUsd is positive", () => {
    for (const account of MM_ACCOUNTS) {
      expect(account.orderSizeUsd).toBeGreaterThan(0);
    }
  });

  test("maxPositionUsd is greater than orderSizeUsd", () => {
    for (const account of MM_ACCOUNTS) {
      expect(account.maxPositionUsd).toBeGreaterThan(account.orderSizeUsd);
    }
  });

  test("covers all 13 trading pairs across all accounts", () => {
    const allPairs = [
      "BTC-USDT", "ETH-USDT", "BNB-USDT", "SOL-USDT",
      "ARB-USDT", "OP-USDT", "DMX-USDT", "ETH-BTC",
      "BTC-USDC", "ETH-USDC", "DAI-USDT", "WBTC-USDT", "DOGE-USDT",
    ];
    const coveredPairs = new Set(MM_ACCOUNTS.flatMap((a) => a.markets));
    for (const pair of allPairs) {
      expect(coveredPairs.has(pair)).toBe(true);
    }
  });

  test("email domains are diverse (at least 5 different providers)", () => {
    const domains = new Set(MM_ACCOUNTS.map((a) => a.email.split("@")[1]));
    expect(domains.size).toBeGreaterThanOrEqual(5);
  });
});

describe("CONFIG", () => {
  test("symbolMap maps all DotMX pairs to Binance symbols", () => {
    const allMarkets = new Set(MM_ACCOUNTS.flatMap((a) => a.markets));
    for (const market of allMarkets) {
      // DMX-USDT might not have a Binance mapping — that's okay
      if (market === "DMX-USDT") continue;
      expect(CONFIG.symbolMap[market]).toBeDefined();
      expect(typeof CONFIG.symbolMap[market]).toBe("string");
    }
  });

  test("Binance symbols are lowercase and do not contain dashes", () => {
    for (const [, binanceSymbol] of Object.entries(CONFIG.symbolMap)) {
      if (!binanceSymbol) continue;
      expect(binanceSymbol).toBe(binanceSymbol.toLowerCase());
      expect(binanceSymbol).not.toContain("-");
    }
  });

  test("refreshIntervalMs is at least 1000ms", () => {
    expect(CONFIG.refreshIntervalMs).toBeGreaterThanOrEqual(1000);
  });

  test("maxLossUsd is positive", () => {
    expect(CONFIG.maxLossUsd).toBeGreaterThan(0);
  });

  test("inventorySkew is between 0 and 1", () => {
    expect(CONFIG.inventorySkew).toBeGreaterThanOrEqual(0);
    expect(CONFIG.inventorySkew).toBeLessThanOrEqual(1);
  });
});
