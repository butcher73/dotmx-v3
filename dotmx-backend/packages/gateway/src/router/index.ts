/**
 * Shard Router
 *
 * Routes commands to the correct shard based on symbol.
 * Uses consistent hashing for distribution across engine instances.
 */

import type { Command } from "@dotmx/shared";

export interface ShardRouter {
  getShardId(symbol: string): number;
  getShardAddress(symbol: string): string;
  addShard(shardId: number, address: string): void;
  removeShard(shardId: number): void;
  rebalance(): Promise<void>;
  getSymbolsForShard(shardId: number): string[];
}

export interface ShardRouterConfig {
  numShards: number;
  virtualNodes: number; // For consistent hashing
}

export const defaultRouterConfig: ShardRouterConfig = {
  numShards: 4,
  virtualNodes: 100,
};

interface HashRingNode {
  hash: number;
  shardId: number;
}

/**
 * Consistent hashing implementation
 */
function hashString(str: string): number {
  // DJB2 hash
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) ^ str.charCodeAt(i);
  }
  return hash >>> 0; // Ensure unsigned
}

export function createShardRouter(
  config: ShardRouterConfig = defaultRouterConfig
): ShardRouter {
  const shards = new Map<number, string>(); // shardId -> address
  const ring: HashRingNode[] = [];
  const symbolToShard = new Map<string, number>();

  function rebuildRing() {
    ring.length = 0;
    
    for (const [shardId] of shards) {
      for (let v = 0; v < config.virtualNodes; v++) {
        const key = `shard-${shardId}-vnode-${v}`;
        ring.push({
          hash: hashString(key),
          shardId,
        });
      }
    }

    // Sort by hash for binary search
    ring.sort((a, b) => a.hash - b.hash);
  }

  function findShard(hash: number): number {
    if (ring.length === 0) return 0;

    // Binary search for first node with hash >= target
    let left = 0;
    let right = ring.length;

    while (left < right) {
      const mid = (left + right) >>> 1;
      if (ring[mid].hash < hash) {
        left = mid + 1;
      } else {
        right = mid;
      }
    }

    // Wrap around
    if (left >= ring.length) left = 0;
    
    return ring[left].shardId;
  }

  // Initialize default shards
  for (let i = 0; i < config.numShards; i++) {
    shards.set(i, `shard-${i}`);
  }
  rebuildRing();

  return {
    getShardId(symbol: string): number {
      // Check cache
      const cached = symbolToShard.get(symbol);
      if (cached !== undefined) return cached;

      const hash = hashString(symbol);
      const shardId = findShard(hash);
      symbolToShard.set(symbol, shardId);
      
      return shardId;
    },

    getShardAddress(symbol: string): string {
      const shardId = this.getShardId(symbol);
      return shards.get(shardId) ?? `shard-${shardId}`;
    },

    addShard(shardId: number, address: string): void {
      shards.set(shardId, address);
      rebuildRing();
      symbolToShard.clear(); // Invalidate cache
    },

    removeShard(shardId: number): void {
      shards.delete(shardId);
      rebuildRing();
      symbolToShard.clear();
    },

    async rebalance(): Promise<void> {
      // In a real system, this would coordinate shard migration
      rebuildRing();
      symbolToShard.clear();
    },

    getSymbolsForShard(shardId: number): string[] {
      const result: string[] = [];
      for (const [symbol, shard] of symbolToShard) {
        if (shard === shardId) {
          result.push(symbol);
        }
      }
      return result;
    },
  };
}

/**
 * Simple modulo-based router (deterministic, no consistent hashing)
 */
export function createSimpleRouter(numShards: number): ShardRouter {
  const symbolToShard = new Map<string, number>();

  return {
    getShardId(symbol: string): number {
      const cached = symbolToShard.get(symbol);
      if (cached !== undefined) return cached;

      const hash = hashString(symbol);
      const shardId = hash % numShards;
      symbolToShard.set(symbol, shardId);
      
      return shardId;
    },

    getShardAddress(symbol: string): string {
      return `shard-${this.getShardId(symbol)}`;
    },

    addShard() {
      throw new Error("Simple router does not support dynamic shards");
    },

    removeShard() {
      throw new Error("Simple router does not support dynamic shards");
    },

    async rebalance() {
      // No-op for simple router
    },

    getSymbolsForShard(shardId: number): string[] {
      return [...symbolToShard.entries()]
        .filter(([_, s]) => s === shardId)
        .map(([sym]) => sym);
    },
  };
}
