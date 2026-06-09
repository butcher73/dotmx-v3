/**
 * Balance Management
 *
 * Manages user balances across multiple assets.
 * Supports deposits, withdrawals, and internal transfers.
 */

export type BalanceType = "AVAILABLE" | "LOCKED" | "MARGIN";

export interface Balance {
  userId: string;
  asset: string;
  available: number;
  locked: number;
  margin: number;
  lastUpdated: number;
}

export interface BalanceChange {
  userId: string;
  asset: string;
  type: BalanceType;
  delta: number;
  reason: string;
  timestamp: number;
  txId?: string;
}

export interface BalanceStore {
  get(userId: string, asset: string): Promise<Balance | null>;
  getAll(userId: string): Promise<Balance[]>;
  update(change: BalanceChange): Promise<Balance>;
  lock(userId: string, asset: string, amount: number, reason: string): Promise<boolean>;
  unlock(userId: string, asset: string, amount: number, reason: string): Promise<boolean>;
  transfer(fromUser: string, toUser: string, asset: string, amount: number): Promise<boolean>;
}

/**
 * Create in-memory balance store
 */
export function createMemoryBalanceStore(): BalanceStore {
  const balances = new Map<string, Balance>();

  function getKey(userId: string, asset: string): string {
    return `${userId}:${asset}`;
  }

  function getOrCreate(userId: string, asset: string): Balance {
    const key = getKey(userId, asset);
    let balance = balances.get(key);
    if (!balance) {
      balance = {
        userId,
        asset,
        available: 0,
        locked: 0,
        margin: 0,
        lastUpdated: Date.now(),
      };
      balances.set(key, balance);
    }
    return balance;
  }

  return {
    async get(userId: string, asset: string): Promise<Balance | null> {
      return balances.get(getKey(userId, asset)) ?? null;
    },

    async getAll(userId: string): Promise<Balance[]> {
      const result: Balance[] = [];
      for (const [key, balance] of balances) {
        if (key.startsWith(`${userId}:`)) {
          result.push(balance);
        }
      }
      return result;
    },

    async update(change: BalanceChange): Promise<Balance> {
      const balance = getOrCreate(change.userId, change.asset);

      switch (change.type) {
        case "AVAILABLE":
          balance.available += change.delta;
          break;
        case "LOCKED":
          balance.locked += change.delta;
          break;
        case "MARGIN":
          balance.margin += change.delta;
          break;
      }

      balance.lastUpdated = change.timestamp;
      return balance;
    },

    async lock(userId: string, asset: string, amount: number, reason: string): Promise<boolean> {
      const balance = getOrCreate(userId, asset);

      if (balance.available < amount) {
        return false;
      }

      balance.available -= amount;
      balance.locked += amount;
      balance.lastUpdated = Date.now();
      return true;
    },

    async unlock(userId: string, asset: string, amount: number, reason: string): Promise<boolean> {
      const balance = getOrCreate(userId, asset);

      if (balance.locked < amount) {
        return false;
      }

      balance.locked -= amount;
      balance.available += amount;
      balance.lastUpdated = Date.now();
      return true;
    },

    async transfer(fromUser: string, toUser: string, asset: string, amount: number): Promise<boolean> {
      const fromBalance = getOrCreate(fromUser, asset);

      if (fromBalance.available < amount) {
        return false;
      }

      const toBalance = getOrCreate(toUser, asset);

      fromBalance.available -= amount;
      toBalance.available += amount;

      const now = Date.now();
      fromBalance.lastUpdated = now;
      toBalance.lastUpdated = now;

      return true;
    },
  };
}

/**
 * Check if user has sufficient balance
 */
export function hasSufficientBalance(
  balance: Balance | null,
  required: number,
  type: BalanceType = "AVAILABLE"
): boolean {
  if (!balance) return false;

  switch (type) {
    case "AVAILABLE":
      return balance.available >= required;
    case "LOCKED":
      return balance.locked >= required;
    case "MARGIN":
      return balance.margin >= required;
  }
}

/**
 * Calculate total balance
 */
export function getTotalBalance(balance: Balance): number {
  return balance.available + balance.locked + balance.margin;
}

// =============================================================================
// SIMPLE BALANCE STORE (for testing and simple use cases)
// =============================================================================

export interface SimpleBalance {
  available: number;
  locked: number;
  total: number;
}

export interface SimpleBalanceStore {
  getBalance(userId: string, asset: string): SimpleBalance;
  credit(userId: string, asset: string, amount: number): void;
  debit(userId: string, asset: string, amount: number): boolean;
  lock(userId: string, asset: string, amount: number): boolean;
  unlock(userId: string, asset: string, amount: number): void;
  transfer(fromUser: string, toUser: string, asset: string, amount: number): boolean;
  getAllBalances(userId: string): Map<string, SimpleBalance>;
}

export function createBalanceStore(): SimpleBalanceStore {
  const balances = new Map<string, { available: number; locked: number }>();

  function getKey(userId: string, asset: string): string {
    return `${userId}:${asset}`;
  }

  function getOrCreate(userId: string, asset: string): { available: number; locked: number } {
    const key = getKey(userId, asset);
    let bal = balances.get(key);
    if (!bal) {
      bal = { available: 0, locked: 0 };
      balances.set(key, bal);
    }
    return bal;
  }

  return {
    getBalance(userId: string, asset: string): SimpleBalance {
      const bal = getOrCreate(userId, asset);
      return { available: bal.available, locked: bal.locked, total: bal.available + bal.locked };
    },

    credit(userId: string, asset: string, amount: number): void {
      const bal = getOrCreate(userId, asset);
      bal.available += amount;
    },

    debit(userId: string, asset: string, amount: number): boolean {
      const bal = getOrCreate(userId, asset);
      if (bal.available < amount) return false;
      bal.available -= amount;
      return true;
    },

    lock(userId: string, asset: string, amount: number): boolean {
      const bal = getOrCreate(userId, asset);
      if (bal.available < amount) return false;
      bal.available -= amount;
      bal.locked += amount;
      return true;
    },

    unlock(userId: string, asset: string, amount: number): void {
      const bal = getOrCreate(userId, asset);
      const toUnlock = Math.min(amount, bal.locked);
      bal.locked -= toUnlock;
      bal.available += toUnlock;
    },

    transfer(fromUser: string, toUser: string, asset: string, amount: number): boolean {
      const from = getOrCreate(fromUser, asset);
      if (from.available < amount) return false;
      from.available -= amount;
      const to = getOrCreate(toUser, asset);
      to.available += amount;
      return true;
    },

    getAllBalances(userId: string): Map<string, SimpleBalance> {
      const result = new Map<string, SimpleBalance>();
      for (const [key, bal] of balances) {
        if (key.startsWith(`${userId}:`)) {
          const asset = key.split(":")[1];
          result.set(asset, { available: bal.available, locked: bal.locked, total: bal.available + bal.locked });
        }
      }
      return result;
    },
  };
}
