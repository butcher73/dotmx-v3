/**
 * Withdrawal Service
 * Handles withdrawal requests and multisig transaction creation/export
 *
 * Flow:
 * 1. User requests withdrawal
 * 2. Validate balance and limits
 * 3. Lock balance and create withdrawal request
 * 4. Batch withdrawals and create unsigned transactions
 * 5. Export for offline signing
 * 6. Import signed transactions and broadcast
 */

import { JsonRpcProvider, Contract, parseUnits, formatUnits, Interface, getAddress, isAddress } from 'ethers';
import type { DatabaseService } from './database';
import type {
  WithdrawalRequest,
  CreateWithdrawalRequest,
  WithdrawalBatch,
  WithdrawalExport,
  WithdrawalExportTransaction,
  SignedWithdrawalImport,
  WarmWallet,
  SupportedToken,
  UserBalance,
  WithdrawalStatus,
} from '../types/custodial-wallet';
import {
  CHAIN_CONFIGS,
  CustodialWalletError,
  InsufficientBalanceError,
  WithdrawalLimitError,
  InvalidAddressError,
  UnsupportedChainError,
  UnsupportedTokenError,
} from '../types/custodial-wallet';

// ERC-20 ABI for token transfers
const ERC20_ABI = [
  'function transfer(address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
];

// Gnosis Safe ABI for transaction creation
const GNOSIS_SAFE_ABI = [
  'function getTransactionHash(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, uint256 _nonce) view returns (bytes32)',
  'function nonce() view returns (uint256)',
  'function execTransaction(address to, uint256 value, bytes data, uint8 operation, uint256 safeTxGas, uint256 baseGas, uint256 gasPrice, address gasToken, address refundReceiver, bytes signatures) returns (bool)',
];

interface WithdrawalConfig {
  min_delay_seconds: number;
  large_amount_threshold_usd: number;
  large_amount_delay_hours: number;
  /** Per-token raw amount limit (NOT USD). Admin should set per-token limits. */
  daily_limit_amount: number;
  max_pending_per_user: number;
}

const DEFAULT_CONFIG: WithdrawalConfig = {
  min_delay_seconds: parseInt(process.env.WITHDRAWAL_MIN_DELAY_SECONDS || '60', 10),
  large_amount_threshold_usd: parseFloat(process.env.WITHDRAWAL_LARGE_THRESHOLD_USD || '10000'),
  large_amount_delay_hours: parseInt(process.env.WITHDRAWAL_LARGE_DELAY_HOURS || '24', 10),
  // Per-token raw amount (e.g. 100000 means 100000 USDT or 100000 units of the token, NOT USD)
  daily_limit_amount: parseFloat(process.env.WITHDRAWAL_DAILY_LIMIT_AMOUNT || '100000'),
  max_pending_per_user: parseInt(process.env.WITHDRAWAL_MAX_PENDING || '10', 10),
};

export class WithdrawalService {
  private db: DatabaseService;
  private config: WithdrawalConfig;
  private providers: Map<string, JsonRpcProvider> = new Map();

  constructor(db: DatabaseService, config?: Partial<WithdrawalConfig>) {
    this.db = db;
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.initializeProviders();
  }

  /**
   * Initialize RPC providers
   */
  private initializeProviders(): void {
    for (const [chainCode, config] of Object.entries(CHAIN_CONFIGS)) {
      if (config.is_evm) {
        this.providers.set(chainCode, new JsonRpcProvider(config.rpc_url));
      }
    }
  }

  /**
   * Get provider for chain
   */
  private getProvider(chain_code: string): JsonRpcProvider {
    const provider = this.providers.get(chain_code);
    if (!provider) {
      throw new CustodialWalletError(`No provider for chain: ${chain_code}`);
    }
    return provider;
  }

  /**
   * Create a withdrawal request
   */
  async createWithdrawal(request: CreateWithdrawalRequest): Promise<WithdrawalRequest> {
    const { user_id, chain_code, token_symbol, amount, destination_address } = request;

    // Validate chain
    const chainConfig = CHAIN_CONFIGS[chain_code];
    if (!chainConfig) {
      throw new UnsupportedChainError(chain_code);
    }

    // Validate address
    if (!isAddress(destination_address)) {
      throw new InvalidAddressError('Invalid destination address');
    }
    const checksumAddress = getAddress(destination_address);

    // Get supported token
    const token = await this.getSupportedToken(chain_code, token_symbol);
    if (!token) {
      throw new UnsupportedTokenError(token_symbol, chain_code);
    }

    // Check minimum withdrawal
    const amountNum = parseFloat(amount);
    const minWithdrawal = parseFloat(token.min_withdrawal);
    if (amountNum < minWithdrawal) {
      throw new CustodialWalletError(`Minimum withdrawal is ${minWithdrawal} ${token_symbol}`);
    }

    // Check user balance (must cover amount + fee)
    const feeAmount = parseFloat(token.withdrawal_fee);
    const balance = await this.getUserBalance(user_id, token.asset_id);
    if (!balance || parseFloat(balance.available) < (amountNum + feeAmount)) {
      throw new InsufficientBalanceError();
    }

    // Check pending withdrawal limit
    const pendingCount = await this.getPendingWithdrawalCount(user_id);
    if (pendingCount >= this.config.max_pending_per_user) {
      throw new WithdrawalLimitError('Too many pending withdrawals');
    }

    // Check daily limit (per-token raw amount, NOT USD - compares token units)
    const dailyTotal = await this.getDailyWithdrawalTotal(user_id);
    if (dailyTotal + amountNum > this.config.daily_limit_amount) {
      throw new WithdrawalLimitError('Daily withdrawal limit exceeded');
    }

    // Enforce minimum delay between withdrawals
    const lastWithdrawal = await this.db.queryOne<{ created_at: string }>(
      `SELECT created_at FROM withdrawal_requests
       WHERE user_id = $1 AND status NOT IN ('cancelled', 'failed')
       ORDER BY created_at DESC LIMIT 1`,
      [user_id]
    );
    if (lastWithdrawal && this.config.min_delay_seconds > 0) {
      const elapsed = (Date.now() - new Date(lastWithdrawal.created_at).getTime()) / 1000;
      if (elapsed < this.config.min_delay_seconds) {
        throw new WithdrawalLimitError(
          `Please wait ${Math.ceil(this.config.min_delay_seconds - elapsed)} seconds before next withdrawal`
        );
      }
    }

    // Check 2FA/MFA enforcement: if user has MFA enabled, the withdrawal request
    // must include verification that 2FA was completed. This prevents a stolen JWT
    // from being used to drain funds.
    const userRecord = await this.db.queryOne<{ mfa_enabled: boolean }>(
      'SELECT mfa_enabled FROM users WHERE id = $1 AND deleted_at IS NULL',
      [user_id]
    );

    if (userRecord?.mfa_enabled) {
      // The caller must explicitly set is_2fa_verified = true after validating the TOTP code.
      // The actual TOTP verification happens in the route layer (auth middleware).
      // This acts as a defense-in-depth check - if the flag is missing, reject.
      if (!(request as any).is_2fa_verified) {
        throw new CustodialWalletError(
          '2FA verification required for withdrawals. Please provide a valid 2FA code.',
          'WITHDRAWAL_2FA_REQUIRED',
          403
        );
      }
    }

    // Calculate fee
    const feeAmount = parseFloat(token.withdrawal_fee);

    // Lock balance (amount + fee so completeWithdrawal doesn't go negative)
    const totalToLock = (amountNum + feeAmount).toString();
    await this.lockBalance(user_id, token.asset_id, totalToLock);

    // Create withdrawal request
    const withdrawal = await this.db.queryOne<WithdrawalRequest>(
      `INSERT INTO withdrawal_requests
       (user_id, network_id, asset_id, amount, fee, to_address, status, ip_address, user_agent, requires_2fa, is_2fa_verified)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending_approval', $7, $8, $9, $10)
       RETURNING *`,
      [
        user_id,
        token.network_id,
        token.asset_id,
        amount,
        feeAmount.toString(),
        checksumAddress,
        request.ip_address,
        request.user_agent,
        userRecord?.mfa_enabled ?? false,
        (request as any).is_2fa_verified ?? false,
      ]
    );

    if (!withdrawal) {
      // Unlock balance if failed
      await this.unlockBalance(user_id, token.asset_id, amount);
      throw new CustodialWalletError('Failed to create withdrawal request');
    }

    return withdrawal;
  }

  /**
   * Get user's withdrawal history
   */
  async getUserWithdrawals(
    user_id: string,
    options?: { status?: WithdrawalStatus; limit?: number; offset?: number }
  ): Promise<WithdrawalRequest[]> {
    const { status, limit = 50, offset = 0 } = options || {};

    if (status) {
      return this.db.query<WithdrawalRequest>(
        `SELECT * FROM withdrawal_requests
         WHERE user_id = $1 AND status = $2
         ORDER BY created_at DESC
         LIMIT $3 OFFSET $4`,
        [user_id, status, limit, offset]
      );
    }

    return this.db.query<WithdrawalRequest>(
      `SELECT * FROM withdrawal_requests
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT $2 OFFSET $3`,
      [user_id, limit, offset]
    );
  }

  /**
   * Cancel a pending withdrawal
   */
  async cancelWithdrawal(user_id: string, withdrawal_id: string): Promise<void> {
    const withdrawal = await this.db.queryOne<WithdrawalRequest>(
      `SELECT * FROM withdrawal_requests WHERE id = $1 AND user_id = $2`,
      [withdrawal_id, user_id]
    );

    if (!withdrawal) {
      throw new CustodialWalletError('Withdrawal not found');
    }

    if (withdrawal.status !== 'pending_approval') {
      throw new CustodialWalletError('Cannot cancel withdrawal in current status');
    }

    // Update status
    await this.db.execute(
      `UPDATE withdrawal_requests SET status = 'cancelled', updated_at = NOW() WHERE id = $1`,
      [withdrawal_id]
    );

    // Unlock balance
    await this.unlockBalance(
      user_id,
      withdrawal.asset_id,
      withdrawal.amount
    );
  }

  /**
   * Create a withdrawal batch for export
   */
  async createBatch(chain_code: string): Promise<WithdrawalBatch> {
    // Get pending withdrawals for chain
    const withdrawals = await this.db.query<WithdrawalRequest>(
      `SELECT wr.* FROM withdrawal_requests wr
       JOIN networks n ON wr.network_id = n.id
       WHERE n.code = $1 AND wr.status = 'pending_approval'
       ORDER BY wr.created_at
       LIMIT 100`,
      [chain_code]
    );

    if (withdrawals.length === 0) {
      throw new CustodialWalletError('No pending withdrawals to batch');
    }

    // Calculate total
    const totalAmount = withdrawals.reduce(
      (sum, w) => sum + parseFloat(w.amount),
      0
    );

    // Create batch
    const batch = await this.db.queryOne<WithdrawalBatch>(
      `INSERT INTO withdrawal_batches
       (network_id, status, total_amount, transaction_count)
       VALUES ((SELECT id FROM networks WHERE code = $1), 'pending', $2, $3)
       RETURNING *`,
      [chain_code, totalAmount.toString(), withdrawals.length]
    );

    if (!batch) {
      throw new CustodialWalletError('Failed to create withdrawal batch');
    }

    // Update withdrawals with batch ID
    const withdrawalIds = withdrawals.map(w => w.id);
    await this.db.execute(
      `UPDATE withdrawal_requests
       SET batch_id = $1, status = 'approved', updated_at = NOW()
       WHERE id = ANY($2)`,
      [batch.id, withdrawalIds]
    );

    return batch;
  }

  /**
   * Export batch for offline signing
   */
  async exportBatch(batch_id: string): Promise<WithdrawalExport> {
    const batch = await this.db.queryOne<WithdrawalBatch & { chain_code: string }>(
      `SELECT wb.*, n.code as chain_code
       FROM withdrawal_batches wb
       JOIN networks n ON wb.network_id = n.id
       WHERE wb.id = $1`,
      [batch_id]
    );

    if (!batch) {
      throw new CustodialWalletError('Batch not found');
    }

    if (batch.status !== 'pending') {
      throw new CustodialWalletError('Batch already exported or processed');
    }

    // Get withdrawals in batch (join with assets for symbol/address info)
    const withdrawals = await this.db.query<WithdrawalRequest & { token_symbol: string; token_address: string | null }>(
      `SELECT wr.*, a.symbol as token_symbol, an.contract_address as token_address
       FROM withdrawal_requests wr
       JOIN assets a ON wr.asset_id = a.id
       LEFT JOIN asset_networks an ON wr.asset_id = an.asset_id AND wr.network_id = an.network_id
       WHERE wr.batch_id = $1`,
      [batch_id]
    );

    // Get warm wallet
    const warmWallet = await this.getWarmWallet(batch.chain_code);
    if (!warmWallet) {
      throw new CustodialWalletError('Warm wallet not configured');
    }

    const chainConfig = CHAIN_CONFIGS[batch.chain_code];

    // Build transactions
    const transactions: WithdrawalExportTransaction[] = [];
    let estimatedGas = 0n;

    for (const withdrawal of withdrawals) {
      const token = await this.getSupportedToken(batch.chain_code, withdrawal.token_symbol);
      if (!token) continue;

      let data = '0x';
      let value = '0';

      if (token.is_native) {
        // Native token transfer
        value = parseUnits(withdrawal.amount, token.decimals).toString();
      } else {
        // ERC-20 transfer
        const iface = new Interface(ERC20_ABI);
        data = iface.encodeFunctionData('transfer', [
          withdrawal.to_address,
          parseUnits(withdrawal.amount, token.decimals),
        ]);
      }

      transactions.push({
        id: withdrawal.id,
        to: token.is_native ? withdrawal.to_address : token.token_address!,
        value,
        token_address: token.token_address,
        token_symbol: token.token_symbol,
        data,
      });

      // Estimate gas (simplified)
      estimatedGas += token.is_native ? 21000n : 65000n;
    }

    // Update batch status
    await this.db.execute(
      `UPDATE withdrawal_batches
       SET status = 'exported', exported_at = NOW(), unsigned_tx_data = $2
       WHERE id = $1`,
      [batch_id, JSON.stringify({ transactions })]
    );

    return {
      batch_id,
      created_at: new Date().toISOString(),
      chain_code: batch.chain_code,
      chain_id: chainConfig.chain_id,
      warm_wallet: warmWallet.address,
      warm_wallet_type: warmWallet.wallet_type,
      required_signatures: warmWallet.required_signatures,
      transactions,
      total_amount: batch.total_amount,
      estimated_gas: estimatedGas.toString(),
    };
  }

  /**
   * Import signed transaction and broadcast
   */
  async importAndBroadcast(data: SignedWithdrawalImport): Promise<{ tx_hash: string }> {
    const batch = await this.db.queryOne<WithdrawalBatch & { chain_code: string }>(
      `SELECT wb.*, n.code as chain_code
       FROM withdrawal_batches wb
       JOIN networks n ON wb.network_id = n.id
       WHERE wb.id = $1`,
      [data.batch_id]
    );

    if (!batch) {
      throw new CustodialWalletError('Batch not found');
    }

    if (batch.status !== 'exported') {
      throw new CustodialWalletError('Batch not ready for signing');
    }

    const provider = this.getProvider(batch.chain_code);

    // Update batch with signed data
    await this.db.execute(
      `UPDATE withdrawal_batches
       SET status = 'signed', signed_at = NOW(), signed_tx_data = $2
       WHERE id = $1`,
      [data.batch_id, JSON.stringify({ signed_tx: data.signed_tx })]
    );

    // Broadcast transaction
    try {
      const txResponse = await provider.broadcastTransaction(data.signed_tx);
      const txHash = txResponse.hash;

      // Update batch
      await this.db.execute(
        `UPDATE withdrawal_batches
         SET status = 'broadcast', broadcast_at = NOW(), tx_hash = $2
         WHERE id = $1`,
        [data.batch_id, txHash]
      );

      // Update withdrawals
      await this.db.execute(
        `UPDATE withdrawal_requests
         SET status = 'broadcasted', tx_hash = $2, broadcasted_at = NOW()
         WHERE batch_id = $1`,
        [data.batch_id, txHash]
      );

      // Wait for confirmation (or do this async)
      await txResponse.wait();

      // Mark as completed
      await this.completeBatch(data.batch_id, txHash);

      return { tx_hash: txHash };
    } catch (error) {
      await this.db.execute(
        `UPDATE withdrawal_batches
         SET status = 'failed', updated_at = NOW()
         WHERE id = $1`,
        [data.batch_id]
      );
      throw new CustodialWalletError(`Broadcast failed: ${(error as Error).message}`);
    }
  }

  /**
   * Complete a batch after confirmation
   */
  private async completeBatch(batch_id: string, tx_hash: string): Promise<void> {
    await this.db.execute('BEGIN');
    try {
      // Update batch
      await this.db.execute(
        `UPDATE withdrawal_batches
         SET status = 'completed', completed_at = NOW()
         WHERE id = $1`,
        [batch_id]
      );

      // Get withdrawals with row lock
      const withdrawals = await this.db.query<WithdrawalRequest>(
        `SELECT * FROM withdrawal_requests WHERE batch_id = $1 FOR UPDATE`,
        [batch_id]
      );

      for (const withdrawal of withdrawals) {
        // Update withdrawal status
        await this.db.execute(
          `UPDATE withdrawal_requests
           SET status = 'completed', completed_at = NOW()
           WHERE id = $1`,
          [withdrawal.id]
        );

        // Complete balance deduction (from locked to withdrawn)
        await this.completeWithdrawal(withdrawal);
      }

      await this.db.execute('COMMIT');
    } catch (error) {
      await this.db.execute('ROLLBACK');
      throw error;
    }
  }

  /**
   * Complete individual withdrawal (update balances)
   */
  private async completeWithdrawal(withdrawal: WithdrawalRequest): Promise<void> {
    const totalDeducted = parseFloat(withdrawal.amount) + parseFloat(withdrawal.fee);

    // Get current balance for audit
    const currentBalance = await this.db.queryOne<{ locked: string }>(
      `SELECT locked FROM user_balances
       WHERE user_id = $1 AND asset_id = $2`,
      [withdrawal.user_id, withdrawal.asset_id]
    );

    const balanceBefore = currentBalance?.locked || '0';

    // Deduct from locked balance
    await this.db.execute(
      `UPDATE user_balances
       SET locked = locked - $3,
           total_withdrawn = total_withdrawn + $3,
           last_updated_at = NOW()
       WHERE user_id = $1 AND asset_id = $2`,
      [withdrawal.user_id, withdrawal.asset_id, totalDeducted]
    );

    // Create balance transaction record
    await this.db.execute(
      `INSERT INTO balance_transactions
       (user_id, asset_id, tx_type, amount, balance_before, balance_after, status, description, metadata)
       VALUES ($1, $2, 'withdrawal', $3, $4, $5, 'completed', 'Withdrawal completed', $6::jsonb)`,
      [
        withdrawal.user_id,
        withdrawal.asset_id,
        totalDeducted,
        balanceBefore,
        (parseFloat(balanceBefore) - totalDeducted).toString(),
        JSON.stringify({ reference_type: 'withdrawal', reference_id: withdrawal.id }),
      ]
    );
  }

  /**
   * Get pending batches for admin
   */
  async getPendingBatches(): Promise<WithdrawalBatch[]> {
    return this.db.query<WithdrawalBatch>(
      `SELECT * FROM withdrawal_batches
       WHERE status IN ('pending', 'exported')
       ORDER BY created_at`
    );
  }

  /**
   * Get pending withdrawals for admin
   */
  async getPendingWithdrawals(chain_code?: string): Promise<WithdrawalRequest[]> {
    if (chain_code) {
      return this.db.query<WithdrawalRequest>(
        `SELECT wr.* FROM withdrawal_requests wr
         JOIN networks n ON wr.network_id = n.id
         WHERE n.code = $1 AND wr.status = 'pending_approval'
         ORDER BY wr.created_at`,
        [chain_code]
      );
    }

    return this.db.query<WithdrawalRequest>(
      `SELECT * FROM withdrawal_requests
       WHERE status = 'pending_approval'
       ORDER BY created_at`
    );
  }

  /**
   * Lock user balance for withdrawal
   */
  private async lockBalance(
    user_id: string,
    asset_id: string,
    amount: string
  ): Promise<void> {
    const balance = await this.db.queryOne<{ available: string }>(
      `SELECT available FROM user_balances
       WHERE user_id = $1 AND asset_id = $2`,
      [user_id, asset_id]
    );

    const balanceBefore = balance?.available || '0';

    const updateResult = await this.db.query<{ available: string }>(
      `UPDATE user_balances
       SET available = available - $3,
           locked = locked + $3,
           last_updated_at = NOW()
       WHERE user_id = $1 AND asset_id = $2 AND available >= $3
       RETURNING available`,
      [user_id, asset_id, amount]
    );

    if (!updateResult || updateResult.length === 0) {
      throw new Error('Insufficient balance for withdrawal lock');
    }

    // Balance transaction record
    await this.db.execute(
      `INSERT INTO balance_transactions
       (user_id, asset_id, tx_type, amount, balance_before, balance_after, status, description)
       VALUES ($1, $2, 'withdrawal_pending', $3, $4, $5, 'completed', 'Balance locked for withdrawal')`,
      [
        user_id,
        asset_id,
        amount,
        balanceBefore,
        (parseFloat(balanceBefore) - parseFloat(amount)).toString(),
      ]
    );
  }

  /**
   * Unlock user balance (for cancelled withdrawals)
   */
  private async unlockBalance(
    user_id: string,
    asset_id: string,
    amount: string
  ): Promise<void> {
    await this.db.execute(
      `UPDATE user_balances
       SET available = available + $3,
           locked = locked - $3,
           last_updated_at = NOW()
       WHERE user_id = $1 AND asset_id = $2`,
      [user_id, asset_id, amount]
    );

    // Balance transaction record
    await this.db.execute(
      `INSERT INTO balance_transactions
       (user_id, asset_id, tx_type, amount, balance_before, balance_after, status, description)
       VALUES ($1, $2, 'adjustment', $3, '0', $3, 'completed', 'Balance unlocked - withdrawal cancelled')`,
      [user_id, asset_id, amount]
    );
  }

  /**
   * Get user balance
   */
  async getUserBalance(
    user_id: string,
    asset_id: string
  ): Promise<UserBalance | null> {
    return this.db.queryOne<UserBalance>(
      `SELECT * FROM user_balances
       WHERE user_id = $1 AND asset_id = $2`,
      [user_id, asset_id]
    );
  }

  /**
   * Get all user balances
   */
  async getAllUserBalances(user_id: string): Promise<UserBalance[]> {
    return this.db.query<UserBalance>(
      `SELECT ub.*, a.symbol as token_symbol
       FROM user_balances ub
       JOIN assets a ON ub.asset_id = a.id
       WHERE ub.user_id = $1
       ORDER BY a.symbol`,
      [user_id]
    );
  }

  /**
   * Get pending withdrawal count for user
   */
  private async getPendingWithdrawalCount(user_id: string): Promise<number> {
    const result = await this.db.queryOne<{ count: string }>(
      `SELECT COUNT(*) as count FROM withdrawal_requests
       WHERE user_id = $1 AND status IN ('pending_approval', 'approved')`,
      [user_id]
    );
    return parseInt(result?.count || '0', 10);
  }

  /**
   * Get daily withdrawal total for user (raw token amount, NOT USD)
   */
  private async getDailyWithdrawalTotal(user_id: string): Promise<number> {
    const result = await this.db.queryOne<{ total: string }>(
      `SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
       FROM withdrawal_requests
       WHERE user_id = $1
         AND created_at > NOW() - INTERVAL '24 hours'
         AND status NOT IN ('cancelled', 'failed')`,
      [user_id]
    );
    return parseFloat(result?.total || '0');
  }

  /**
   * Get supported token
   */
  private async getSupportedToken(
    chain_code: string,
    token_symbol: string
  ): Promise<SupportedToken | null> {
    return this.db.queryOne<SupportedToken>(
      `SELECT an.*, a.symbol as token_symbol, a.name as token_name,
              n.code as chain_code, an.contract_address as token_address,
              an.withdrawal_fee, an.min_withdrawal, an.asset_id, an.network_id
       FROM asset_networks an
       JOIN assets a ON an.asset_id = a.id
       JOIN networks n ON an.network_id = n.id
       WHERE n.code = $1 AND a.symbol = $2 AND an.is_active = TRUE`,
      [chain_code, token_symbol]
    );
  }

  /**
   * Get warm wallet
   */
  private async getWarmWallet(chain_code: string): Promise<WarmWallet | null> {
    return this.db.queryOne<WarmWallet>(
      `SELECT w.* FROM warm_wallets w
       JOIN networks n ON w.network_id = n.id
       WHERE n.code = $1 AND w.is_active = TRUE`,
      [chain_code]
    );
  }

  /**
   * Get withdrawal service status
   */
  async getStatus(): Promise<{
    pending_withdrawals: number;
    pending_batches: number;
    total_pending_amount: string;
  }> {
    const stats = await this.db.queryOne<{
      pending_withdrawals: string;
      pending_batches: string;
      total_amount: string;
    }>(
      `SELECT
         (SELECT COUNT(*) FROM withdrawal_requests WHERE status = 'pending_approval') as pending_withdrawals,
         (SELECT COUNT(*) FROM withdrawal_batches WHERE status IN ('pending', 'exported')) as pending_batches,
         (SELECT COALESCE(SUM(CAST(amount AS DECIMAL)), 0) FROM withdrawal_requests WHERE status = 'pending_approval') as total_amount`
    );

    return {
      pending_withdrawals: parseInt(stats?.pending_withdrawals || '0', 10),
      pending_batches: parseInt(stats?.pending_batches || '0', 10),
      total_pending_amount: stats?.total_amount || '0',
    };
  }
}

/**
 * Create Withdrawal Service
 */
export function createWithdrawalService(
  db: DatabaseService,
  config?: Partial<WithdrawalConfig>
): WithdrawalService {
  return new WithdrawalService(db, config);
}
