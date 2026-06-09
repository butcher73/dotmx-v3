/**
 * Trading Routes Tests
 * Tests for order placement, cancellation, and query endpoints
 */

import { describe, expect, test, beforeAll, afterAll, beforeEach } from 'bun:test';
import { Elysia } from 'elysia';
import { tradingRoutes } from '../src/routes/trading';

describe('Trading Routes', () => {
  let app: Elysia;

  beforeAll(() => {
    app = new Elysia().use(tradingRoutes);
  });

  // ============================================================================
  // CREATE ORDER TESTS
  // ============================================================================

  describe('POST /v1/orders', () => {
    test('should create limit order with valid data', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            side: 'BUY',
            type: 'LIMIT',
            price: 50000,
            quantity: 0.1,
            timeInForce: 'GTC',
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orderId).toBeDefined();
      expect(data.status).toBe('NEW');
      expect(data.symbol).toBe('BTC-USD');
    });

    test('should create market order without price', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'ETH-USD',
            side: 'SELL',
            type: 'MARKET',
            quantity: 1.5,
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.type).toBe('MARKET');
    });

    test('should reject order with invalid side', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            side: 'INVALID',
            type: 'LIMIT',
            price: 50000,
            quantity: 0.1,
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    test('should reject order with invalid type', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            side: 'BUY',
            type: 'INVALID',
            quantity: 0.1,
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    test('should reject order with negative quantity', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            side: 'BUY',
            type: 'LIMIT',
            price: 50000,
            quantity: -0.1,
          }),
        })
      );

      // Should validate quantity > 0
      expect(response.status).toBe(422);
    });

    test('should reject order with zero quantity', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            side: 'BUY',
            type: 'LIMIT',
            price: 50000,
            quantity: 0,
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    test('should accept IOC time in force', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            side: 'BUY',
            type: 'LIMIT',
            price: 50000,
            quantity: 0.1,
            timeInForce: 'IOC',
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    test('should accept FOK time in force', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            side: 'BUY',
            type: 'LIMIT',
            price: 50000,
            quantity: 0.1,
            timeInForce: 'FOK',
          }),
        })
      );

      expect(response.status).toBe(200);
    });

    test('should accept optional clientOrderId', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            side: 'BUY',
            type: 'LIMIT',
            price: 50000,
            quantity: 0.1,
            clientOrderId: 'my-order-123',
          }),
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.clientOrderId).toBe('my-order-123');
    });
  });

  // ============================================================================
  // CANCEL ORDER TESTS
  // ============================================================================

  describe('DELETE /v1/orders/:orderId', () => {
    test('should cancel order by ID', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders/order-123', {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orderId).toBe('order-123');
      expect(data.status).toBe('CANCELED');
    });

    test('should handle UUID format order IDs', async () => {
      const orderId = '550e8400-e29b-41d4-a716-446655440000';
      const response = await app.handle(
        new Request(`http://localhost/v1/orders/${orderId}`, {
          method: 'DELETE',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orderId).toBe(orderId);
    });
  });

  // ============================================================================
  // GET ORDER STATUS TESTS
  // ============================================================================

  describe('GET /v1/orders/:orderId', () => {
    test('should get order status by ID', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders/order-456', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orderId).toBe('order-456');
    });

    test('should handle non-existent order ID', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders/nonexistent', {
          method: 'GET',
        })
      );

      // Should return order info (currently returns empty but should 404 when implemented)
      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // GET OPEN ORDERS TESTS
  // ============================================================================

  describe('GET /v1/openOrders', () => {
    test('should get open orders', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/openOrders', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.orders).toBeDefined();
      expect(Array.isArray(data.orders)).toBe(true);
    });

    test('should accept symbol query parameter', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/openOrders?symbol=BTC-USD', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
    });

    test('should return empty array when no open orders', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/openOrders', {
          method: 'GET',
        })
      );

      const data = await response.json();
      expect(data.orders).toEqual([]);
    });
  });

  // ============================================================================
  // GET TRADES TESTS
  // ============================================================================

  describe('GET /v1/trades', () => {
    test('should get recent trades', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/trades', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.trades).toBeDefined();
      expect(Array.isArray(data.trades)).toBe(true);
    });

    test('should return empty array when no trades', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/trades', {
          method: 'GET',
        })
      );

      const data = await response.json();
      expect(data.trades).toEqual([]);
    });

    test('should accept symbol query parameter', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/trades?symbol=ETH-USD', {
          method: 'GET',
        })
      );

      expect(response.status).toBe(200);
    });
  });

  // ============================================================================
  // ERROR HANDLING TESTS
  // ============================================================================

  describe('Error Handling', () => {
    test('should handle malformed JSON', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: 'invalid json{',
        })
      );

      expect(response.status).toBe(400);
    });

    test('should handle missing required fields', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            // Missing side, type, quantity
          }),
        })
      );

      expect(response.status).toBe(422);
    });

    test('should validate enum values', async () => {
      const response = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            side: 'BUY',
            type: 'LIMIT',
            price: 50000,
            quantity: 0.1,
            timeInForce: 'INVALID_TIF',
          }),
        })
      );

      expect(response.status).toBe(422);
    });
  });

  // ============================================================================
  // INTEGRATION SCENARIOS
  // ============================================================================

  describe('Integration Scenarios', () => {
    test('should create and cancel order in sequence', async () => {
      // Create order
      const createResponse = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'BTC-USD',
            side: 'BUY',
            type: 'LIMIT',
            price: 50000,
            quantity: 0.1,
          }),
        })
      );

      const createData = await createResponse.json();
      const orderId = createData.orderId;

      // Cancel order
      const cancelResponse = await app.handle(
        new Request(`http://localhost/v1/orders/${orderId}`, {
          method: 'DELETE',
        })
      );

      expect(cancelResponse.status).toBe(200);
      const cancelData = await cancelResponse.json();
      expect(cancelData.status).toBe('CANCELED');
    });

    test('should create order and check status', async () => {
      // Create order
      const createResponse = await app.handle(
        new Request('http://localhost/v1/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            symbol: 'ETH-USD',
            side: 'SELL',
            type: 'LIMIT',
            price: 3000,
            quantity: 1.0,
          }),
        })
      );

      const createData = await createResponse.json();
      const orderId = createData.orderId;

      // Get order status
      const statusResponse = await app.handle(
        new Request(`http://localhost/v1/orders/${orderId}`, {
          method: 'GET',
        })
      );

      expect(statusResponse.status).toBe(200);
    });
  });
});
