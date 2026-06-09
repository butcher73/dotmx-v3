/**
 * E2E Tests: Trading Workflow
 * 
 * Real HTTP requests to actual running API server
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, stopTestServer, type TestServer } from './test-server';

describe('E2E: Trading - Real Server', () => {
  let server: TestServer;
  let baseUrl: string;

  beforeAll(async () => {
    server = await startTestServer();
    baseUrl = server.baseUrl;
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe('Order Placement', () => {
    test('Create limit BUY order with valid data', async () => {
      const response = await fetch(`${baseUrl}/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 50000,
          quantity: 0.1,
        }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data).toBeDefined();
    });

    test('Create limit SELL order with valid data', async () => {
      const response = await fetch(`${baseUrl}/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          side: 'SELL',
          type: 'LIMIT',
          price: 51000,
          quantity: 0.1,
        }),
      });

      expect(response.status).toBe(200);
    });

    test('Create MARKET order', async () => {
      const response = await fetch(`${baseUrl}/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'ETH-USD',
          side: 'BUY',
          type: 'MARKET',
          quantity: 1.0,
        }),
      });

      expect(response.status).toBe(200);
    });

    test('Create IOC order', async () => {
      const response = await fetch(`${baseUrl}/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 49000,
          quantity: 0.5,
          timeInForce: 'IOC',
        }),
      });

      expect(response.status).toBe(200);
    });

    test('Order with clientOrderId', async () => {
      const clientOrderId = `e2e-test-${Date.now()}`;
      const response = await fetch(`${baseUrl}/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 48000,
          quantity: 0.2,
          clientOrderId,
        }),
      });

      expect(response.status).toBe(200);
    });
  });

  describe('Order Validation', () => {
    test('Reject order with invalid side', async () => {
      const response = await fetch(`${baseUrl}/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          side: 'INVALID',
          type: 'LIMIT',
          price: 50000,
          quantity: 0.1,
        }),
      });

      expect([400, 422]).toContain(response.status);
    });

    test('Reject order with invalid type', async () => {
      const response = await fetch(`${baseUrl}/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'INVALID_TYPE',
          price: 50000,
          quantity: 0.1,
        }),
      });

      expect([400, 422]).toContain(response.status);
    });

    test('Reject order with zero quantity', async () => {
      const response = await fetch(`${baseUrl}/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 50000,
          quantity: 0,
        }),
      });

      expect([400, 422]).toContain(response.status);
    });

    test('Reject order with negative quantity', async () => {
      const response = await fetch(`${baseUrl}/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 50000,
          quantity: -1,
        }),
      });

      expect([400, 422]).toContain(response.status);
    });
  });

  describe('Order Management', () => {
    test('Cancel order by orderId', async () => {
      const response = await fetch(`${baseUrl}/v1/orders/test-order-123`, {
        method: 'DELETE',
      });

      // 200 if found, 404 if not found
      expect([200, 404]).toContain(response.status);
    });

    test('Get order status', async () => {
      const response = await fetch(`${baseUrl}/v1/orders/test-order-123`, {
        method: 'GET',
      });

      expect([200, 404]).toContain(response.status);
    });

    test('Get open orders', async () => {
      const response = await fetch(`${baseUrl}/v1/openOrders?symbol=BTC-USD`, {
        method: 'GET',
      });

      expect([200, 404]).toContain(response.status);
    });

    test('Get trades', async () => {
      const response = await fetch(`${baseUrl}/v1/trades?symbol=BTC-USD`, {
        method: 'GET',
      });

      expect([200, 404]).toContain(response.status);
    });
  });

  describe('Performance', () => {
    test('Handle concurrent order submissions', async () => {
      const orders = Array.from({ length: 5 }, (_, i) =>
        fetch(`${baseUrl}/v1/orders`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            side: i % 2 === 0 ? 'BUY' : 'SELL',
            type: 'LIMIT',
            price: 50000 + i * 100,
            quantity: 0.1,
          }),
        })
      );

      const responses = await Promise.all(orders);

      for (const response of responses) {
        expect(response.status).toBe(200);
      }
    });

    test('Response time under 500ms', async () => {
      const start = performance.now();
      
      await fetch(`${baseUrl}/v1/orders`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: 'BTC-USD',
          side: 'BUY',
          type: 'LIMIT',
          price: 50000,
          quantity: 0.1,
        }),
      });
      
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(500);
    });
  });
});
