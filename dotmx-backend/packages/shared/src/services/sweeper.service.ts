/**
 * Sweeper Service
 * Monitors deposit addresses and sweeps funds to warm wallet
 *
 * Flow:
 * 1. Poll deposit addresses for new transactions
 * 2. Wait for required confirmations
 * 3. Create and sign sweep transaction
 * 4. Transfer to warm wallet
 * 5. Update user balance
 */

import { JsonRpcProvider, Contract, formatUnits, parseUnits, Wallet } from 'ethers';
import type { DatabaseService } from './database';
import type { HDWalletService } from './hd-wallet.service';
import type {
  DepositAddress,
  Deposit,
  SweepTransaction,
  WarmWallet,
  SupportedToken,
  ChainConfig,
  BalanceOperation,
} from '../types/custodial-wallet';
import { CHAIN_CONFIGS, CustodialWalletError } from '../types/custodial-wallet';
import { logger } from './logger';

// ERC-20 ABI for token transfers
const ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
  'function decimals() view returns (uint8)',
  'function symbol() view returns (string)',
];

interface SweeperConfig {
  poll_interval_ms: number;
  max_gas_price_gwei: number;
  min_sweep_value_usd: number;
  batch_size: number;
}

const DEFAULT_CONFIG: SweeperConfig = {
  poll_interval_ms: parseInt(process.env.SWEEPER_INTERVAL_MS || '30000', 10),
  max_gas_price_gwei: parseInt(process.env.SWEEPER_MAX_GAS_GWEI || '100', 10),
  min_sweep_value_usd: parseFloat(process.env.SWEEPER_MIN_VALUE_USD || '10'),
  batch_size: parseInt(process.env.SWEEPER_BATCH_SIZE || '50', 10),
};

export class SweeperService {
  private db: DatabaseService;
  private hdWallet: HDWalletService;
  private config: SweeperConfig;
  private providers: Map<string, JsonRpcProvider> = new Map();
  private isRunning: boolean = false;
  private intervalId: NodeJS.Timer | null = null;

  constructor(
    db: DatabaseService,
    hdWallet: HDWalletService,
    config?: Partial<SweeperConfig>
  ) {
    this.db = db;
    this.hdWallet = hdWallet;
    this.config = { ...DEFAULT_CONFIG, ...config };

    // Initialize providers for each chain
    this.initializeProviders();
  }

  /**
   * Initialize RPC providers for all chains
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
   * Start the sweeper (background polling)
   */
  start(): void {
    if (this.isRunning) {
      logger.debug('Sweeper already running');
      return;
    }

    this.isRunning = true;
    logger.info(`Sweeper started`, { pollIntervalMs: this.config.poll_interval_ms });

    this.intervalId = setInterval(() => {
      this.sweep().catch(error => {
        logger.error('Sweeper error', { error: String(error) });
      });
    }, this.config.poll_interval_ms);

    // Run immediately
    this.sweep().catch(error => {
      logger.error('Initial sweep error', { error: String(error) });
    });
  }

  /**
   * Stop the sweeper
   */
  stop(): void {
    this.isRunning = false;
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    logger.info('Sweeper stopped');
  }

  /**
   * Main sweep function
   */
  async sweep(): Promise<void> {
    if (!this.isRunning) return;

    try {
      // Process each chain
      for (const chainCode of Object.keys(CHAIN_CONFIGS)) {
        await this.sweepChain(chainCode);
      }
    } catch (error) {
      logger.error('Sweep error', { error: String(error) });
    }
  }

  /**
   * Sweep a specific chain
   */
  async sweepChain(chain_code: string): Promise<void> {
    const chainConfig = CHAIN_CONFIGS[chain_code];
    if (!chainConfig?.is_evm) return;

    // Get warm wallet for this chain
    const warmWallet = await this.getWarmWallet(chain_code);
    if (!warmWallet) {
      logger.warn(`No warm wallet configured for ${chain_code}`);
      return;
    }

    // Get active deposit addresses
    const addresses = await this.hdWallet.getAllActiveDepositAddresses(chain_code);
    if (addresses.length === 0) return;

    // Check balances in batches
    const batches = this.chunk(addresses, this.config.batch_size);

    for (const batch of batches) {
      await this.processAddressBatch(batch, chainConfig, warmWallet);
    }

    // Process confirmed deposits that need sweeping
    await this.processPendingSweeps(chain_code, warmWallet);
  }

  /**
   * Process a batch of deposit addresses
   */
  private async processAddressBatch(
    addresses: DepositAddress[],
    chainConfig: ChainConfig,
    warmWallet: WarmWallet
  ): Promise<void> {
    const provider = this.getProvider(chainConfig.chain_code);
    const supportedTokens = await this.getSupportedTokens(chainConfig.chain_code);

    for (const depositAddress of addresses) {
      try {
        // Check native token balance
        const nativeBalance = await provider.getBalance(depositAddress.address);

        if (nativeBalance > 0n) {
          await this.recordDeposit({
            user_id: depositAddress.user_id,
            deposit_address_id: depositAddress.id,
            chain_code: chainConfig.chain_code,
            token_address: null,
            token_symbol: chainConfig.native_symbol,
            amount: nativeBalance.toString(),
            address: depositAddress.address,
          });
        }

        // Check ERC-20 token balances
        for (const token of supportedTokens.filter(t => !t.is_native && t.token_address)) {
          try {
            const contract = new Contract(token.token_address!, ERC20_ABI, provider);
            const balance = await contract.balanceOf(depositAddress.address);

            if (balance > 0n) {
              await this.recordDeposit({
                user_id: depositAddress.user_id,
                deposit_address_id: depositAddress.id,
                chain_code: chainConfig.chain_code,
                token_address: token.token_address,
                token_symbol: token.token_symbol,
                amount: balance.toString(),
                address: depositAddress.address,
              });
            }
          } catch (error) {
            logger.error(`Error checking ${token.token_symbol} balance`, { token_symbol: token.token_symbol, error: String(error) });
          }
        }
      } catch (error) {
        logger.error('Error processing address', { error: String(error) });
      }
    }
  }

  /**
   * Record a detected deposit
   */
  private async recordDeposit(data: {
    user_id: string;
    deposit_address_id: string;
    chain_code: string;
    token_address: string | null;
    token_symbol: string;
    amount: string;
    address: string;
    /** Real on-chain transaction hash from blockchain event/webhook */
    tx_hash?: string;
  }): Promise<void> {
    const provider = this.getProvider(data.chain_code);
    const currentBlock = await provider.getBlockNumber();

    // Resolve chain_id UUID from chain_code
    const chain = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM networks WHERE code = $1`,
      [data.chain_code]
    );
    if (!chain) {
      logger.warn(`[Sweeper] Unknown chain code: ${data.chain_code}`);
      return;
    }

    // Resolve token_id UUID
    let tokenId: string | null = null;
    if (data.token_address) {
      const tokenInfo = await this.db.queryOne<{ asset_id: string }>(
        `SELECT tc.asset_id FROM asset_networks tc
         WHERE LOWER(tc.contract_address) = LOWER($1) AND tc.network_id = $2`,
        [data.token_address, chain.id]
      );
      tokenId = tokenInfo?.asset_id || null;
    } else {
      // Native token
      const nativeToken = await this.db.queryOne<{ asset_id: string }>(
        `SELECT tc.asset_id FROM asset_networks tc
         WHERE tc.network_id = $1 AND tc.is_native = true`,
        [chain.id]
      );
      tokenId = nativeToken?.asset_id || null;
    }

    if (!tokenId) {
      logger.warn(`[Sweeper] Could not resolve asset_id for ${data.token_symbol} on ${data.chain_code}`);
      return;
    }

    // Check if we already have this deposit recorded
    const existingDeposit = await this.db.queryOne<any>(
      `SELECT * FROM deposits
       WHERE deposit_address_id = $1
         AND asset_id = $2
         AND status IN ('pending', 'confirming')
         AND amount = $3`,
      [data.deposit_address_id, tokenId, data.amount]
    );

    if (existingDeposit) {
      // Update confirmations
      const confirmations = currentBlock - existingDeposit.block_number;
      const chainConfig = CHAIN_CONFIGS[data.chain_code];

      if (confirmations >= chainConfig.confirmations_required && existingDeposit.status !== 'confirmed') {
        await this.db.execute(
          `UPDATE deposits
           SET confirmations = $1, status = 'confirmed', confirmed_at = NOW()
           WHERE id = $2`,
          [confirmations, existingDeposit.id]
        );
      } else {
        await this.db.execute(
          'UPDATE deposits SET confirmations = $1 WHERE id = $2',
          [confirmations, existingDeposit.id]
        );
      }
      return;
    }

    // Use real on-chain tx_hash when available (e.g. from webhook), otherwise generate a synthetic one.
    // Synthetic tx_hash should only be used as a last resort - deposits without real tx_hash
    // cannot be independently verified against the blockchain.
    let txHash: string;
    if (data.tx_hash) {
      txHash = data.tx_hash;
    } else {
      console.warn(
        `[Sweeper] WARNING: No real tx_hash provided for deposit from ${data.address} ` +
        `(${data.amount} ${data.token_symbol} on ${data.chain_code}). Using synthetic hash. ` +
        `This deposit CANNOT be verified against the blockchain.`
      );
      txHash = `0x${Buffer.from(`${data.address}-${data.token_symbol}-${data.amount}-${currentBlock}`).toString('hex').slice(0, 64)}`;
    }

    // Create new deposit record using UUID columns
    await this.db.execute(
      `INSERT INTO deposits
       (user_id, deposit_address_id, network_id, asset_id, amount,
        tx_hash, block_number, confirmations, status, detected_at, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'pending', NOW(), NOW())
       ON CONFLICT (tx_hash, network_id) DO NOTHING`,
      [
        data.user_id,
        data.deposit_address_id,
        chain.id,
        tokenId,
        data.amount,
        txHash,
        currentBlock,
      ]
    );
  }

  /**
   * Process deposits that are confirmed and ready for sweeping
   */
  private async processPendingSweeps(chain_code: string, warmWallet: WarmWallet): Promise<void> {
    // Get confirmed deposits not yet swept, using chain UUID via JOIN
    const deposits = await this.db.query<any>(
      `SELECT d.*, da.derivation_path, da.address,
              c.code as chain_code, t.symbol as token_symbol,
              tc.contract_address as token_address, tc.decimals
       FROM deposits d
       JOIN deposit_addresses da ON d.deposit_address_id = da.id
       JOIN networks c ON d.network_id = c.id
       JOIN assets t ON d.asset_id = t.id
       LEFT JOIN asset_networks tc ON tc.asset_id = d.asset_id AND tc.network_id = d.network_id
       WHERE c.code = $1
         AND d.status = 'confirmed'
       ORDER BY d.confirmed_at
       LIMIT 10`,
      [chain_code]
    );

    for (const deposit of deposits) {
      try {
        await this.sweepDeposit(deposit, warmWallet);
      } catch (error) {
        logger.error('Failed to sweep deposit', { deposit_id: deposit.id, error: String(error) });

        // Update deposit with error
        await this.db.execute(
          `UPDATE deposits SET status = 'failed', updated_at = NOW() WHERE id = $1`,
          [deposit.id]
        );
      }
    }
  }

  /**
   * Sweep a single deposit to warm wallet
   */
  private async sweepDeposit(
    deposit: any,
    warmWallet: WarmWallet
  ): Promise<void> {
    const provider = this.getProvider(deposit.chain_code);
    const chainConfig = CHAIN_CONFIGS[deposit.chain_code];

    // Get gas price
    const feeData = await provider.getFeeData();
    const gasPrice = feeData.gasPrice || parseUnits(String(this.config.max_gas_price_gwei), 'gwei');

    // Check if gas price is acceptable
    if (gasPrice > parseUnits(String(this.config.max_gas_price_gwei), 'gwei')) {
      logger.debug(`Gas price too high for ${deposit.chain_code}, skipping sweep`);
      return;
    }

    // Create sweep transaction using network_id and asset_id UUIDs
    const sweepTx = await this.db.queryOne<SweepTransaction>(
      `INSERT INTO sweep_operations
       (deposit_id, from_address, to_address, network_id, asset_id, amount, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending')
       RETURNING *`,
      [
        deposit.id,
        deposit.address,
        warmWallet.address,
        deposit.network_id,
        deposit.asset_id,
        deposit.amount,
      ]
    );

    if (!sweepTx) {
      throw new CustodialWalletError('Failed to create sweep transaction');
    }

    // Get private key for signing
    const privateKey = await this.hdWallet.derivePrivateKey(deposit.derivation_path);

    try {
      const wallet = new Wallet(privateKey, provider);

      let txHash: string;

      if (deposit.token_address) {
        // ERC-20 token transfer
        const contract = new Contract(deposit.token_address, ERC20_ABI, wallet);
        const tx = await contract.transfer(warmWallet.address, deposit.amount);
        txHash = tx.hash;
        await tx.wait();
      } else {
        // Native token transfer
        const balance = await provider.getBalance(deposit.address);
        const gasLimit = 21000n;
        const gasCost = gasPrice * gasLimit;
        const amountToSend = balance - gasCost;

        if (amountToSend <= 0n) {
          throw new CustodialWalletError('Insufficient balance after gas');
        }

        const tx = await wallet.sendTransaction({
          to: warmWallet.address,
          value: amountToSend,
          gasLimit,
          gasPrice,
        });
        txHash = tx.hash;
        await tx.wait();
      }

      // Update sweep transaction
      await this.db.execute(
        `UPDATE sweep_operations
         SET tx_hash = $1, status = 'completed', completed_at = NOW(), gas_price = $2
         WHERE id = $3`,
        [txHash, gasPrice.toString(), sweepTx.id]
      );

      // Update deposit
      await this.db.execute(
        `UPDATE deposits
         SET status = 'swept', sweep_operation_id = $1, swept_at = NOW()
         WHERE id = $2`,
        [sweepTx.id, deposit.id]
      );

      // Credit user balance
      await this.creditUserBalance(deposit);

      logger.info(`Swept ${deposit.token_symbol} to warm wallet`, {
        tx_hash: txHash,
        token_symbol: deposit.token_symbol,
      });

    } catch (error) {
      // Update sweep transaction with error
      await this.db.execute(
        `UPDATE sweep_operations
         SET status = 'failed', failure_reason = $1, retry_count = retry_count + 1
         WHERE id = $2`,
        [(error as Error).message, sweepTx.id]
      );
      throw error;
    } finally {
      // Wipe private key from memory after use
      privateKey.replace(/./g, '\0');
    }
  }

  /**
   * Credit user balance after successful sweep (or after confirmation)
   */
  private async creditUserBalance(deposit: any): Promise<void> {
    // The deposit.amount is already in decimal format (e.g., "1000.000000000000000000")
    const formattedAmount = deposit.amount;

    // Check if already credited (idempotency guard — prevents double-credit
    // when both the confirmation checker and sweeper process the same deposit)
    const alreadyCredited = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM balance_transactions
       WHERE tx_type = 'deposit' AND metadata->>'deposit_id' = $1`,
      [deposit.id]
    );

    if (alreadyCredited) {
      logger.debug(`[Sweeper] Deposit ${deposit.id} already credited, skipping`);
      return;
    }

    // Get current balance
    const currentBalance = await this.db.queryOne<{ available: string }>(
      `SELECT available FROM user_balances
       WHERE user_id = $1 AND asset_id = $2`,
      [deposit.user_id, deposit.asset_id]
    );

    const balanceBefore = currentBalance?.available || '0';

    // Upsert balance using (user_id, asset_id) unique constraint
    await this.db.execute(
      `INSERT INTO user_balances
       (user_id, asset_id, available, total_deposited)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (user_id, asset_id)
       DO UPDATE SET
         available = user_balances.available + $3,
         total_deposited = user_balances.total_deposited + $3,
         last_updated_at = NOW()`,
      [deposit.user_id, deposit.asset_id, formattedAmount]
    );

    // Get new balance for audit
    const newBalance = await this.db.queryOne<{ available: string }>(
      `SELECT available FROM user_balances
       WHERE user_id = $1 AND asset_id = $2`,
      [deposit.user_id, deposit.asset_id]
    );

    // Create balance transaction record
    await this.db.execute(
      `INSERT INTO balance_transactions
       (user_id, asset_id, tx_type, amount, balance_before, balance_after, description, metadata)
       VALUES ($1, $2, 'deposit', $3, $4, $5, $6, $7)`,
      [
        deposit.user_id,
        deposit.asset_id,
        formattedAmount,
        balanceBefore,
        newBalance?.available || formattedAmount,
        `Deposit sweep for deposit ${deposit.id}`,
        JSON.stringify({ reference_type: 'deposit', reference_id: deposit.id }),
      ]
    );

    logger.info(`[Sweeper] Credited to user`, {
      token_symbol: deposit.token_symbol,
      user_id: deposit.user_id,
      deposit_id: deposit.id,
    });
  }

  /**
   * Get warm wallet for chain
   */
  private async getWarmWallet(chain_code: string): Promise<WarmWallet | null> {
    // Look up chain UUID first, then query warm_wallets by chain_id
    return this.db.queryOne<WarmWallet>(
      `SELECT w.* FROM warm_wallets w
       JOIN networks c ON w.network_id = c.id
       WHERE c.code = $1 AND w.is_active = TRUE`,
      [chain_code]
    );
  }

  /**
   * Get supported tokens for chain (from asset_networks + assets tables)
   */
  private async getSupportedTokens(chain_code: string): Promise<Array<{
    token_id: string;
    token_symbol: string;
    token_name: string;
    token_address: string | null;
    decimals: number;
    is_native: boolean;
    is_active: boolean;
  }>> {
    return this.db.query(
      `SELECT tc.asset_id as token_id, t.symbol as token_symbol, t.name as token_name,
              tc.contract_address as token_address, tc.decimals, tc.is_native, tc.is_active
       FROM asset_networks tc
       JOIN assets t ON t.id = tc.asset_id
       JOIN networks c ON tc.network_id = c.id
       WHERE c.code = $1 AND tc.is_active = TRUE AND tc.deposit_enabled = TRUE`,
      [chain_code]
    );
  }

  /**
   * Chunk array into batches
   */
  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }

  /**
   * Manual sweep trigger for admin
   */
  async manualSweep(chain_code?: string): Promise<{ swept: number; errors: number }> {
    let swept = 0;
    let errors = 0;

    const chains = chain_code ? [chain_code] : Object.keys(CHAIN_CONFIGS);

    for (const code of chains) {
      try {
        await this.sweepChain(code);
        swept++;
      } catch (error) {
        logger.error(`Manual sweep error for ${code}`, { error: String(error) });
        errors++;
      }
    }

    return { swept, errors };
  }

  /**
   * Get sweeper status
   */
  async getStatus(): Promise<{
    running: boolean;
    pending_deposits: number;
    confirmed_deposits: number;
    pending_sweeps: number;
  }> {
    const stats = await this.db.queryOne<{
      pending: string;
      confirmed: string;
      sweep_pending: string;
    }>(
      `SELECT
         COUNT(*) FILTER (WHERE status = 'pending') as pending,
         COUNT(*) FILTER (WHERE status = 'confirmed') as confirmed,
         (SELECT COUNT(*) FROM sweep_operations WHERE status = 'pending') as sweep_pending
       FROM deposits`
    );

    return {
      running: this.isRunning,
      pending_deposits: parseInt(stats?.pending || '0', 10),
      confirmed_deposits: parseInt(stats?.confirmed || '0', 10),
      pending_sweeps: parseInt(stats?.sweep_pending || '0', 10),
    };
  }
}

/**
 * Create Sweeper Service
 */
export function createSweeperService(
  db: DatabaseService,
  hdWallet: HDWalletService,
  config?: Partial<SweeperConfig>
): SweeperService {
  return new SweeperService(db, hdWallet, config);
}
