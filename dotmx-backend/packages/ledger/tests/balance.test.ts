/**
 * Balance Integrity Tests
 * Phase 3: Data Integrity - Comprehensive balance operations testing
 */

import { describe, it, expect, beforeEach } from 'bun:test';
import { createBalanceStore } from '../src';

describe('Balance Integrity Tests', () => {
  let store: ReturnType<typeof createBalanceStore>;

  beforeEach(() => {
    store = createBalanceStore();
  });

  // ============================================================================
  // CONCURRENT OPERATIONS
  // ============================================================================

  describe('Concurrent Operations', () => {
    it('should handle multiple credits atomically', () => {
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(Promise.resolve(store.credit('user1', 'USDT', 100)));
      }
      
      Promise.all(promises);
      const balance = store.getBalance('user1', 'USDT');
      expect(balance.available).toBe(1000);
    });

    it('should handle credit and debit sequence', () => {
      store.credit('user1', 'USDT', 1000);
      store.debit('user1', 'USDT', 100);
      store.credit('user1', 'USDT', 50);
      store.debit('user1', 'USDT', 200);
      
      const balance = store.getBalance('user1', 'USDT');
      expect(balance.available).toBe(750);
    });

    it('should maintain consistency during lock/unlock cycles', () => {
      store.credit('user1', 'USDT', 1000);
      
      for (let i = 0; i < 5; i++) {
        store.lock('user1', 'USDT', 100);
        store.unlock('user1', 'USDT', 50);
      }
      
      const balance = store.getBalance('user1', 'USDT');
      expect(balance.locked).toBe(250); // 5 * (100-50)
      expect(balance.available).toBe(750);
      expect(balance.total).toBe(1000);
    });
  });

  // ============================================================================
  // EDGE CASES
  // ============================================================================

  describe('Edge Cases', () => {
    it('should handle zero credit', () => {
      store.credit('user1', 'USDT', 0);
      const balance = store.getBalance('user1', 'USDT');
      expect(balance.available).toBe(0);
    });

    it('should handle very small amounts (dust)', () => {
      store.credit('user1', 'USDT', 0.00000001);
      const balance = store.getBalance('user1', 'USDT');
      expect(balance.available).toBe(0.00000001);
    });

    it('should handle very large amounts', () => {
      store.credit('user1', 'USDT', 1e15); // 1 quadrillion
      const balance = store.getBalance('user1', 'USDT');
      expect(balance.available).toBe(1e15);
    });

    it('should handle exact debit of available balance', () => {
      store.credit('user1', 'USDT', 1000);
      const result = store.debit('user1', 'USDT', 1000);
      expect(result).toBe(true);
      expect(store.getBalance('user1', 'USDT').available).toBe(0);
    });

    it('should handle multiple assets per user', () => {
      const assets = ['USDT', 'BTC', 'ETH', 'SOL', 'AVAX'];
      
      for (const asset of assets) {
        store.credit('user1', asset, 100);
      }
      
      const allBalances = store.getAllBalances('user1');
      expect(allBalances.size).toBe(5);
    });
  });

  // ============================================================================
  // TRANSFER OPERATIONS
  // ============================================================================

  describe('Transfer Operations', () => {
    it('should transfer full balance', () => {
      store.credit('user1', 'USDT', 1000);
      const result = store.transfer('user1', 'user2', 'USDT', 1000);
      
      expect(result).toBe(true);
      expect(store.getBalance('user1', 'USDT').available).toBe(0);
      expect(store.getBalance('user2', 'USDT').available).toBe(1000);
    });

    it('should fail transfer with insufficient funds', () => {
      store.credit('user1', 'USDT', 100);
      const result = store.transfer('user1', 'user2', 'USDT', 200);
      
      expect(result).toBe(false);
      expect(store.getBalance('user1', 'USDT').available).toBe(100);
      expect(store.getBalance('user2', 'USDT').available).toBe(0);
    });

    it('should handle chain of transfers', () => {
      store.credit('user1', 'USDT', 1000);
      store.transfer('user1', 'user2', 'USDT', 500);
      store.transfer('user2', 'user3', 'USDT', 250);
      store.transfer('user3', 'user4', 'USDT', 125);
      
      expect(store.getBalance('user1', 'USDT').available).toBe(500);
      expect(store.getBalance('user2', 'USDT').available).toBe(250);
      expect(store.getBalance('user3', 'USDT').available).toBe(125);
      expect(store.getBalance('user4', 'USDT').available).toBe(125);
    });

    it('should not transfer locked funds', () => {
      store.credit('user1', 'USDT', 1000);
      store.lock('user1', 'USDT', 600);
      
      // Only 400 available, trying to transfer 500
      const result = store.transfer('user1', 'user2', 'USDT', 500);
      expect(result).toBe(false);
    });
  });

  // ============================================================================
  // LOCK/UNLOCK OPERATIONS
  // ============================================================================

  describe('Lock/Unlock Operations', () => {
    it('should lock entire available balance', () => {
      store.credit('user1', 'USDT', 1000);
      const result = store.lock('user1', 'USDT', 1000);
      
      expect(result).toBe(true);
      const balance = store.getBalance('user1', 'USDT');
      expect(balance.available).toBe(0);
      expect(balance.locked).toBe(1000);
    });

    it('should unlock partial amount', () => {
      store.credit('user1', 'USDT', 1000);
      store.lock('user1', 'USDT', 1000);
      store.unlock('user1', 'USDT', 300);
      
      const balance = store.getBalance('user1', 'USDT');
      expect(balance.available).toBe(300);
      expect(balance.locked).toBe(700);
    });

    it('should handle unlock more than locked (clamp)', () => {
      store.credit('user1', 'USDT', 1000);
      store.lock('user1', 'USDT', 500);
      store.unlock('user1', 'USDT', 1000); // Trying to unlock more
      
      const balance = store.getBalance('user1', 'USDT');
      // Should only unlock what was locked
      expect(balance.locked).toBe(0);
      expect(balance.available).toBe(1000);
    });
  });

  // ============================================================================
  // INVARIANT CHECKS
  // ============================================================================

  describe('Invariant Checks', () => {
    it('should maintain total = available + locked invariant', () => {
      store.credit('user1', 'USDT', 1000);
      store.lock('user1', 'USDT', 300);
      store.debit('user1', 'USDT', 200);
      store.unlock('user1', 'USDT', 100);
      
      const balance = store.getBalance('user1', 'USDT');
      expect(balance.total).toBe(balance.available + balance.locked);
    });

    it('should never have negative available', () => {
      store.credit('user1', 'USDT', 100);
      store.debit('user1', 'USDT', 150); // Should fail
      
      const balance = store.getBalance('user1', 'USDT');
      expect(balance.available).toBeGreaterThanOrEqual(0);
    });

    it('should never have negative locked', () => {
      store.credit('user1', 'USDT', 100);
      store.unlock('user1', 'USDT', 50); // Nothing locked
      
      const balance = store.getBalance('user1', 'USDT');
      expect(balance.locked).toBeGreaterThanOrEqual(0);
    });

    it('should preserve total after failed operations', () => {
      store.credit('user1', 'USDT', 1000);
      const initialTotal = store.getBalance('user1', 'USDT').total;
      
      // Attempt invalid operations
      store.debit('user1', 'USDT', 2000); // Fail
      store.lock('user1', 'USDT', 2000);  // Fail
      
      expect(store.getBalance('user1', 'USDT').total).toBe(initialTotal);
    });
  });
});

// ============================================================================
// MULTI-ASSET OPERATIONS
// ============================================================================

describe('Multi-Asset Operations', () => {
  let store: ReturnType<typeof createBalanceStore>;

  beforeEach(() => {
    store = createBalanceStore();
  });

  it('should isolate balances between assets', () => {
    store.credit('user1', 'USDT', 1000);
    store.credit('user1', 'BTC', 0.5);
    
    store.debit('user1', 'USDT', 500);
    
    expect(store.getBalance('user1', 'USDT').available).toBe(500);
    expect(store.getBalance('user1', 'BTC').available).toBe(0.5);
  });

  it('should isolate balances between users', () => {
    store.credit('user1', 'USDT', 1000);
    store.credit('user2', 'USDT', 500);
    
    store.debit('user1', 'USDT', 300);
    
    expect(store.getBalance('user1', 'USDT').available).toBe(700);
    expect(store.getBalance('user2', 'USDT').available).toBe(500);
  });

  it('should handle cross-asset transfers (via debit/credit)', () => {
    store.credit('user1', 'USDT', 1000);
    
    // Simulate swap: debit USDT, credit BTC
    store.debit('user1', 'USDT', 500);
    store.credit('user1', 'BTC', 0.01); // 500 USDT -> 0.01 BTC
    
    expect(store.getBalance('user1', 'USDT').available).toBe(500);
    expect(store.getBalance('user1', 'BTC').available).toBe(0.01);
  });
});
