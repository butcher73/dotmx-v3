/**
 * Engine API Service
 * 
 * Routes through NGINX gateway at /engine (goes directly to port 3001)
 */

const ENGINE_API_URL = process.env.NEXT_PUBLIC_ENGINE_URL || 'http://localhost:8080/engine';

export interface ShardStatus {
  symbol: string;
  status: 'active' | 'inactive';
  sequenceId: number;
  orderCount: number;
  bidLevels: number;
  askLevels: number;
  midPrice: number | null;
}

export interface EngineHealth {
  service: string;
  shardId: number;
  status: string;
  uptime: number;
  symbols: ShardStatus[];
}

/**
 * Make API request
 */
async function apiRequest<T>(endpoint: string): Promise<T> {
  const url = `${ENGINE_API_URL}${endpoint}`;
  
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      let errorMessage = response.statusText;
      try {
        const error = await response.json();
        errorMessage = error.error || error.message || errorMessage;
      } catch {
        // Ignore JSON parse error, use statusText
      }
      throw new Error(`Engine API error: ${errorMessage}`);
    }
    
    return response.json();
  } catch (err) {
    if (err instanceof Error) {
      throw err;
    }
    throw new Error('Failed to fetch engine status');
  }
}

export const engineService = {
  /**
   * Get engine health and shard status
   */
  getHealth: () =>
    apiRequest<EngineHealth>('/health'),
  
  /**
   * Get all shards
   */
  getShards: () =>
    apiRequest<{ shardId: number; shards: any[] }>('/shards'),
};
