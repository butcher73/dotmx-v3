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
 *
 * Fee calculation is delegated to the optional FeeCalculationService which
 * supports VIP tiers (levels 0-9) and DMX token-based fee discounts.
 * When FeeCalculationService is not provided, falls back to hardcoded
 * 0.1% maker / 0.1% taker fees (backward compatible).
 */

import type { DatabaseService } from './database';
import type { FeeCalculationResult, UserFeeTier, TierCheckResult } from '../types/fees';

// Lazy reference to avoid hard dependency on the PostgresDB type that
// FeeCalculationService uses internally. The service is constructed externally
// and passed in already wired to a DB.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type FeeCalcService = any;

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
  /** VIP tier used for maker fee calculation */
  makerFeeTier?: number;
  /** VIP tier used for taker fee calculation */
  takerFeeTier?: number;
  settled: boolean;
  error?: string;
}

export class TradeSettlementService {
  private db: DatabaseService;
  private feeCalcService: FeeCalcService | null;

  /**
   * @param db DatabaseService for balance updates and legacy SQL operations
   * @param feeCalcService Optional FeeCalculationService for VIP-tier and DMX-discount-aware fees.
   *   When null, falls back to hardcoded 0.1% maker / 0.1% taker fees.
   */
  constructor(db: DatabaseService, feeCalcService?: FeeCalcService) {
    this.db = db;
    this.feeCalcService = feeCalcService ?? null;
  }

  /**
   * Settle a single trade: calculate fees, update balances, record fee collection.
   * This is the primary entry point called by the gateway when the engine
   * produces a Trade event. Must run before the trade response is sent to users.
   */
  async settleTrade(trade: TradeToSettle): Promise<SettlementResult> {
    const tradeValueUsd = trade.price * trade.quantity;

    try {
      let makerFee: number;
      let takerFee: number;
      let makerFeeRate: number;
      let takerFeeRate: number;
      let makerTierLevel = 0;
      let takerTierLevel = 0;

      if (this.feeCalcService) {
        // ── VIP-tier + DMX-aware path via FeeCalculationService ──

        // Look up each user's fee tier (initialize if not found)
        let makerTier: UserFeeTier | null =
          await this.feeCalcService.getUserFeeTier(trade.makerUserId);
        if (!makerTier) {
          makerTier = await this.feeCalcService.initializeUserFeeTier(trade.makerUserId);
        }
        // Safe: initializeUserFeeTier always returns a record
        const resolvedMakerTier = makerTier!;
        makerTierLevel = resolvedMakerTier.current_tier;

        let takerTier: UserFeeTier | null =
          await this.feeCalcService.getUserFeeTier(trade.takerUserId);
        if (!takerTier) {
          takerTier = await this.feeCalcService.initializeUserFeeTier(trade.takerUserId);
        }
        const resolvedTakerTier = takerTier!;
        takerTierLevel = resolvedTakerTier.current_tier;

        // Calculate maker fee
        const makerFeeResult: FeeCalculationResult =
          await this.feeCalcService.calculateTradingFee({
            user_id: trade.makerUserId,
            trade_side: 'maker',
            trade_value_usd: tradeValueUsd,
            fee_tier_level: makerTierLevel,
            dmx_balance: resolvedMakerTier.current_dmx_balance,
            pay_with_dmx: resolvedMakerTier.pay_fees_with_dmx && resolvedMakerTier.dmx_discount_enabled,
          });
        makerFee = makerFeeResult.final_fee_usd;
        makerFeeRate = makerFeeResult.effective_fee_rate;

        // Calculate taker fee
        const takerFeeResult: FeeCalculationResult =
          await this.feeCalcService.calculateTradingFee({
            user_id: trade.takerUserId,
            trade_side: 'taker',
            trade_value_usd: tradeValueUsd,
            fee_tier_level: takerTierLevel,
            dmx_balance: resolvedTakerTier.current_dmx_balance,
            pay_with_dmx: resolvedTakerTier.pay_fees_with_dmx && resolvedTakerTier.dmx_discount_enabled,
          });
        takerFee = takerFeeResult.final_fee_usd;
        takerFeeRate = takerFeeResult.effective_fee_rate;

        // Record fee collections via FeeCalculationService (delegates INSERT
        // and updates user fee stats)
        await this.feeCalcService.recordFeeCollection(
          trade.tradeId,
          trade.makerOrderId,
          trade.makerUserId,
          trade.symbol,
          'maker',
          trade.price,
          trade.quantity,
          makerFeeResult,
          makerTierLevel,
        );
        await this.feeCalcService.recordFeeCollection(
          trade.tradeId,
          trade.takerOrderId,
          trade.takerUserId,
          trade.symbol,
          'taker',
          trade.price,
          trade.quantity,
          takerFeeResult,
          takerTierLevel,
        );

        // Track volume for tier upgrades after settlement
        // Fire-and-forget: don't block the trade response on tier changes
        this.updateVolumeTracking(trade.makerUserId, tradeValueUsd, resolvedMakerTier.current_dmx_balance)
          .catch(err => console.error('[TradeSettlement] maker volume tracking error:', err));
        if (trade.makerUserId !== trade.takerUserId) {
          this.updateVolumeTracking(trade.takerUserId, tradeValueUsd, resolvedTakerTier.current_dmx_balance)
            .catch(err => console.error('[TradeSettlement] taker volume tracking error:', err));
        }
      } else {
        // ── Fallback: hardcoded 0.1% maker / 0.1% taker fees ──
        makerFeeRate = 0.001;
        takerFeeRate = 0.001;
        makerFee = tradeValueUsd * makerFeeRate;
        takerFee = tradeValueUsd * takerFeeRate;
      }

      // Update user balances (deduct fees or credit maker rebates)
      await this.updateBalancesForFees(trade, makerFee, takerFee);

      return {
        tradeId: trade.tradeId,
        makerFee,
        takerFee,
        makerFeeRate,
        takerFeeRate,
        makerFeeTier: this.feeCalcService ? makerTierLevel : undefined,
        takerFeeTier: this.feeCalcService ? takerTierLevel : undefined,
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
   * Update user balances to deduct fees or credit maker rebates.
   *
   * Positive fee (taker or standard maker): deducts from locked balance.
   * Negative fee (maker rebate from VIP levels 7-9): credits to locked balance.
   *
   * The quote asset is extracted from the trade symbol (not hardcoded 'USDT').
   */
  private async updateBalancesForFees(
    trade: TradeToSettle,
    makerFee: number,
    takerFee: number
  ): Promise<void> {
    const quoteAsset = this.extractQuoteAsset(trade.symbol);

    // Maker fees: may be positive (charge) or negative (rebate/credit)
    if (makerFee !== 0) {
      if (makerFee > 0) {
        await this.db.query(
          `UPDATE user_balances
           SET locked = GREATEST(locked - $1, 0),
               updated_at = NOW()
           WHERE user_id = $2 AND asset = $3`,
          [makerFee, trade.makerUserId, quoteAsset]
        );
      } else {
        // Maker rebate: credit the absolute value to locked balance
        const credit = Math.abs(makerFee);
        await this.db.query(
          `UPDATE user_balances
           SET locked = locked + $1,
               updated_at = NOW()
           WHERE user_id = $2 AND asset = $3`,
          [credit, trade.makerUserId, quoteAsset]
        );
      }
    }

    // Taker fees: typically always positive (never a rebate), but handle edge case
    if (takerFee !== 0) {
      if (takerFee > 0) {
        await this.db.query(
          `UPDATE user_balances
           SET locked = GREATEST(locked - $1, 0),
               updated_at = NOW()
           WHERE user_id = $2 AND asset = $3`,
          [takerFee, trade.takerUserId, quoteAsset]
        );
      } else {
        // Edge case: taker rebate (unlikely but safe to handle)
        const credit = Math.abs(takerFee);
        await this.db.query(
          `UPDATE user_balances
           SET locked = locked + $1,
               updated_at = NOW()
           WHERE user_id = $2 AND asset = $3`,
          [credit, trade.takerUserId, quoteAsset]
        );
      }
    }
  }

  /**
   * Update volume tracking for VIP tier upgrades after settlement.
   * This is called asynchronously (fire-and-forget) so it doesn't block
   * the trade response.
   */
  private async updateVolumeTracking(
    userId: string,
    tradeValueUsd: number,
    dmxBalance: number
  ): Promise<void> {
    if (!this.feeCalcService) return;

    try {
      // FeeCalculationService.updateUserVolumeAndCheckTier handles volume
      // accumulation and tier change detection internally.
      // The volume30dUSD parameter is the trade value of this specific trade;
      // FeeCalculationService will aggregate it server-side.
      const result: TierCheckResult =
        await this.feeCalcService.updateUserVolumeAndCheckTier(
          userId,
          tradeValueUsd,
          dmxBalance
        );

      if (result.should_change) {
        console.log(
          `[TradeSettlement] User ${userId} tier changed: ${result.change_type} ` +
          `to tier ${result.calculated_tier}`
        );
      }
    } catch (error) {
      console.error('[TradeSettlement] Volume tracking failed for user:', userId, error);
    }
  }
}

/**
 * Factory function to create a TradeSettlementService instance.
 * Accepts an optional FeeCalculationService for VIP-tier and DMX-aware fees.
 */
export function createTradeSettlementService(
  db: DatabaseService,
  feeCalcService?: FeeCalcService
): TradeSettlementService {
  return new TradeSettlementService(db, feeCalcService);
}
