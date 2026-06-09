/**
 * Market Data Routes Tests
 * Tests for orderbook depth, ticker, and market data endpoints
 */

import { describe, expect, test, beforeAll } from 'bun:test';
import { Elysia } from 'elysia';
import { marketDataRoutes } from '../src/routes/marketdata';

describe('Market Data Routes', () => {
  let app: Elysia;

  beforeAll(() => {
    app = new Elysia().use(marketDataRoutes);
  });

  // ============================================================================
  // ORDERBOOK DEPTH TESTS
  // ============================================================================

  describe('GET /v1/depth', () => {
    test('should get orderbook depth with symbol', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/depth?symbol=BTC-USD', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.symbol).toBe('BTC-USD');
      expect(data.bids).toBeDefined();
      expect(data.asks).toBeDefined();
      expect(Array.isArray(data.bids)).toBe(true);
      expect(Array.isArray(data.asks)).toBe(true);
    });

    test('should accept limit parameter', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/depth?symbol=ETH-USD&limit=10', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.symbol).toBe('ETH-USD');
    });

    test('should require symbol parameter', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/depth', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(422);
    });

    test('should include lastUpdateId in response', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/depth?symbol=BTC-USD', {
          method: 'GET',
        })
      );

      const data = await response.json();
      expect(data.lastUpdateId).toBeDefined();
      expect(typeof data.lastUpdateId).toBe('number');
    });

    test('should handle different symbols', async () => {
      const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
      
      for (const symbol of symbols) {
        const response = await app.handle(
          new Request(`http://localhost/v1/depth?symbol=${symbol}`, {
            method: 'GET',
          })
        );

        expect(response.status).toBe(200);
        const data = await response.json();
        expect(data.symbol).toBe(symbol);
      }
    });

    test('should return empty arrays when no liquidity', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/depth?symbol=BTC-USD', {
          method: 'GET',
        })
      );

      const data = await response.json();
      expect(data.bids).toEqual([]);
      expect(data.asks).toEqual([]);
    });
  });

  // ============================================================================
  // 24H TICKER TESTS
  // ============================================================================

  describe('GET /v1/ticker/24hr', () => {
    test('should get 24h ticker stats', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/ticker/24hr', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.priceChange).toBeDefined();
      expect(data.priceChangePercent).toBeDefined();
      expect(data.volume).toBeDefined();
    });

    test('should accept symbol query parameter', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/ticker/24hr?symbol=BTC-USD', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.symbol).toBe('BTC-USD');
    });

    test('should work without symbol parameter', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/ticker/24hr', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
    });

    test('should return zero values when no data', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/ticker/24hr?symbol=NEW-PAIR', {
          method: 'GET',
        })
      );

      const data = await response.json();
      expect(data.priceChange).toBe('0');
      expect(data.priceChangePercent).toBe('0');
      expect(data.volume).toBe('0');
    });

    test('should handle multiple ticker requests', async () => {
      const symbols = ['BTC-USD', 'ETH-USD', 'SOL-USD'];
      
      const requests = symbols.map(symbol =>
        app.handle(
          new Request(`http://localhost/v1/ticker/24hr?symbol=${symbol}`, {
            method: 'GET',
          })
        )
      );

      const responses = await Promise.all(requests);
      
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    test('should handle invalid symbol format gracefully', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/depth?symbol=INVALID@SYMBOL!', {
          method: 'GET',
        })
      );

      // Should still return data (validation done in business logic)
      expect(response.status).toBe(200);
    });

    test('should handle invalid limit values', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/depth?symbol=BTC-USD&limit=-1', {
          method: 'GET',
        })
      );

      // Should handle gracefully
      expect(response.status).toBe(200);
    });

    test('should handle very large limit values', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/depth?symbol=BTC-USD&limit=999999', {
          method: 'GET',
        })
      );

      // Should cap or handle large limits
      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // PERFORMANCE TESTS
  // ============================================================================

  describe('Performance', () => {
    test('should handle concurrent depth requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        app.handle(
          new Request('http://localhost/v1/depth?symbol=BTC-USD', {
            method: 'GET',
          })
        )
      );

      const responses = await Promise.all(requests);
      
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });

    test('should handle concurrent ticker requests', async () => {
      const requests = Array(10).fill(null).map(() =>
        app.handle(
          new Request('http://localhost/v1/ticker/24hr?symbol=ETH-USD', {
            method: 'GET',
          })
        )
      );

      const responses = await Promise.all(requests);
      
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });
  });

  // ============================================================================
  // DATA FORMAT TESTS
  // ============================================================================

  describe('Data Format Validation', () => {
    test('should return bids and asks as arrays', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/depth?symbol=BTC-USD', {
          method: 'GET',
        })
      );

      const data = await response.json();
      expect(Array.isArray(data.bids)).toBe(true);
      expect(Array.isArray(data.asks)).toBe(true);
    });

    test('should return string values for ticker prices', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/ticker/24hr?symbol=BTC-USD', {
          method: 'GET',
        })
      );

      const data = await response.json();
      expect(typeof data.priceChange).toBe('string');
      expect(typeof data.priceChangePercent).toBe('string');
      expect(typeof data.volume).toBe('string');
    });

    test('should return number for lastUpdateId', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/depth?symbol=BTC-USD', {
          method: 'GET',
        })
      );

      const data = await response.json();
      expect(typeof data.lastUpdateId).toBe('number');
    });
  });
});
