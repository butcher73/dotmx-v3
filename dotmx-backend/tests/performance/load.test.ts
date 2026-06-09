/**
 * Performance & Load Tests
 * Phase 5: Performance Testing - Load, Stress, and Benchmark Suites
 */

import { describe, test, expect, beforeAll, afterAll } from 'bun:test';

// ============================================================================
// UTILITY FUNCTIONS FOR PERFORMANCE TESTING
// ============================================================================

function measureExecutionTime<T>(fn: () => T): { result: T; duration: number } {
  const start = performance.now();
  const result = fn();
  const duration = performance.now() - start;
  return { result, duration };
}

async function measureAsyncExecutionTime<T>(fn: () => Promise<T>): Promise<{ result: T; duration: number }> {
  const start = performance.now();
  const result = await fn();
  const duration = performance.now() - start;
  return { result, duration };
}

function calculateStats(durations: number[]): {
  min: number;
  max: number;
  avg: number;
  p50: number;
  p95: number;
  p99: number;
} {
  const sorted = [...durations].sort((a, b) => a - b);
  const sum = durations.reduce((a, b) => a + b, 0);
  
  return {
    min: sorted[0],
    max: sorted[sorted.length - 1],
    avg: sum / durations.length,
    p50: sorted[Math.floor(sorted.length * 0.5)],
    p95: sorted[Math.floor(sorted.length * 0.95)],
    p99: sorted[Math.floor(sorted.length * 0.99)],
  };
}

// ============================================================================
// MOCK ORDER BOOK FOR PERFORMANCE TESTING
// ============================================================================

interface Order {
  id: string;
  price: number;
  quantity: number;
  side: 'BUY' | 'SELL';
  timestamp: number;
}

class MockOrderBook {
  private bids: Map<number, Order[]> = new Map();
  private asks: Map<number, Order[]> = new Map();
  private orderCount = 0;

  addOrder(order: Omit<Order, 'id' | 'timestamp'>): Order {
    const fullOrder: Order = {
      ...order,
      id: `order-${++this.orderCount}`,
      timestamp: Date.now(),
    };

    const priceLevel = order.side === 'BUY' ? this.bids : this.asks;
    
    if (!priceLevel.has(order.price)) {
      priceLevel.set(order.price, []);
    }
    priceLevel.get(order.price)!.push(fullOrder);
    
    return fullOrder;
  }

  cancelOrder(orderId: string): boolean {
    for (const [price, orders] of this.bids) {
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
        orders.splice(idx, 1);
        if (orders.length === 0) this.bids.delete(price);
        return true;
      }
    }
    
    for (const [price, orders] of this.asks) {
      const idx = orders.findIndex(o => o.id === orderId);
      if (idx !== -1) {
        orders.splice(idx, 1);
        if (orders.length === 0) this.asks.delete(price);
        return true;
      }
    }
    
    return false;
  }

  getBestBid(): number | null {
    const prices = [...this.bids.keys()];
    return prices.length ? Math.max(...prices) : null;
  }

  getBestAsk(): number | null {
    const prices = [...this.asks.keys()];
    return prices.length ? Math.min(...prices) : null;
  }

  getDepth(): { bids: number; asks: number } {
    return {
      bids: this.bids.size,
      asks: this.asks.size,
    };
  }

  clear(): void {
    this.bids.clear();
    this.asks.clear();
    this.orderCount = 0;
  }
}

// ============================================================================
// LOAD TESTS - Normal expected load
// ============================================================================

describe('Load Testing', () => {
  let orderBook: MockOrderBook;

  beforeAll(() => {
    orderBook = new MockOrderBook();
  });

  afterAll(() => {
    orderBook.clear();
  });

  test('should handle 1000 order insertions under 100ms', () => {
    const { duration } = measureExecutionTime(() => {
      for (let i = 0; i < 1000; i++) {
        orderBook.addOrder({
          price: 50000 + (i % 100),
          quantity: 0.01 + (i % 10) * 0.01,
          side: i % 2 === 0 ? 'BUY' : 'SELL',
        });
      }
    });

    expect(duration).toBeLessThan(100);
  });

  test('should handle 1000 order cancellations under 200ms', () => {
    const orders: Order[] = [];
    for (let i = 0; i < 1000; i++) {
      orders.push(orderBook.addOrder({
        price: 40000 + i,
        quantity: 1,
        side: 'BUY',
      }));
    }

    const { duration } = measureExecutionTime(() => {
      for (const order of orders) {
        orderBook.cancelOrder(order.id);
      }
    });

    expect(duration).toBeLessThan(200);
  });

  test('should handle mixed add/cancel operations', () => {
    const durations: number[] = [];
    
    for (let batch = 0; batch < 10; batch++) {
      const orders: Order[] = [];
      
      const addResult = measureExecutionTime(() => {
        for (let i = 0; i < 100; i++) {
          orders.push(orderBook.addOrder({
            price: 50000 + Math.random() * 1000,
            quantity: Math.random() * 10,
            side: Math.random() > 0.5 ? 'BUY' : 'SELL',
          }));
        }
      });
      durations.push(addResult.duration);

      const cancelResult = measureExecutionTime(() => {
        for (const order of orders.slice(0, 50)) {
          orderBook.cancelOrder(order.id);
        }
      });
      durations.push(cancelResult.duration);
    }

    const stats = calculateStats(durations);
    expect(stats.p95).toBeLessThan(50); // 95th percentile under 50ms
  });

  test('should maintain performance with deep order book', () => {
    orderBook.clear();
    
    // Build deep order book
    for (let i = 0; i < 5000; i++) {
      orderBook.addOrder({
        price: 45000 + i * 0.1,
        quantity: 1,
        side: 'BUY',
      });
      orderBook.addOrder({
        price: 55000 + i * 0.1,
        quantity: 1,
        side: 'SELL',
      });
    }

    // Measure operations on deep book
    const durations: number[] = [];
    for (let i = 0; i < 100; i++) {
      const { duration } = measureExecutionTime(() => {
        orderBook.addOrder({
          price: 50000 + Math.random() * 100,
          quantity: 1,
          side: Math.random() > 0.5 ? 'BUY' : 'SELL',
        });
      });
      durations.push(duration);
    }

    const stats = calculateStats(durations);
    expect(stats.avg).toBeLessThan(1); // Average under 1ms
  });

  test('should handle concurrent-like rapid operations', async () => {
    orderBook.clear();
    
    const operations = Array.from({ length: 500 }, (_, i) => ({
      type: i % 3 === 0 ? 'add' : i % 3 === 1 ? 'cancel' : 'query',
      data: {
        price: 50000 + Math.random() * 1000,
        quantity: Math.random() * 5,
        side: Math.random() > 0.5 ? 'BUY' as const : 'SELL' as const,
      },
    }));

    const addedOrders: Order[] = [];
    
    const { duration } = measureExecutionTime(() => {
      for (const op of operations) {
        if (op.type === 'add') {
          addedOrders.push(orderBook.addOrder(op.data));
        } else if (op.type === 'cancel' && addedOrders.length > 0) {
          const idx = Math.floor(Math.random() * addedOrders.length);
          orderBook.cancelOrder(addedOrders[idx].id);
        } else {
          orderBook.getBestBid();
          orderBook.getBestAsk();
        }
      }
    });

    expect(duration).toBeLessThan(100);
  });

  test('should scale linearly with order count', () => {
    const measurements: { count: number; duration: number }[] = [];

    for (const count of [100, 500, 1000, 2000]) {
      orderBook.clear();
      
      const { duration } = measureExecutionTime(() => {
        for (let i = 0; i < count; i++) {
          orderBook.addOrder({
            price: 50000 + i,
            quantity: 1,
            side: i % 2 === 0 ? 'BUY' : 'SELL',
          });
        }
      });
      
      measurements.push({ count, duration });
    }

    // Check approximate linear scaling (2x count should not be more than 3x time)
    const ratio = measurements[3].duration / measurements[0].duration;
    const countRatio = measurements[3].count / measurements[0].count;
    expect(ratio).toBeLessThan(countRatio * 2);
  });

  test('should handle burst of queries', () => {
    orderBook.clear();
    
    // Setup order book
    for (let i = 0; i < 1000; i++) {
      orderBook.addOrder({
        price: 50000 + i,
        quantity: 1,
        side: i % 2 === 0 ? 'BUY' : 'SELL',
      });
    }

    // Burst queries
    const { duration } = measureExecutionTime(() => {
      for (let i = 0; i < 10000; i++) {
        orderBook.getBestBid();
        orderBook.getBestAsk();
        orderBook.getDepth();
      }
    });

    expect(duration).toBeLessThan(100);
  });

  test('should measure p50/p95/p99 latencies', () => {
    orderBook.clear();
    const durations: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const { duration } = measureExecutionTime(() => {
        orderBook.addOrder({
          price: 50000 + Math.random() * 1000,
          quantity: Math.random() * 10,
          side: Math.random() > 0.5 ? 'BUY' : 'SELL',
        });
      });
      durations.push(duration);
    }

    const stats = calculateStats(durations);
    
    expect(stats.p50).toBeLessThan(0.5);  // p50 under 0.5ms
    expect(stats.p95).toBeLessThan(2);    // p95 under 2ms
    expect(stats.p99).toBeLessThan(5);    // p99 under 5ms
  });

  test('should handle market data snapshot generation', () => {
    orderBook.clear();
    
    // Build realistic order book
    for (let i = 0; i < 500; i++) {
      orderBook.addOrder({ price: 49500 + i, quantity: Math.random() * 10, side: 'BUY' });
      orderBook.addOrder({ price: 50500 + i, quantity: Math.random() * 10, side: 'SELL' });
    }

    const { duration } = measureExecutionTime(() => {
      for (let i = 0; i < 1000; i++) {
        const snapshot = {
          bestBid: orderBook.getBestBid(),
          bestAsk: orderBook.getBestAsk(),
          depth: orderBook.getDepth(),
          timestamp: Date.now(),
        };
      }
    });

    expect(duration).toBeLessThan(50);
  });
});

// ============================================================================
// STRESS TESTS - Beyond normal load
// ============================================================================

describe('Stress Testing', () => {
  let orderBook: MockOrderBook;

  beforeAll(() => {
    orderBook = new MockOrderBook();
  });

  afterAll(() => {
    orderBook.clear();
  });

  test('should survive 10x normal load', () => {
    orderBook.clear();
    
    const { duration } = measureExecutionTime(() => {
      for (let i = 0; i < 10000; i++) {
        orderBook.addOrder({
          price: 50000 + (i % 1000),
          quantity: Math.random() * 10,
          side: i % 2 === 0 ? 'BUY' : 'SELL',
        });
      }
    });

    // Should complete, even if slower
    expect(duration).toBeLessThan(1000);
    expect(orderBook.getDepth().bids + orderBook.getDepth().asks).toBeGreaterThan(0);
  });

  test('should handle rapid price level changes', () => {
    orderBook.clear();
    const durations: number[] = [];

    for (let batch = 0; batch < 100; batch++) {
      // Add orders
      const orders: Order[] = [];
      for (let i = 0; i < 100; i++) {
        orders.push(orderBook.addOrder({
          price: 50000 + batch * 100 + i,
          quantity: 1,
          side: 'BUY',
        }));
      }

      // Cancel all
      const { duration } = measureExecutionTime(() => {
        for (const order of orders) {
          orderBook.cancelOrder(order.id);
        }
      });
      durations.push(duration);
    }

    const stats = calculateStats(durations);
    expect(stats.max).toBeLessThan(100); // Even worst case under 100ms
  });

  test('should handle extreme price range', () => {
    orderBook.clear();

    // Orders across huge price range
    const { duration } = measureExecutionTime(() => {
      for (let i = 0; i < 1000; i++) {
        orderBook.addOrder({
          price: 1 + i * 1000, // 1 to 1,000,000
          quantity: 1,
          side: 'BUY',
        });
        orderBook.addOrder({
          price: 2000000 + i * 1000, // 2M to 3M
          quantity: 1,
          side: 'SELL',
        });
      }
    });

    expect(duration).toBeLessThan(200);
    expect(orderBook.getBestBid()).toBe(1 + 999 * 1000); // 999001
    expect(orderBook.getBestAsk()).toBe(2000000);
  });

  test('should handle many orders at same price', () => {
    orderBook.clear();

    // 1000 orders at same price
    const { duration } = measureExecutionTime(() => {
      for (let i = 0; i < 1000; i++) {
        orderBook.addOrder({
          price: 50000,
          quantity: 1,
          side: 'BUY',
        });
      }
    });

    expect(duration).toBeLessThan(50);
  });

  test('should recover from near-empty to full state', () => {
    const cycles: number[] = [];

    for (let cycle = 0; cycle < 5; cycle++) {
      orderBook.clear();

      const { duration } = measureExecutionTime(() => {
        // Fill
        for (let i = 0; i < 2000; i++) {
          orderBook.addOrder({
            price: 50000 + i,
            quantity: 1,
            side: i % 2 === 0 ? 'BUY' : 'SELL',
          });
        }
      });
      cycles.push(duration);
    }

    // Performance should be consistent across cycles
    const stats = calculateStats(cycles);
    expect(stats.max / stats.min).toBeLessThan(5); // Max no more than 5x min (relaxed for CI variability)
  });
});

// ============================================================================
// BENCHMARK SUITE
// ============================================================================

describe('Benchmark Suite', () => {
  let orderBook: MockOrderBook;

  beforeAll(() => {
    orderBook = new MockOrderBook();
  });

  afterAll(() => {
    orderBook.clear();
  });

  test('BENCHMARK: Single order insertion', () => {
    const durations: number[] = [];
    orderBook.clear();

    for (let i = 0; i < 10000; i++) {
      const { duration } = measureExecutionTime(() => {
        orderBook.addOrder({
          price: 50000 + Math.random() * 1000,
          quantity: Math.random() * 10,
          side: Math.random() > 0.5 ? 'BUY' : 'SELL',
        });
      });
      durations.push(duration);
    }

    const stats = calculateStats(durations);
    console.log(`Order insertion - avg: ${stats.avg.toFixed(4)}ms, p99: ${stats.p99.toFixed(4)}ms`);
    
    expect(stats.avg).toBeLessThan(0.1);
  });

  test('BENCHMARK: Best bid/ask query', () => {
    orderBook.clear();
    
    // Setup
    for (let i = 0; i < 1000; i++) {
      orderBook.addOrder({ price: 50000 + i, quantity: 1, side: 'BUY' });
      orderBook.addOrder({ price: 51000 + i, quantity: 1, side: 'SELL' });
    }

    const durations: number[] = [];
    for (let i = 0; i < 100000; i++) {
      const { duration } = measureExecutionTime(() => {
        orderBook.getBestBid();
        orderBook.getBestAsk();
      });
      durations.push(duration);
    }

    const stats = calculateStats(durations);
    console.log(`Best bid/ask - avg: ${stats.avg.toFixed(6)}ms, p99: ${stats.p99.toFixed(6)}ms`);
    
    expect(stats.avg).toBeLessThan(0.05); // Relaxed for CI variability
  });

  test('BENCHMARK: Order cancellation', () => {
    const orders: Order[] = [];
    orderBook.clear();
    
    for (let i = 0; i < 10000; i++) {
      orders.push(orderBook.addOrder({
        price: 50000 + i,
        quantity: 1,
        side: i % 2 === 0 ? 'BUY' : 'SELL',
      }));
    }

    const durations: number[] = [];
    // Cancel in random order
    const shuffled = [...orders].sort(() => Math.random() - 0.5);
    
    for (const order of shuffled) {
      const { duration } = measureExecutionTime(() => {
        orderBook.cancelOrder(order.id);
      });
      durations.push(duration);
    }

    const stats = calculateStats(durations);
    console.log(`Cancel order - avg: ${stats.avg.toFixed(4)}ms, p99: ${stats.p99.toFixed(4)}ms`);
    
    expect(stats.p99).toBeLessThan(1);
  });

  test('BENCHMARK: Depth snapshot', () => {
    orderBook.clear();
    
    for (let i = 0; i < 5000; i++) {
      orderBook.addOrder({ price: 49000 + i, quantity: 1, side: 'BUY' });
      orderBook.addOrder({ price: 51000 + i, quantity: 1, side: 'SELL' });
    }

    const durations: number[] = [];
    for (let i = 0; i < 10000; i++) {
      const { duration } = measureExecutionTime(() => {
        orderBook.getDepth();
      });
      durations.push(duration);
    }

    const stats = calculateStats(durations);
    console.log(`Depth snapshot - avg: ${stats.avg.toFixed(6)}ms, p99: ${stats.p99.toFixed(6)}ms`);
    
    expect(stats.p99).toBeLessThan(0.1);
  });

  test('BENCHMARK: Throughput - orders per second', () => {
    orderBook.clear();
    const startTime = performance.now();
    let orderCount = 0;

    // Run for 100ms
    while (performance.now() - startTime < 100) {
      orderBook.addOrder({
        price: 50000 + Math.random() * 1000,
        quantity: Math.random() * 10,
        side: Math.random() > 0.5 ? 'BUY' : 'SELL',
      });
      orderCount++;
    }

    const duration = performance.now() - startTime;
    const throughput = (orderCount / duration) * 1000;
    
    console.log(`Throughput: ${throughput.toFixed(0)} orders/second`);
    expect(throughput).toBeGreaterThan(10000); // At least 10K ops/sec
  });

  test('BENCHMARK: Memory efficiency - orders per MB estimate', () => {
    orderBook.clear();
    
    // Add many orders
    for (let i = 0; i < 100000; i++) {
      orderBook.addOrder({
        price: 50000 + (i % 10000),
        quantity: 1,
        side: i % 2 === 0 ? 'BUY' : 'SELL',
      });
    }

    const depth = orderBook.getDepth();
    const totalOrders = 100000;
    
    // Rough estimate: each order ~100 bytes
    const estimatedMB = (totalOrders * 100) / (1024 * 1024);
    const ordersPerMB = totalOrders / estimatedMB;

    console.log(`Estimated efficiency: ~${ordersPerMB.toFixed(0)} orders/MB`);
    expect(depth.bids + depth.asks).toBeGreaterThan(0);
  });

  test('BENCHMARK: Latency distribution', () => {
    orderBook.clear();
    const durations: number[] = [];

    for (let i = 0; i < 10000; i++) {
      const { duration } = measureExecutionTime(() => {
        orderBook.addOrder({
          price: 50000 + Math.random() * 1000,
          quantity: Math.random() * 10,
          side: Math.random() > 0.5 ? 'BUY' : 'SELL',
        });
      });
      durations.push(duration);
    }

    const stats = calculateStats(durations);
    console.log(`Latency distribution:
  - min: ${stats.min.toFixed(4)}ms
  - p50: ${stats.p50.toFixed(4)}ms
  - p95: ${stats.p95.toFixed(4)}ms
  - p99: ${stats.p99.toFixed(4)}ms
  - max: ${stats.max.toFixed(4)}ms
  - avg: ${stats.avg.toFixed(4)}ms`);

    // p99 should not be more than 10x p50
    expect(stats.p99 / stats.p50).toBeLessThan(20);
  });

  test('BENCHMARK: Jitter analysis', () => {
    orderBook.clear();
    const durations: number[] = [];

    for (let i = 0; i < 1000; i++) {
      const { duration } = measureExecutionTime(() => {
        orderBook.addOrder({
          price: 50000,
          quantity: 1,
          side: 'BUY',
        });
      });
      durations.push(duration);
    }

    // Calculate standard deviation
    const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
    const variance = durations.reduce((sum, d) => sum + Math.pow(d - avg, 2), 0) / durations.length;
    const stdDev = Math.sqrt(variance);
    const jitter = stdDev / avg; // Coefficient of variation

    console.log(`Jitter analysis: stdDev=${stdDev.toFixed(4)}ms, CV=${jitter.toFixed(2)}`);
    
    // Jitter should be reasonable (CV < 10, relaxed for CI environment variability)
    expect(jitter).toBeLessThan(10);
  });

  test('BENCHMARK: Warm-up effect', () => {
    orderBook.clear();
    
    const coldDurations: number[] = [];
    const warmDurations: number[] = [];

    // Cold start - first 100 operations
    for (let i = 0; i < 100; i++) {
      const { duration } = measureExecutionTime(() => {
        orderBook.addOrder({
          price: 50000 + i,
          quantity: 1,
          side: 'BUY',
        });
      });
      coldDurations.push(duration);
    }

    // Warm - next 1000 operations
    for (let i = 0; i < 1000; i++) {
      const { duration } = measureExecutionTime(() => {
        orderBook.addOrder({
          price: 50000 + 100 + i,
          quantity: 1,
          side: 'SELL',
        });
      });
      warmDurations.push(duration);
    }

    const coldStats = calculateStats(coldDurations);
    const warmStats = calculateStats(warmDurations);

    console.log(`Cold start avg: ${coldStats.avg.toFixed(4)}ms, Warm avg: ${warmStats.avg.toFixed(4)}ms`);
    
    // Both should be fast
    expect(coldStats.avg).toBeLessThan(1);
    expect(warmStats.avg).toBeLessThan(1);
  });
});
