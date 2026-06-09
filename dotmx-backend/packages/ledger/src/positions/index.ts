/**
 * Position Management
 *
 * Tracks perpetual/futures positions for each user.
 * Supports both in-memory and DB-backed stores.
 */

export type PositionSide = "LONG" | "SHORT" | "NONE";

/**
 * Database interface (subset of DatabaseService needed for positions)
 */
export interface PositionDb {
  execute(query: string, params?: any[]): Promise<void>;
  query<T = any>(query: string, params?: any[]): Promise<T[]>;
  queryOne<T = any>(query: string, params?: any[]): Promise<T | null>;
}

export interface Position {
  userId: string;
  symbol: string;
  side: PositionSide;
  size: number; // Signed: positive = long, negative = short
  entryPrice: number;
  leverage: number;
  liquidationPrice: number;
  margin: number;
  unrealizedPnl: number;
  realizedPnl: number;
  openedAt: number;
  lastUpdated: number;
}

export interface SimplePosition {
  size: number; // Signed
  entryPrice: number;
  margin: number;
  leverage: number;
}

export interface PositionUpdate {
  userId: string;
  symbol: string;
  side: PositionSide;
  sizeDelta: number;
  price: number;
  fee: number;
  timestamp: number;
}

/**
 * Simple position store interface (for ledger services)
 */
export interface PositionStore {
  getPosition(userId: string, symbol: string): SimplePosition | null;
  openPosition(userId: string, symbol: string, size: number, entryPrice: number, margin: number, leverage: number): void;
  updatePosition(userId: string, symbol: string, updates: Partial<SimplePosition>): void;
  closePosition(userId: string, symbol: string): SimplePosition | null;
  calculatePnL(userId: string, symbol: string, markPrice: number): number;
  getUserPositions(userId: string): SimplePosition[];
  getAllPositions(symbol: string): Array<{ userId: string; position: SimplePosition }>;
  getLiquidationPrice(userId: string, symbol: string, mmr: number): number;
}

/**
 * Create simple position store
 */
export function createPositionStore(): PositionStore {
  const positions = new Map<string, SimplePosition>();

  function getKey(userId: string, symbol: string): string {
    return `${userId}:${symbol}`;
  }

  return {
    getPosition(userId: string, symbol: string): SimplePosition | null {
      return positions.get(getKey(userId, symbol)) ?? null;
    },

    openPosition(userId: string, symbol: string, size: number, entryPrice: number, margin: number, leverage: number): void {
      positions.set(getKey(userId, symbol), { size, entryPrice, margin, leverage });
    },

    updatePosition(userId: string, symbol: string, updates: Partial<SimplePosition>): void {
      const key = getKey(userId, symbol);
      const existing = positions.get(key);
      if (existing) {
        positions.set(key, { ...existing, ...updates });
      }
    },

    closePosition(userId: string, symbol: string): SimplePosition | null {
      const key = getKey(userId, symbol);
      const position = positions.get(key);
      if (position) {
        positions.delete(key);
        return position;
      }
      return null;
    },

    calculatePnL(userId: string, symbol: string, markPrice: number): number {
      const position = positions.get(getKey(userId, symbol));
      if (!position) return 0;
      // PnL = size * (markPrice - entryPrice)
      return position.size * (markPrice - position.entryPrice);
    },

    getUserPositions(userId: string): SimplePosition[] {
      const result: SimplePosition[] = [];
      for (const [key, position] of positions) {
        if (key.startsWith(`${userId}:`)) {
          result.push(position);
        }
      }
      return result;
    },

    getAllPositions(symbol: string): Array<{ userId: string; position: SimplePosition }> {
      const result: Array<{ userId: string; position: SimplePosition }> = [];
      for (const [key, position] of positions) {
        if (key.endsWith(`:${symbol}`)) {
          const userId = key.split(":")[0];
          result.push({ userId, position });
        }
      }
      return result;
    },

    getLiquidationPrice(userId: string, symbol: string, mmr: number): number {
      const position = positions.get(getKey(userId, symbol));
      if (!position) return 0;

      // Long: entry - (margin * (1 - mmr)) / |size|
      // Short: entry + (margin * (1 - mmr)) / |size|
      const marginValue = position.margin * (1 - mmr);

      if (position.size > 0) {
        // Long position
        return position.entryPrice - marginValue / Math.abs(position.size);
      } else {
        // Short position
        return position.entryPrice + marginValue / Math.abs(position.size);
      }
    },
  };
}

/**
 * Create DB-backed position store.
 * Uses write-through caching: in-memory Map for hot-path reads,
 * PostgreSQL for persistence. On startup, loads all open positions from DB.
 */
export function createDbPositionStore(db: PositionDb): PositionStore & { loadFromDb(): Promise<void> } {
  const positions = new Map<string, SimplePosition>();

  function getKey(userId: string, symbol: string): string {
    return `${userId}:${symbol}`;
  }

  const store: PositionStore & { loadFromDb(): Promise<void> } = {
    /**
     * Load all open positions from DB into memory cache
     */
    async loadFromDb(): Promise<void> {
      const rows = await db.query<{
        user_id: string;
        symbol: string;
        size: string;
        entry_price: string;
        margin: string;
        leverage: number;
      }>(
        `SELECT user_id, symbol, size, entry_price, margin, leverage
         FROM positions WHERE status = 'open' OR status IS NULL`
      );

      for (const row of rows) {
        const size = parseFloat(row.size);
        if (size === 0) continue;
        positions.set(getKey(row.user_id, row.symbol), {
          size,
          entryPrice: parseFloat(row.entry_price),
          margin: parseFloat(row.margin),
          leverage: row.leverage || 1,
        });
      }

      console.log(`[PositionStore] Loaded ${positions.size} open positions from DB`);
    },

    getPosition(userId: string, symbol: string): SimplePosition | null {
      return positions.get(getKey(userId, symbol)) ?? null;
    },

    openPosition(userId: string, symbol: string, size: number, entryPrice: number, margin: number, leverage: number): void {
      const pos: SimplePosition = { size, entryPrice, margin, leverage };
      positions.set(getKey(userId, symbol), pos);

      const side = size > 0 ? "LONG" : "SHORT";
      const id = `${userId}-${symbol}-${Date.now()}`;

      // Async write-through to DB (fire-and-forget with error logging)
      db.execute(
        `INSERT INTO positions (user_id, symbol, size, entry_price, margin, leverage, id, side, status, opened_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', NOW(), NOW())
         ON CONFLICT (user_id, symbol) DO UPDATE SET
           size = $3, entry_price = $4, margin = $5, leverage = $6,
           side = $8, status = 'open', updated_at = NOW()`,
        [userId, symbol, size, entryPrice, margin, leverage, id, side]
      ).catch(err => console.error(`[PositionStore] DB write failed (open):`, err));
    },

    updatePosition(userId: string, symbol: string, updates: Partial<SimplePosition>): void {
      const key = getKey(userId, symbol);
      const existing = positions.get(key);
      if (!existing) return;

      const updated = { ...existing, ...updates };
      positions.set(key, updated);

      const side = updated.size > 0 ? "LONG" : "SHORT";

      db.execute(
        `UPDATE positions SET size = $3, entry_price = $4, margin = $5, leverage = $6,
         side = $7, updated_at = NOW()
         WHERE user_id = $1 AND symbol = $2`,
        [userId, symbol, updated.size, updated.entryPrice, updated.margin, updated.leverage, side]
      ).catch(err => console.error(`[PositionStore] DB write failed (update):`, err));
    },

    closePosition(userId: string, symbol: string): SimplePosition | null {
      const key = getKey(userId, symbol);
      const position = positions.get(key);
      if (!position) return null;

      positions.delete(key);

      // Mark as closed in DB and create history record
      db.execute(
        `UPDATE positions SET status = 'closed', closed_at = NOW(), updated_at = NOW()
         WHERE user_id = $1 AND symbol = $2 AND status = 'open'`,
        [userId, symbol]
      ).catch(err => console.error(`[PositionStore] DB write failed (close):`, err));

      // Insert into position_history
      const side = position.size > 0 ? "LONG" : "SHORT";
      db.execute(
        `INSERT INTO position_history (user_id, symbol, side, size, entry_price, exit_price, leverage, margin_used, close_reason, opened_at, closed_at)
         VALUES ($1, $2, $3, $4, $5, $5, $6, $7, 'manual', NOW(), NOW())`,
        [userId, symbol, side, Math.abs(position.size), position.entryPrice, position.leverage, position.margin]
      ).catch(err => console.error(`[PositionStore] DB write failed (history):`, err));

      return position;
    },

    calculatePnL(userId: string, symbol: string, markPrice: number): number {
      const position = positions.get(getKey(userId, symbol));
      if (!position) return 0;
      return position.size * (markPrice - position.entryPrice);
    },

    getUserPositions(userId: string): SimplePosition[] {
      const result: SimplePosition[] = [];
      for (const [key, position] of positions) {
        if (key.startsWith(`${userId}:`)) {
          result.push(position);
        }
      }
      return result;
    },

    getAllPositions(symbol: string): Array<{ userId: string; position: SimplePosition }> {
      const result: Array<{ userId: string; position: SimplePosition }> = [];
      for (const [key, position] of positions) {
        if (key.endsWith(`:${symbol}`)) {
          const userId = key.split(":")[0];
          result.push({ userId, position });
        }
      }
      return result;
    },

    getLiquidationPrice(userId: string, symbol: string, mmr: number): number {
      const position = positions.get(getKey(userId, symbol));
      if (!position) return 0;
      const marginValue = position.margin * (1 - mmr);
      if (position.size > 0) {
        return position.entryPrice - marginValue / Math.abs(position.size);
      } else {
        return position.entryPrice + marginValue / Math.abs(position.size);
      }
    },
  };

  return store;
}

/**
 * Calculate liquidation price for a position
 */
export function calculateLiquidationPrice(
  side: PositionSide,
  entryPrice: number,
  leverage: number,
  maintenanceMarginRate: number = 0.005
): number {
  if (side === "NONE") return 0;

  const marginRate = 1 / leverage;

  if (side === "LONG") {
    // Long liquidated when price drops
    return entryPrice * (1 - marginRate + maintenanceMarginRate);
  } else {
    // Short liquidated when price rises
    return entryPrice * (1 + marginRate - maintenanceMarginRate);
  }
}

/**
 * Calculate unrealized PnL
 */
export function calculateUnrealizedPnl(
  side: PositionSide,
  size: number,
  entryPrice: number,
  markPrice: number
): number {
  if (side === "NONE" || size === 0) return 0;

  const priceDiff = markPrice - entryPrice;

  if (side === "LONG") {
    return size * priceDiff;
  } else {
    return size * -priceDiff;
  }
}

/**
 * Calculate margin required for position
 */
export function calculateMarginRequired(
  size: number,
  entryPrice: number,
  leverage: number
): number {
  return (size * entryPrice) / leverage;
}

/**
 * Check if position should be liquidated
 */
export function shouldLiquidate(position: SimplePosition, entryPrice: number, liquidationPrice: number, markPrice: number): boolean {
  if (position.size === 0) return false;

  if (position.size > 0) {
    // Long
    return markPrice <= liquidationPrice;
  } else {
    // Short
    return markPrice >= liquidationPrice;
  }
}
