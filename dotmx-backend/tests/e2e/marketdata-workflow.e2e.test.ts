/**
 * E2E Tests: Market Data Workflow
 * 
 * Real HTTP requests to actual running API server
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, stopTestServer, type TestServer } from './test-server';

describe('E2E: Market Data - Real Server', () => {
  let server: TestServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe('Orderbook Depth', () => {
    test('Get orderbook depth for valid symbol', async () => {
      const response = await fetch(`${baseUrl}/v1/depth?symbol=BTC-USD`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test('Get orderbook depth with limit parameter', async () => {
      const response = await fetch(`${baseUrl}/v1/depth?symbol=BTC-USD&limit=50`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test('Reject depth request without symbol', async () => {
      const response = await fetch(`${baseUrl}/v1/depth`);

      // API returns 422 for validation errors
      expect([400, 422]).toContain(response.status);
    });

    test('Handle unknown symbol gracefully', async () => {
      const response = await fetch(`${baseUrl}/v1/depth?symbol=UNKNOWN-PAIR`);

      // Should return empty orderbook or error
      expect([200, 400, 404]).toContain(response.status);
    });
  });

  describe('Ticker 24hr', () => {
    test('Get 24hr ticker for valid symbol', async () => {
      const response = await fetch(`${baseUrl}/v1/ticker/24hr?symbol=BTC-USD`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test('Get 24hr ticker for ETH-USD', async () => {
      const response = await fetch(`${baseUrl}/v1/ticker/24hr?symbol=ETH-USD`);

      expect(response.status).toBe(200);
    });

    test('Get all tickers without symbol filter', async () => {
      const response = await fetch(`${baseUrl}/v1/ticker/24hr`);

      // May return all tickers or require symbol
      expect([200, 400, 422]).toContain(response.status);
    });
  });

  describe('Multiple Symbols', () => {
    test('Handle sequential requests for different symbols', async () => {
      const symbols = ['BTC-USD', 'ETH-USD'];
      
      for (const symbol of symbols) {
        const response = await fetch(`${baseUrl}/v1/depth?symbol=${symbol}`);
        expect(response.status).toBe(200);
      }
    });
  });

  describe('Performance', () => {
    test('Handle concurrent depth requests', async () => {
      const requests = Array.from({ length: 10 }, () =>
        fetch(`${baseUrl}/v1/depth?symbol=BTC-USD`)
      );

      const responses = await Promise.all(requests);
      
      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });

    test('Response time under 200ms for depth endpoint', async () => {
      const start = performance.now();
      
      await fetch(`${baseUrl}/v1/depth?symbol=BTC-USD`);
      
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(200);
    });

    test('Response time under 200ms for ticker endpoint', async () => {
      const start = performance.now();
      
      await fetch(`${baseUrl}/v1/ticker/24hr?symbol=BTC-USD`);
      
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(200);
    });
  });

  describe('Health Check', () => {
    test('Health check returns healthy status', async () => {
      const response = await fetch(`${baseUrl}/health`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.status).toBe('healthy');
      expect(data.services).toBeDefined();
      expect(data.services.database).toBe('up');
    });

    test('Root endpoint returns API info', async () => {
      const response = await fetch(`${baseUrl}/`);

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.name).toContain('DotMX');
      expect(data.version).toBeDefined();
    });
  });
});
