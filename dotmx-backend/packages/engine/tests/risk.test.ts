/**
 * Engine Tests - Risk Checks
 */

import { describe, test, expect } from "bun:test";
import { checkRisk, validateTickSize, validateLotSize, checkPriceBands, type RiskConfig, defaultRiskConfig } from "../src/risk";

describe("Risk Checks", () => {
  const config: RiskConfig = {
    maxOrderSize: 100,
    maxNotional: 1_000_000,
    priceDeviationThreshold: 0.1, // 10%
    tickSize: 0.01,
    lotSize: 0.001,
  };

  describe("validateTickSize", () => {
    test("should accept price on tick", () => {
      expect(validateTickSize(50000.00, 0.01)).toBe(true);
      expect(validateTickSize(50000.01, 0.01)).toBe(true);
      expect(validateTickSize(50000.99, 0.01)).toBe(true);
    });

    test("should reject price not on tick", () => {
      expect(validateTickSize(50000.005, 0.01)).toBe(false);
      expect(validateTickSize(50000.001, 0.01)).toBe(false);
    });
  });

  describe("validateLotSize", () => {
    test("should accept quantity on lot", () => {
      expect(validateLotSize(1.000, 0.001)).toBe(true);
      expect(validateLotSize(1.001, 0.001)).toBe(true);
      expect(validateLotSize(0.999, 0.001)).toBe(true);
    });

    test("should reject quantity not on lot", () => {
      expect(validateLotSize(1.0005, 0.001)).toBe(false);
      expect(validateLotSize(1.0001, 0.001)).toBe(false);
    });
  });

  describe("checkPriceBands", () => {
    test("should accept price within band", () => {
      expect(checkPriceBands(50000, 50000, 0.1)).toBe(true);
      expect(checkPriceBands(52000, 50000, 0.1)).toBe(true); // 4% deviation
      expect(checkPriceBands(48000, 50000, 0.1)).toBe(true); // 4% deviation
    });

    test("should reject price outside band", () => {
      expect(checkPriceBands(60000, 50000, 0.1)).toBe(false); // 20% deviation
      expect(checkPriceBands(40000, 50000, 0.1)).toBe(false); // 20% deviation
    });

    test("should accept any price when no mark price", () => {
      expect(checkPriceBands(100000, 0, 0.1)).toBe(true);
    });
  });

  describe("checkRisk", () => {
    test("should pass valid order", () => {
      const result = checkRisk(
        { userId: "user1", symbol: "BTC-USDT", side: "BUY", price: 50000, quantity: 1 },
        50000,
        config
      );

      expect(result.allowed).toBe(true);
    });

    test("should reject zero quantity", () => {
      const result = checkRisk(
        { userId: "user1", symbol: "BTC-USDT", side: "BUY", price: 50000, quantity: 0 },
        50000,
        config
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("INVALID_QUANTITY");
    });

    test("should reject negative price", () => {
      const result = checkRisk(
        { userId: "user1", symbol: "BTC-USDT", side: "BUY", price: -100, quantity: 1 },
        50000,
        config
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("INVALID_PRICE");
    });

    test("should reject order exceeding max size", () => {
      const result = checkRisk(
        { userId: "user1", symbol: "BTC-USDT", side: "BUY", price: 50000, quantity: 150 },
        50000,
        config
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("ORDER_SIZE_EXCEEDED");
    });

    test("should reject order exceeding max notional", () => {
      const result = checkRisk(
        { userId: "user1", symbol: "BTC-USDT", side: "BUY", price: 50000, quantity: 25 }, // 1.25M notional
        50000,
        config
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("NOTIONAL_EXCEEDED");
    });

    test("should reject price outside band", () => {
      const result = checkRisk(
        { userId: "user1", symbol: "BTC-USDT", side: "BUY", price: 60000, quantity: 1 }, // 20% deviation
        50000,
        config
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("PRICE_DEVIATION_EXCEEDED");
    });

    test("should reject price not on tick", () => {
      const result = checkRisk(
        { userId: "user1", symbol: "BTC-USDT", side: "BUY", price: 50000.005, quantity: 1 },
        50000,
        config
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("INVALID_TICK_SIZE");
    });

    test("should reject quantity not on lot", () => {
      const result = checkRisk(
        { userId: "user1", symbol: "BTC-USDT", side: "BUY", price: 50000, quantity: 1.0005 },
        50000,
        config
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toBe("INVALID_LOT_SIZE");
    });
  });
});
