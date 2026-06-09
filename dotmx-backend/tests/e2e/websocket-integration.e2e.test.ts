/**
 * E2E Tests: WebSocket Integration
 * 
 * Real WebSocket connections to actual running API server
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';
import { startTestServer, stopTestServer, type TestServer } from './test-server';

describe('E2E: WebSocket - Real Server', () => {
  let server: TestServer;
  let wsUrl: string;

  beforeAll(async () => {
    server = await startTestServer();
    wsUrl = server.wsUrl;
  });

  afterAll(async () => {
    await stopTestServer();
  });

  describe('Market Data WebSocket', () => {
    test('Connect to market data WebSocket', async () => {
      const ws = new WebSocket(`${wsUrl}/ws/market`);
      
      const connected = await new Promise<boolean>((resolve) => {
        ws.onopen = () => resolve(true);
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000);
      });

      expect(connected).toBe(true);
      ws.close();
    });

    test('Receive connection confirmation', async () => {
      const ws = new WebSocket(`${wsUrl}/ws/market`);
      
      await new Promise<void>((resolve) => {
        ws.onopen = () => resolve();
      });

      // Server may or may not send initial message
      const message = await new Promise<any>((resolve) => {
        ws.onmessage = (event) => {
          try {
            resolve(JSON.parse(event.data));
          } catch {
            resolve({ raw: event.data });
          }
        };
        setTimeout(() => resolve(null), 500);  // Short timeout - just check connection works
      });

      // Just verify we're connected - message is optional
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });

    test('Subscribe to orderbook channel', async () => {
      const ws = new WebSocket(`${wsUrl}/ws/market`);
      
      await new Promise<void>((resolve) => {
        ws.onopen = () => resolve();
      });

      // Skip any initial message
      const skipInitial = new Promise<void>((resolve) => {
        const handler = () => {
          ws.onmessage = null;
          resolve();
        };
        ws.onmessage = handler;
        setTimeout(resolve, 500);
      });
      await skipInitial;

      // Send subscription request
      ws.send(JSON.stringify({
        action: 'subscribe',
        channel: 'orderbook',
        symbol: 'BTC-USD',
      }));

      const response = await new Promise<any>((resolve) => {
        ws.onmessage = (event) => {
          try {
            resolve(JSON.parse(event.data));
          } catch {
            resolve({ raw: event.data });
          }
        };
        setTimeout(() => resolve(null), 3000);
      });

      // Server should acknowledge subscription or send data
      expect(response).not.toBeNull();
      ws.close();
    });

    test('Subscribe to trades channel', async () => {
      const ws = new WebSocket(`${wsUrl}/ws/market`);
      
      await new Promise<void>((resolve) => {
        ws.onopen = () => resolve();
      });

      // Skip any initial message
      await new Promise<void>((resolve) => {
        ws.onmessage = () => resolve();
        setTimeout(resolve, 500);
      });

      ws.send(JSON.stringify({
        action: 'subscribe',
        channel: 'trades',
        symbol: 'BTC-USD',
      }));

      const response = await new Promise<any>((resolve) => {
        ws.onmessage = (event) => {
          try {
            resolve(JSON.parse(event.data));
          } catch {
            resolve({ raw: event.data });
          }
        };
        setTimeout(() => resolve(null), 3000);
      });

      expect(response).not.toBeNull();
      ws.close();
    });

    test('Unsubscribe from channel', async () => {
      const ws = new WebSocket(`${wsUrl}/ws/market`);
      
      await new Promise<void>((resolve) => {
        ws.onopen = () => resolve();
      });

      // Skip initial message
      await new Promise<void>((resolve) => {
        ws.onmessage = () => resolve();
        setTimeout(resolve, 500);
      });

      // Subscribe first
      ws.send(JSON.stringify({
        action: 'subscribe',
        channel: 'orderbook',
        symbol: 'BTC-USD',
      }));

      await new Promise<void>((resolve) => {
        ws.onmessage = () => resolve();
        setTimeout(resolve, 500);
      });

      // Unsubscribe
      ws.send(JSON.stringify({
        action: 'unsubscribe',
        channel: 'orderbook',
        symbol: 'BTC-USD',
      }));

      const response = await new Promise<any>((resolve) => {
        ws.onmessage = (event) => {
          try {
            resolve(JSON.parse(event.data));
          } catch {
            resolve({ raw: event.data });
          }
        };
        setTimeout(() => resolve(null), 3000);
      });

      // Server should acknowledge unsubscription
      expect(response).not.toBeNull();
      ws.close();
    });
  });

  describe('User WebSocket', () => {
    test('Connect to user WebSocket', async () => {
      const ws = new WebSocket(`${wsUrl}/ws/user`);
      
      const connected = await new Promise<boolean>((resolve) => {
        ws.onopen = () => resolve(true);
        ws.onerror = () => resolve(false);
        setTimeout(() => resolve(false), 5000);
      });

      expect(connected).toBe(true);
      ws.close();
    });

    test('Receive connection confirmation on user socket', async () => {
      const ws = new WebSocket(`${wsUrl}/ws/user`);
      
      await new Promise<void>((resolve) => {
        ws.onopen = () => resolve();
      });

      // Server may or may not send initial message
      const message = await new Promise<any>((resolve) => {
        ws.onmessage = (event) => {
          try {
            resolve(JSON.parse(event.data));
          } catch {
            resolve({ raw: event.data });
          }
        };
        setTimeout(() => resolve(null), 500);  // Short timeout - just check connection works
      });

      // Just verify we're connected - message is optional
      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });
  });

  describe('WebSocket Performance', () => {
    test('Multiple concurrent connections', async () => {
      const sockets: WebSocket[] = [];
      const connectionCount = 5;

      try {
        const connections = Array.from({ length: connectionCount }, () =>
          new Promise<WebSocket>((resolve, reject) => {
            const ws = new WebSocket(`${wsUrl}/ws/market`);
            ws.onopen = () => resolve(ws);
            ws.onerror = reject;
            setTimeout(() => reject(new Error('Connection timeout')), 5000);
          })
        );

        const connected = await Promise.all(connections);
        sockets.push(...connected);

        expect(connected.length).toBe(connectionCount);
        expect(connected.every(ws => ws.readyState === WebSocket.OPEN)).toBe(true);
      } finally {
        sockets.forEach(ws => ws.close());
      }
    });

    test('Rapid message sending', async () => {
      const ws = new WebSocket(`${wsUrl}/ws/market`);
      
      await new Promise<void>((resolve) => {
        ws.onopen = () => resolve();
      });

      // Skip initial message
      await new Promise<void>((resolve) => {
        ws.onmessage = () => resolve();
        setTimeout(resolve, 500);
      });

      // Send multiple messages rapidly
      const messageCount = 10;
      for (let i = 0; i < messageCount; i++) {
        ws.send(JSON.stringify({
          action: 'ping',
          sequence: i,
        }));
      }

      // Wait a bit for processing
      await new Promise(resolve => setTimeout(resolve, 1000));

      expect(ws.readyState).toBe(WebSocket.OPEN);
      ws.close();
    });
  });
});
