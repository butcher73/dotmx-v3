/**
 * Trade Settlement Service
 *
 * Post-trade processing: fee calculation, balance updates, VIP volume tracking.
 *
 * The matching engine outputs pure trade facts (no fees). This service is the
 * single source of truth for all post-trade business logic. It runs after the
 * engine matches orders but before the trade response is returned to users.
 *
 * Architecture: Engine → Trade Events → Settlement Service → DB (fees + balances)
 */

import type { DatabaseService } from './database';

export interface TradeToSettle {
  tradeId: string;
  symbol: string;
  price: number;
  quantity: number;
  makerUserId: string;
  takerUserId: string;
  makerOrderId: string;
  takerOrderId: string;
  makerSide: 'BUY' | 'SELL';
  timestamp: number;
}

export interface SettlementResult {
  tradeId: string;
  makerFee: number;
  takerFee: number;
  makerFeeRate: number;
  takerFeeRate: number;
  settled: boolean;
  error?: string;
}

export class TradeSettlementService {
  private db: DatabaseService;

  constructor(db: DatabaseService) {
    this.db = db;
  }

  /**
   * Settle a single trade: calculate fees, update balances, record fee collection.
   * This is the primary entry point called by the gateway when the engine
   * produces a Trade event. Must run before the trade response is sent to users.
   */
  async settleTrade(trade: TradeToSettle): Promise<SettlementResult> {
    const tradeValueUsd = trade.price * trade.quantity;

    try {
      // Default fee rates (0.1% maker, 0.1% taker) - will be overridden
      // by VIP tier logic when FeeCalculationService is integrated
      const makerFeeRate = 0.001;
      const takerFeeRate = 0.001;
      const makerFee = tradeValueUsd * makerFeeRate;
      const takerFee = tradeValueUsd * takerFeeRate;

      // Record fee collections for both sides
      await this.recordFeeCollection(trade, makerFee, takerFee, makerFeeRate, takerFeeRate);

      // Update user balances (deduct fees)
      await this.updateBalancesForFees(trade, makerFee, takerFee);

      return {
        tradeId: trade.tradeId,
        makerFee,
        takerFee,
        makerFeeRate,
        takerFeeRate,
        settled: true,
      };
    } catch (error) {
      console.error('[TradeSettlement] Failed to settle trade:', trade.tradeId, error);
      return {
        tradeId: trade.tradeId,
        makerFee: 0,
        takerFee: 0,
        makerFeeRate: 0,
        takerFeeRate: 0,
        settled: false,
        error: (error as Error).message,
      };
    }
  }

  /**
   * Settle multiple trades from a match result (batch)
   */
  async settleBatch(trades: TradeToSettle[]): Promise<SettlementResult[]> {
    const results: SettlementResult[] = [];
    for (const trade of trades) {
      const result = await this.settleTrade(trade);
      results.push(result);
    }
    return results;
  }

  /**
   * Extract quote asset from a trading symbol (e.g. "BTC-USDT" → "USDT")
   */
  private extractQuoteAsset(symbol: string): string {
    const parts = symbol.split('-');
    return parts.length >= 2 ? parts[1] : 'USDT';
  }

  /**
   * Record fee collection entries for both maker and taker
   */
  private async recordFeeCollection(
    trade: TradeToSettle,
    makerFee: number,
    takerFee: number,
    makerFeeRate: number,
    takerFeeRate: number,
  ): Promise<void> {
    const tradeValueUsd = trade.price * trade.quantity;
    const now = new Date().toISOString();

    // Record maker fee
    await this.db.query(
      `INSERT INTO trading_fees_collected (
        trade_id, order_id, user_id, symbol,
        fee_tier_level, trade_side, trade_price, trade_quantity,
        trade_value_usd, base_fee_rate, vip_fee_discount, dmx_fee_discount,
        effective_fee_rate, fee_amount_usd, fee_currency,
        fee_paid_in_dmx, vip_discount_usd, dmx_discount_usd,
        total_discount_usd, collected_at, settlement_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        trade.tradeId,
        trade.makerOrderId,
        trade.makerUserId,
        trade.symbol,
        0, // Default fee tier
        'maker',
        trade.price,
        trade.quantity,
        tradeValueUsd,
        makerFeeRate,
        0, // vip_fee_discount
        0, // dmx_fee_discount
        makerFeeRate,
        makerFee,
        this.extractQuoteAsset(trade.symbol),
        false, // fee_paid_in_dmx
        0, // vip_discount_usd
        0, // dmx_discount_usd
        0, // total_discount_usd
        now,
        'settled',
      ]
    );

    // Record taker fee
    await this.db.query(
      `INSERT INTO trading_fees_collected (
        trade_id, order_id, user_id, symbol,
        fee_tier_level, trade_side, trade_price, trade_quantity,
        trade_value_usd, base_fee_rate, vip_fee_discount, dmx_fee_discount,
        effective_fee_rate, fee_amount_usd, fee_currency,
        fee_paid_in_dmx, vip_discount_usd, dmx_discount_usd,
        total_discount_usd, collected_at, settlement_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)`,
      [
        trade.tradeId,
        trade.takerOrderId,
        trade.takerUserId,
        trade.symbol,
        0, // Default fee tier
        'taker',
        trade.price,
        trade.quantity,
        tradeValueUsd,
        takerFeeRate,
        0, // vip_fee_discount
        0, // dmx_fee_discount
        takerFeeRate,
        takerFee,
        this.extractQuoteAsset(trade.symbol),
        false, // fee_paid_in_dmx
        0, // vip_discount_usd
        0, // dmx_discount_usd
        0, // total_discount_usd
        now,
        'settled',
      ]
    );
  }

  /**
   * Update user balances to deduct fees
   */
  private async updateBalancesForFees(
    trade: TradeToSettle,
    makerFee: number,
    takerFee: number
  ): Promise<void> {
    // Deduct maker fee from locked balance (fees come from margin/collateral)
    if (makerFee > 0) {
      await this.db.query(
        `UPDATE user_balances
         SET locked = GREATEST(locked - $1, 0),
             updated_at = NOW()
         WHERE user_id = $2 AND asset = $3`,
        [makerFee, trade.makerUserId, this.extractQuoteAsset(trade.symbol)]
      );
    }

    // Deduct taker fee from locked balance
    if (takerFee > 0) {
      await this.db.query(
        `UPDATE user_balances
         SET locked = GREATEST(locked - $1, 0),
             updated_at = NOW()
         WHERE user_id = $2 AND asset = $3`,
        [takerFee, trade.takerUserId, this.extractQuoteAsset(trade.symbol)]
      );
    }
  }
}

/**
 * Factory function to create a TradeSettlementService instance
 */
export function createTradeSettlementService(db: DatabaseService): TradeSettlementService {
  return new TradeSettlementService(db);
}
