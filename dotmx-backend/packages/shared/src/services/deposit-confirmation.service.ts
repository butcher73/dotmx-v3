/**
 * Deposit Confirmation Service
 *
 * Lightweight service that only checks confirmations for pending deposits.
 * Deposit detection is handled by Alchemy webhooks.
 *
 * Flow:
 * 1. Query deposits with status 'pending' or 'confirming'
 * 2. Check current block number via RPC
 * 3. Update confirmation count
 * 4. Move to 'confirmed' when threshold reached
 * 5. Trigger sweep for confirmed deposits
 */

import { JsonRpcProvider } from 'ethers';
import type { DatabaseService } from './database';
import { CHAIN_CONFIGS } from '../types/custodial-wallet';
import { logger } from './logger';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface ConfirmationCheckerConfig {
  pollIntervalMs: number;      // How often to check (default: 30s)
  maxDepositsPerBatch: number; // Max deposits to check per cycle (default: 100)
  maxAgeHours: number;         // Only check deposits newer than this (default: 48h)
}

const DEFAULT_CONFIG: ConfirmationCheckerConfig = {
  pollIntervalMs: parseInt(process.env.CONFIRMATION_POLL_MS || '30000', 10),
  maxDepositsPerBatch: parseInt(process.env.CONFIRMATION_BATCH_SIZE || '100', 10),
  maxAgeHours: parseInt(process.env.CONFIRMATION_MAX_AGE_HOURS || '48', 10),
};

// =============================================================================
// SERVICE
// =============================================================================

export class DepositConfirmationService {
  private db: DatabaseService;
  private config: ConfirmationCheckerConfig;
  private providers: Map<string, JsonRpcProvider> = new Map();
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timeout | null = null;

  constructor(db: DatabaseService, config?: Partial<ConfirmationCheckerConfig>) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeProviders();
  }

  /**
   * Initialize RPC providers for all EVM chains
   */
  private initializeProviders(): void {
    for (const [chainCode, config] of Object.entries(CHAIN_CONFIGS)) {
      if (config.is_evm && config.rpc_url) {
        this.providers.set(chainCode, new JsonRpcProvider(config.rpc_url));
      }
    }
  }

  /**
   * Get provider for chain
   */
  private getProvider(chainCode: string): JsonRpcProvider | null {
    return this.providers.get(chainCode) || null;
  }

  /**
   * Start the confirmation checker
   */
  start(): void {
    if (this.isRunning) {
      logger.debug('[ConfirmationChecker] Already running');
      return;
    }

    this.isRunning = true;
    logger.info(`[ConfirmationChecker] Started`, { pollIntervalMs: this.config.pollIntervalMs });

    // Run immediately, then on interval
    this.checkConfirmations().catch(err => logger.error('[ConfirmationChecker] Error', { error: String(err) }));

    this.intervalId = setInterval(() => {
      this.checkConfirmations().catch(err => logger.error('[ConfirmationChecker] Error', { error: String(err) }));
    }, this.config.pollIntervalMs);
  }

  /**
   * Stop the confirmation checker
   */
  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('[ConfirmationChecker] Stopped');
  }

  /**
   * Check confirmations for pending deposits
   */
  async checkConfirmations(): Promise<{ checked: number; confirmed: number; errors: number }> {
    const stats = { checked: 0, confirmed: 0, errors: 0 };

    try {
      // Get pending deposits grouped by chain
      const pendingDeposits = await this.db.query<{
        id: string;
        chain_code: string;
        tx_hash: string;
        block_number: number;
        confirmations: number;
        required_confirmations: number;
        status: string;
      }>(
        `SELECT
          d.id,
          c.code as chain_code,
          d.tx_hash,
          d.block_number,
          d.confirmations,
          COALESCE(c.min_confirmations, 12) as required_confirmations,
          d.status
         FROM deposits d
         LEFT JOIN networks c ON d.network_id = c.id
         WHERE d.status IN ('pending', 'confirming')
           AND d.detected_at > NOW() - INTERVAL '${this.config.maxAgeHours} hours'
           AND d.block_number IS NOT NULL
         ORDER BY d.detected_at DESC
         LIMIT $1`,
        [this.config.maxDepositsPerBatch]
      );

      if (pendingDeposits.length === 0) {
        return stats;
      }

      // Group by chain for efficient RPC calls
      const byChain = new Map<string, typeof pendingDeposits>();
      for (const deposit of pendingDeposits) {
        if (!byChain.has(deposit.chain_code)) {
          byChain.set(deposit.chain_code, []);
        }
        byChain.get(deposit.chain_code)!.push(deposit);
      }

      // Process each chain
      for (const [chainCode, deposits] of byChain) {
        const provider = this.getProvider(chainCode);
        if (!provider) {
          logger.warn(`[ConfirmationChecker] No provider for chain: ${chainCode}`);
          continue;
        }

        try {
          // Get current block (single RPC call per chain)
          const currentBlock = await provider.getBlockNumber();

          // Update each deposit
          for (const deposit of deposits) {
            stats.checked++;

            const confirmations = currentBlock - deposit.block_number;
            const isConfirmed = confirmations >= deposit.required_confirmations;

            // Determine new status
            let newStatus = deposit.status;
            if (isConfirmed && deposit.status !== 'confirmed') {
              newStatus = 'confirmed';
              stats.confirmed++;
            } else if (confirmations > 0 && deposit.status === 'pending') {
              newStatus = 'confirming';
            }

            // Update if changed
            if (confirmations !== deposit.confirmations || newStatus !== deposit.status) {
              await this.db.execute(
                `UPDATE deposits
                 SET confirmations = $1,
                     status = $2,
                     confirmed_at = CASE WHEN $2::varchar = 'confirmed' THEN NOW() ELSE confirmed_at END
                 WHERE id = $3`,
                [confirmations, newStatus, deposit.id]
              );

              if (newStatus === 'confirmed') {
                logger.info('[ConfirmationChecker] Deposit confirmed', {
                  tx_hash: deposit.tx_hash,
                  confirmations: String(confirmations),
                  required: String(deposit.required_confirmations),
                });
                // Credit user balance immediately on confirmation
                await this.creditUserBalance(deposit.id);
              }
            }
          }
        } catch (error) {
          logger.error(`[ConfirmationChecker] Error processing ${chainCode}`, { error: String(error) });
          stats.errors += deposits.length;
        }
      }

    } catch (error) {
      logger.error('[ConfirmationChecker] Error', { error: String(error) });
    }

    if (stats.checked > 0) {
      logger.info('[ConfirmationChecker] Cycle complete', {
        checked: stats.checked,
        confirmed: stats.confirmed,
        errors: stats.errors,
      });
    }

    return stats;
  }

  /**
   * Credit user balance when deposit is confirmed
   */
  private async creditUserBalance(depositId: string): Promise<void> {
    try {
      // Get deposit details
      const deposit = await this.db.queryOne<{
        id: string;
        user_id: string;
        asset_id: string;
        amount: string;
        tx_hash: string;
      }>(
        `SELECT id, user_id, asset_id, amount, tx_hash FROM deposits WHERE id = $1`,
        [depositId]
      );

      if (!deposit) {
        logger.error(`[ConfirmationChecker] Deposit not found for balance credit`, { deposit_id: depositId });
        return;
      }

      // Check if already credited (idempotency via audit log)
      const alreadyCredited = await this.db.queryOne<{ id: string }>(
        `SELECT id FROM balance_transactions
         WHERE tx_type = 'deposit' AND metadata->>'deposit_id' = $1`,
        [deposit.id]
      );

      if (alreadyCredited) {
        logger.debug(`[ConfirmationChecker] Deposit already credited, skipping`, { deposit_id: deposit.id });
        return;
      }

      const amount = deposit.amount;

      // Get current balance
      const currentBalance = await this.db.queryOne<{ available: string }>(
        `SELECT available FROM user_balances WHERE user_id = $1 AND asset_id = $2`,
        [deposit.user_id, deposit.asset_id]
      );

      const balanceBefore = currentBalance?.available || '0';

      // Upsert balance
      await this.db.execute(
        `INSERT INTO user_balances (user_id, asset_id, available, total_deposited)
         VALUES ($1, $2, $3, $3)
         ON CONFLICT (user_id, asset_id)
         DO UPDATE SET
           available = user_balances.available + $3,
           total_deposited = user_balances.total_deposited + $3,
           last_updated_at = NOW()`,
        [deposit.user_id, deposit.asset_id, amount]
      );

      // Get new balance
      const newBalance = await this.db.queryOne<{ available: string }>(
        `SELECT available FROM user_balances WHERE user_id = $1 AND asset_id = $2`,
        [deposit.user_id, deposit.asset_id]
      );

      // Create audit log entry
      await this.db.execute(
        `INSERT INTO balance_transactions
         (user_id, asset_id, tx_type, amount, balance_before, balance_after, status, description, metadata)
         VALUES ($1, $2, 'deposit', $3, $4, $5, 'completed', 'Deposit confirmed and credited', jsonb_build_object('deposit_id', $6))`,
        [
          deposit.user_id,
          deposit.asset_id,
          amount,
          balanceBefore,
          newBalance?.available || amount,
          deposit.id,
        ]
      );

      logger.info('[ConfirmationChecker] Credited to user', {
        user_id: deposit.user_id,
        tx_hash: deposit.tx_hash,
        deposit_id: deposit.id,
      });
    } catch (error) {
      logger.error(`[ConfirmationChecker] Failed to credit balance for deposit`, { deposit_id: depositId, error: String(error) });
    }
  }

  /**
   * Get confirmation checker status
   */
  getStatus() {
    return {
      isRunning: this.isRunning,
      pollIntervalMs: this.config.pollIntervalMs,
      maxDepositsPerBatch: this.config.maxDepositsPerBatch,
      chainsConfigured: Array.from(this.providers.keys()),
    };
  }
}

// =============================================================================
// FACTORY
// =============================================================================

export function createDepositConfirmationService(
  db: DatabaseService,
  config?: Partial<ConfirmationCheckerConfig>
): DepositConfirmationService {
  return new DepositConfirmationService(db, config);
}
