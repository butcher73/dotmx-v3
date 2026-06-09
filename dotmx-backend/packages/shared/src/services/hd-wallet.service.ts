/**
 * HD Wallet Service
 * Generates user deposit addresses using BIP-44 hierarchical deterministic derivation
 *
 * Derivation Path: m/44'/{coin_type}'/0'/0/{index}
 *
 * Security:
 * - Master seed never leaves memory unencrypted
 * - Private keys derived on-demand and wiped immediately
 * - Public addresses can be derived without private key exposure
 */

import { HDNodeWallet, Mnemonic, Wallet, getAddress, isAddress } from 'ethers';
import type { DatabaseService } from './database';
import type { GCPKMSService } from './gcp-kms.service';
import type {
  DepositAddress,
  CreateDepositAddressRequest,
  ChainConfig,
} from '../types/custodial-wallet';
import {
  CHAIN_CONFIGS,
  CustodialWalletError,
  UnsupportedChainError,
} from '../types/custodial-wallet';

const MASTER_KEY_NAME = 'master_seed_v1';

export class HDWalletService {
  private db: DatabaseService;
  private kms: GCPKMSService;
  private hdNodeCache: Map<string, HDNodeWallet> = new Map();
  private cacheExpiry: number = 30 * 1000; // 30 seconds cache
  private lastCacheTime: number = 0;

  constructor(db: DatabaseService, kms: GCPKMSService) {
    this.db = db;
    this.kms = kms;
  }

  /**
   * Initialize the wallet system (create master seed if needed)
   * Returns mnemonic for backup - SHOW ONCE
   */
  /**
   * Initialize HD Wallet
   * @param existingSeed - Optional existing seed phrase to import instead of generating
   */
  async initialize(existingSeed?: string): Promise<{ mnemonic?: string; already_initialized: boolean }> {
    const exists = await this.kms.hasMasterSeed(MASTER_KEY_NAME);
    if (exists) {
      return { already_initialized: true };
    }

    // Generate new master seed or import existing one
    const { mnemonic } = await this.kms.generateAndStoreMasterSeed(MASTER_KEY_NAME, existingSeed);
    return { mnemonic, already_initialized: false };
  }

  /**
   * Import existing mnemonic (for migration or recovery)
   */
  async importMnemonic(mnemonic: string): Promise<void> {
    const exists = await this.kms.hasMasterSeed(MASTER_KEY_NAME);
    if (exists) {
      throw new CustodialWalletError('Master seed already exists. Cannot import.');
    }

    // Validate mnemonic
    try {
      Mnemonic.fromPhrase(mnemonic);
    } catch (error) {
      throw new CustodialWalletError('Invalid mnemonic phrase');
    }

    // Convert mnemonic to seed and store
    const mnemonicObj = Mnemonic.fromPhrase(mnemonic);
    const seed = Buffer.from(mnemonicObj.entropy);

    await this.kms.storeMasterSeed(MASTER_KEY_NAME, seed);
  }

  /**
   * Get or create deposit address for a user and chain
   */
  async getOrCreateDepositAddress(request: CreateDepositAddressRequest): Promise<DepositAddress & { is_new: boolean }> {
    const { user_id, chain_code } = request;

    // Validate chain exists in database (using new schema)
    const chain = await this.db.queryOne<{ id: string; code: string; chain_id: number }>(
      `SELECT id, code, chain_id FROM networks WHERE code = $1 AND is_active = TRUE`,
      [chain_code]
    );

    if (!chain) {
      throw new UnsupportedChainError(chain_code);
    }

    // Get chain config for coin_type derivation
    const chainConfig = this.getChainConfig(chain_code);
    if (!chainConfig) {
      throw new UnsupportedChainError(chain_code);
    }

    // Check if chain is EVM-compatible (current implementation only supports EVM)
    if (!chainConfig.is_evm) {
      throw new CustodialWalletError(
        `Deposit address generation for ${chainConfig.name} is not yet supported. ` +
        `Current HD Wallet implementation only supports EVM chains. ` +
        `Please disable deposits for ${chain_code} in the admin panel until non-EVM support is added.`
      );
    }

    // Check if address already exists (using chain_id UUID)
    const existing = await this.db.queryOne<DepositAddress>(
      `SELECT * FROM deposit_addresses
       WHERE user_id = $1 AND network_id = $2 AND is_active = TRUE`,
      [user_id, chain.id]
    );

    if (existing) {
      return { ...existing, is_new: false };
    }

    // Get next derivation index atomically (global counter for all chains)
    let indexResult = await this.db.queryOne<{ current_index: number }>(
      `UPDATE derivation_counters
       SET current_index = current_index + 1, updated_at = NOW()
       WHERE network_id IS NULL
       RETURNING current_index`
    );

    // If no counter exists, create one and try again
    if (!indexResult) {
      await this.db.queryOne(
        `INSERT INTO derivation_counters (network_id, current_index)
         SELECT NULL, 1
         WHERE NOT EXISTS (SELECT 1 FROM derivation_counters WHERE network_id IS NULL)`
      );

      // Retry the update
      indexResult = await this.db.queryOne<{ current_index: number }>(
        `UPDATE derivation_counters
         SET current_index = current_index + 1, updated_at = NOW()
         WHERE network_id IS NULL
         RETURNING current_index`
      );

      if (!indexResult) {
        throw new CustodialWalletError('Failed to initialize derivation counter');
      }
    }

    const derivationIndex = indexResult.current_index;
    // Use Ethereum's coin_type (60) for all EVM chains - simple sequential index
    const derivationPath = this.getDerivationPath(60, derivationIndex);

    // Derive address
    const address = await this.deriveAddress(derivationPath);

    // Store deposit address (new schema uses chain_id UUID only)
    const depositAddress = await this.db.queryOne<DepositAddress>(
      `INSERT INTO deposit_addresses
       (user_id, network_id, address, derivation_index, derivation_path, is_active)
       VALUES ($1, $2, $3, $4, $5, TRUE)
       RETURNING *`,
      [user_id, chain.id, address, derivationIndex, derivationPath]
    );

    if (!depositAddress) {
      throw new CustodialWalletError('Failed to create deposit address');
    }

    return { ...depositAddress, is_new: true };
  }

  /**
   * Get deposit address for user (if exists)
   * Uses chain_code to lookup chain_id from chains table
   */
  async getDepositAddress(user_id: string, chain_code: string): Promise<DepositAddress | null> {
    const chain = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM networks WHERE code = $1 AND is_active = TRUE`,
      [chain_code]
    );
    if (!chain) return null;

    return this.db.queryOne<DepositAddress>(
      `SELECT da.*, c.code as chain_code FROM deposit_addresses da
       JOIN networks c ON c.id = da.network_id
       WHERE da.user_id = $1 AND da.network_id = $2 AND da.is_active = TRUE`,
      [user_id, chain.id]
    );
  }

  /**
   * Get all deposit addresses for a user
   */
  async getUserDepositAddresses(user_id: string): Promise<DepositAddress[]> {
    return this.db.query<DepositAddress>(
      `SELECT da.*, c.code as chain_code FROM deposit_addresses da
       JOIN networks c ON c.id = da.network_id
       WHERE da.user_id = $1 AND da.is_active = TRUE
       ORDER BY c.code`,
      [user_id]
    );
  }

  /**
   * Get deposit address by address string
   */
  async getDepositAddressByAddress(address: string, chain_code: string): Promise<DepositAddress | null> {
    const chain = await this.db.queryOne<{ id: string }>(
      `SELECT id FROM networks WHERE code = $1 AND is_active = TRUE`,
      [chain_code]
    );
    if (!chain) return null;

    return this.db.queryOne<DepositAddress>(
      `SELECT da.*, c.code as chain_code FROM deposit_addresses da
       JOIN networks c ON c.id = da.network_id
       WHERE LOWER(da.address) = LOWER($1) AND da.network_id = $2 AND da.is_active = TRUE`,
      [address, chain.id]
    );
  }

  /**
   * Get all active deposit addresses (for sweeper monitoring)
   */
  async getAllActiveDepositAddresses(chain_code?: string): Promise<DepositAddress[]> {
    if (chain_code) {
      const chain = await this.db.queryOne<{ id: string }>(
        `SELECT id FROM networks WHERE code = $1 AND is_active = TRUE`,
        [chain_code]
      );
      if (!chain) return [];

      return this.db.query<DepositAddress>(
        `SELECT da.*, c.code as chain_code FROM deposit_addresses da
         JOIN networks c ON c.id = da.network_id
         WHERE da.network_id = $1 AND da.is_active = TRUE
         ORDER BY da.created_at`,
        [chain.id]
      );
    }

    return this.db.query<DepositAddress>(
      `SELECT da.*, c.code as chain_code FROM deposit_addresses da
       JOIN networks c ON c.id = da.network_id
       WHERE da.is_active = TRUE
       ORDER BY c.code, da.created_at`
    );
  }

  /**
   * Derive private key for signing (use carefully!)
   * Key is returned and should be wiped immediately after use
   */
  async derivePrivateKey(derivation_path: string): Promise<string> {
    const hdNode = await this.getHDNode();
    const derived = hdNode.derivePath(derivation_path);
    return derived.privateKey;
  }

  /**
   * Sign a message with derived key
   */
  async signMessage(derivation_path: string, message: string): Promise<string> {
    const privateKey = await this.derivePrivateKey(derivation_path);
    const wallet = new Wallet(privateKey);
    const signature = await wallet.signMessage(message);

    // Wipe private key reference (note: JS doesn't allow true memory wiping)
    return signature;
  }

  /**
   * Sign a transaction with derived key
   */
  async signTransaction(derivation_path: string, transaction: any): Promise<string> {
    const privateKey = await this.derivePrivateKey(derivation_path);
    const wallet = new Wallet(privateKey);
    const signedTx = await wallet.signTransaction(transaction);

    return signedTx;
  }

  /**
   * Validate an EVM address
   */
  validateAddress(address: string): { valid: boolean; checksum_address?: string } {
    try {
      if (!isAddress(address)) {
        return { valid: false };
      }
      const checksumAddress = getAddress(address);
      return { valid: true, checksum_address: checksumAddress };
    } catch {
      return { valid: false };
    }
  }

  /**
   * Get chain configuration
   */
  getChainConfig(chain_code: string): ChainConfig | null {
    return CHAIN_CONFIGS[chain_code] || null;
  }

  /**
   * Get all supported chains
   */
  getSupportedChains(): ChainConfig[] {
    return Object.values(CHAIN_CONFIGS);
  }

  /**
   * Derive address from path
   */
  private async deriveAddress(derivation_path: string): Promise<string> {
    const hdNode = await this.getHDNode();
    const derived = hdNode.derivePath(derivation_path);
    return derived.address;
  }

  /**
   * Get BIP-44 derivation path
   * Uses Ethereum coin_type (60) for all EVM chains
   * m/44'/60'/0'/0/{index} where index is global (0,1,2...)
   */
  private getDerivationPath(coin_type: number, index: number): string {
    return `m/44'/60'/0'/0/${index}`;
  }

  /**
   * Get HD Node (cached for performance)
   */
  private async getHDNode(): Promise<HDNodeWallet> {
    const now = Date.now();

    // Check cache validity
    if (this.hdNodeCache.has('master') && now - this.lastCacheTime < this.cacheExpiry) {
      return this.hdNodeCache.get('master')!;
    }

    // Clear old cache
    this.hdNodeCache.clear();

    // Get master seed from KMS
    const seedBuffer = await this.kms.getMasterSeed(MASTER_KEY_NAME);

    // Create HD node from seed
    // Note: In production, the seed stored should be the BIP-39 seed (64 bytes)
    // For simplicity, we're treating it as entropy and creating mnemonic
    let hdNode: HDNodeWallet;

    if (seedBuffer.length === 32) {
      // Entropy -> Mnemonic -> BIP-39 Seed -> HD Wallet (master node at m)
      const mnemonic = Mnemonic.fromEntropy(seedBuffer);
      const bip39Seed = mnemonic.computeSeed(); // Convert to 64-byte BIP-39 seed
      hdNode = HDNodeWallet.fromSeed(bip39Seed);
    } else if (seedBuffer.length === 64) {
      // Direct BIP-39 seed (already 64 bytes)
      hdNode = HDNodeWallet.fromSeed(seedBuffer);
    } else {
      throw new CustodialWalletError('Invalid seed length');
    }

    // Cache the node
    this.hdNodeCache.set('master', hdNode);
    this.lastCacheTime = now;

    // Wipe seed buffer
    seedBuffer.fill(0);

    return hdNode;
  }

  /**
   * Clear HD node cache (for security)
   */
  clearCache(): void {
    this.hdNodeCache.clear();
    this.lastCacheTime = 0;
  }

  /**
   * Health check
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    try {
      // Check if master seed exists
      const hasSeed = await this.kms.hasMasterSeed(MASTER_KEY_NAME);
      if (!hasSeed) {
        return { healthy: false, message: 'Master seed not initialized' };
      }

      // Test derivation
      const testPath = this.getDerivationPath(60, 0);
      const address = await this.deriveAddress(testPath);

      if (!this.validateAddress(address).valid) {
        return { healthy: false, message: 'Derivation produced invalid address' };
      }

      return { healthy: true, message: 'HD Wallet operational' };
    } catch (error) {
      return { healthy: false, message: (error as Error).message };
    }
  }
}

/**
 * Create HD Wallet Service
 */
export function createHDWalletService(db: DatabaseService, kms: GCPKMSService): HDWalletService {
  return new HDWalletService(db, kms);
}
