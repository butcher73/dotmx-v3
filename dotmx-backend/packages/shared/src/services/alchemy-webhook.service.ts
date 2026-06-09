/**
 * Alchemy Webhook Service
 * 
 * Handles:
 * 1. Webhook signature verification
 * 2. Address registration with Alchemy API
 * 3. Processing deposit events from webhooks
 * 
 * @see https://docs.alchemy.com/reference/address-activity-webhook
 */

import { createHmac } from 'crypto';
import type { DatabaseService } from './database';
import type {
  AlchemyWebhookPayload,
  AlchemyActivity,
  AlchemyNetwork,
  AlchemyWebhookConfig,
  AlchemyCreateWebhookRequest,
} from '../types/alchemy';
import {
  ALCHEMY_NETWORK_TO_CHAIN_CODE,
  CHAIN_CODE_TO_ALCHEMY_NETWORK,
  NATIVE_SYMBOLS,
} from '../types/alchemy';

// =============================================================================
// CONFIGURATION
// =============================================================================

interface AlchemyServiceConfig {
  apiKey: string;
  baseUrl?: string;
}

/** Chain suffixes used for env var lookup: ALCHEMY_WEBHOOK_ID_{suffix} */
const CHAIN_CODE_TO_ENV_SUFFIX: Record<string, string> = {
  ETH: 'ETH',
  SEP: 'SEP',
  BNB: 'BNB',
  BSC: 'BNB',
  SOL: 'SOL',
  MATIC: 'MATIC',
  ARB: 'ARB',
  OP: 'OP',
  BASE: 'BASE',
};

const ALCHEMY_NOTIFY_API = 'https://dashboard.alchemy.com/api';

// =============================================================================
// SERVICE
// =============================================================================

export class AlchemyWebhookService {
  private db: DatabaseService;
  private apiKey: string;
  private baseUrl: string;
  private webhookIdByChain: Map<string, string> = new Map();
  private signingKeyByChain: Map<string, string> = new Map();

  constructor(db: DatabaseService, config?: Partial<AlchemyServiceConfig>) {
    this.db = db;
    this.apiKey = config?.apiKey || process.env.ALCHEMY_API_KEY || '';
    this.baseUrl = config?.baseUrl || ALCHEMY_NOTIFY_API;

    if (!this.apiKey) {
      console.warn('[AlchemyWebhook] No API key configured - address sync disabled');
    }

    // Load per-chain webhook IDs and signing keys from env
    for (const [chainCode, suffix] of Object.entries(CHAIN_CODE_TO_ENV_SUFFIX)) {
      const webhookId = process.env[`ALCHEMY_WEBHOOK_ID_${suffix}`];
      if (webhookId) {
        this.webhookIdByChain.set(chainCode, webhookId);
      }
      const signingKey = process.env[`ALCHEMY_WEBHOOK_SIGNING_KEY_${suffix}`];
      if (signingKey) {
        this.signingKeyByChain.set(chainCode, signingKey);
      }
    }

    console.log(`[AlchemyWebhook] Loaded ${this.webhookIdByChain.size} webhook IDs: ${[...this.webhookIdByChain.entries()].map(([k,v]) => `${k}=${v}`).join(', ')}`);
    console.log(`[AlchemyWebhook] Loaded ${this.signingKeyByChain.size} signing keys for chains: ${[...this.signingKeyByChain.keys()].join(', ')}`);
  }

  // ===========================================================================
  // WEBHOOK SIGNATURE VERIFICATION
  // ===========================================================================

  /**
   * Verify Alchemy webhook signature
   * Uses per-chain signing key based on the network in the payload
   * @see https://docs.alchemy.com/reference/notify-api-faq#how-do-i-verify-the-authenticity-of-a-webhook-request
   */
  verifySignature(rawBody: string | Buffer, signature: string, chainCode?: string): boolean {
    // Find the signing key for this chain
    let signingKey: string | undefined;
    if (chainCode) {
      signingKey = this.signingKeyByChain.get(chainCode);
    }

    if (!signingKey) {
      // Try all signing keys
      const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
      for (const [chain, key] of this.signingKeyByChain) {
        try {
          const hmac = createHmac('sha256', key);
          const expected = hmac.update(body).digest('hex');
          if (signature === expected) {
            return true;
          }
        } catch {}
      }
      console.warn('[AlchemyWebhook] No signing key matched for signature verification');
      return this.signingKeyByChain.size === 0; // Allow if no keys configured (dev mode)
    }

    try {
      const body = typeof rawBody === 'string' ? rawBody : rawBody.toString('utf-8');
      const hmac = createHmac('sha256', signingKey);
      const expectedSignature = hmac.update(body).digest('hex');
      
      return signature === expectedSignature;
    } catch (error) {
      console.error('[AlchemyWebhook] Signature verification failed:', error);
      return false;
    }
  }

  // ===========================================================================
  // WEBHOOK EVENT PROCESSING
  // ===========================================================================

  /**
   * Process incoming webhook payload
   * Returns the number of deposits recorded
   */
  async processWebhookPayload(payload: AlchemyWebhookPayload): Promise<{
    processed: number;
    ignored: number;
    errors: number;
  }> {
    const stats = { processed: 0, ignored: 0, errors: 0 };

    if (payload.type !== 'ADDRESS_ACTIVITY') {
      console.log(`[AlchemyWebhook] Ignoring event type: ${payload.type}`);
      return stats;
    }

    const chainCode = ALCHEMY_NETWORK_TO_CHAIN_CODE[payload.event.network];
    if (!chainCode) {
      console.warn(`[AlchemyWebhook] Unknown network: ${payload.event.network}`);
      return stats;
    }

    for (const activity of payload.event.activity) {
      try {
        const result = await this.processActivity(activity, chainCode);
        if (result === 'processed') {
          stats.processed++;
        } else {
          stats.ignored++;
        }
      } catch (error) {
        console.error('[AlchemyWebhook] Error processing activity:', error);
        stats.errors++;
      }
    }

    console.log(
      `[AlchemyWebhook] Processed webhook ${payload.id}: ` +
      `${stats.processed} deposits, ${stats.ignored} ignored, ${stats.errors} errors`
    );

    return stats;
  }

  /**
   * Process a single activity (transaction)
   */
  private async processActivity(
    activity: AlchemyActivity,
    chainCode: string
  ): Promise<'processed' | 'ignored'> {
    console.log(`[AlchemyWebhook] processActivity: hash=${activity.hash}, category=${activity.category}, from=${activity.fromAddress}, to=${activity.toAddress}, asset=${activity.asset}, rawContract=${JSON.stringify(activity.rawContract)}`);

    // Only process incoming transfers
    if (!activity.toAddress) {
      console.log(`[AlchemyWebhook] IGNORED: no toAddress`);
      return 'ignored';
    }

    // Only process external (native), erc20, and token transfers
    if (!['external', 'erc20', 'token'].includes(activity.category)) {
      console.log(`[AlchemyWebhook] IGNORED: category '${activity.category}' not in [external, erc20, token]`);
      return 'ignored';
    }

    // Look up chain UUID from chain code
    const chain = await this.db.queryOne<{
      id: string;
      min_confirmations: number;
      native_symbol: string;
    }>(
      `SELECT id, min_confirmations, native_symbol 
       FROM networks 
       WHERE code = $1 AND is_active = true`,
      [chainCode]
    );

    if (!chain) {
      console.warn(`[AlchemyWebhook] Unknown chain code: ${chainCode}`);
      return 'ignored';
    }

    // Check if destination is our deposit address
    const depositAddress = await this.db.queryOne<{
      id: string;
      user_id: string;
      network_id: string;
    }>(
      `SELECT id, user_id, network_id 
       FROM deposit_addresses 
       WHERE LOWER(address) = LOWER($1) 
         AND network_id = $2
         AND is_active = true`,
      [activity.toAddress, chain.id]
    );

    if (!depositAddress) {
      console.log(`[AlchemyWebhook] IGNORED: address ${activity.toAddress} not found in deposit_addresses for chain_id=${chain.id} (${chainCode})`);
      return 'ignored';
    }

    // Determine token info
    const isNativeToken = activity.category === 'external';
    const tokenContractAddress = isNativeToken ? null : activity.rawContract?.address;

    // Look up the token in our system
    let tokenId: string | null = null;
    let tokenSymbol: string;
    let tokenDecimals: number;

    if (isNativeToken) {
      // Native token (ETH, BNB, SOL, etc.)
      tokenSymbol = chain.native_symbol;
      tokenDecimals = 18; // Default for EVM native tokens

      // Find native token in token_chains
      const nativeToken = await this.db.queryOne<{
        asset_id: string;
        decimals: number;
      }>(
        `SELECT tc.asset_id, tc.decimals
         FROM asset_networks tc
         JOIN assets t ON t.id = tc.asset_id
         WHERE tc.network_id = $1 
           AND tc.is_native = true
           AND tc.deposit_enabled = true
           AND tc.is_active = true`,
        [chain.id]
      );

      if (nativeToken) {
        tokenId = nativeToken.asset_id;
        tokenDecimals = nativeToken.decimals;
      } else {
        console.log(`[AlchemyWebhook] No native token configured for chain ${chainCode}`);
        return 'ignored';
      }
    } else {
      // ERC-20 token — look up by contract address
      if (!tokenContractAddress) {
        console.log(`[AlchemyWebhook] ERC-20 activity missing contract address`);
        return 'ignored';
      }

      const tokenInfo = await this.db.queryOne<{
        asset_id: string;
        symbol: string;
        decimals: number;
      }>(
        `SELECT tc.asset_id, t.symbol, tc.decimals
         FROM asset_networks tc
         JOIN assets t ON t.id = tc.asset_id
         WHERE LOWER(tc.contract_address) = LOWER($1) 
           AND tc.network_id = $2
           AND tc.deposit_enabled = true
           AND tc.is_active = true`,
        [tokenContractAddress, chain.id]
      );

      if (!tokenInfo) {
        console.log(`[AlchemyWebhook] Unsupported token: ${tokenContractAddress} on ${chainCode}`);
        return 'ignored';
      }

      tokenId = tokenInfo.asset_id;
      tokenSymbol = tokenInfo.symbol;
      tokenDecimals = tokenInfo.decimals;
    }

    if (!tokenId) {
      console.log(`[AlchemyWebhook] Could not resolve token_id for activity on ${chainCode}`);
      return 'ignored';
    }

    // Parse block number from hex
    const blockNumber = parseInt(activity.blockNum, 16);

    // Get amount - convert from raw (smallest unit) to decimal using token decimals
    const rawValue = activity.rawContract?.rawValue;
    if (!rawValue || rawValue === '0x0' || rawValue === '0') {
      console.log(`[AlchemyWebhook] IGNORED: zero or missing rawValue: ${rawValue}`);
      return 'ignored';
    }
    const rawBigInt = BigInt(rawValue);
    if (rawBigInt === BigInt(0)) {
      console.log(`[AlchemyWebhook] IGNORED: rawBigInt is zero`);
      return 'ignored';
    }

    // Convert from smallest unit to human-readable decimal
    // e.g., 1000000000000000000 wei → 1.000000000000000000 ETH
    const divisor = BigInt(10 ** tokenDecimals);
    const wholePart = rawBigInt / divisor;
    const fractionalPart = rawBigInt % divisor;
    const fractionalStr = fractionalPart.toString().padStart(tokenDecimals, '0');
    const amount = `${wholePart}.${fractionalStr}`;

    // Insert or update deposit
    await this.db.execute(
      `INSERT INTO deposits (
        user_id,
        deposit_address_id,
        network_id,
        asset_id,
        amount, 
        tx_hash,
        block_number, 
        confirmations,
        status, 
        detected_at,
        created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, 0, 'pending', NOW(), NOW())
      ON CONFLICT (tx_hash, network_id) 
      DO UPDATE SET 
        confirmations = EXCLUDED.confirmations`,
      [
        depositAddress.user_id,
        depositAddress.id,
        chain.id,
        tokenId,
        amount,
        activity.hash,
        blockNumber,
      ]
    );

    console.log(
      `[AlchemyWebhook] Recorded deposit: ${activity.hash} - ` +
      `${amount} ${tokenSymbol} to ${activity.toAddress} on ${chainCode}`
    );

    return 'processed';
  }

  // ===========================================================================
  // ALCHEMY API - ADDRESS MANAGEMENT
  // ===========================================================================

  /**
   * Add addresses to Alchemy webhook
   * Call this when a new deposit address is created
   */
  async addAddresses(chainCode: string, addresses: string[]): Promise<boolean> {
    if (!this.apiKey) {
      console.warn('[AlchemyWebhook] No API key - cannot add addresses');
      return false;
    }

    console.log(`[AlchemyWebhook] addAddresses called for chain=${chainCode}, addresses=${addresses.join(',')}`);

    const webhookId = await this.getOrCreateWebhookForChain(chainCode);
    if (!webhookId) {
      console.error(`[AlchemyWebhook] No webhook found/created for chain: ${chainCode}`);
      return false;
    }

    console.log(`[AlchemyWebhook] Using webhook ID: ${webhookId} for chain: ${chainCode}`);

    try {
      const requestBody = {
        webhook_id: webhookId,
        addresses_to_add: addresses,
        addresses_to_remove: [],
      };
      console.log(`[AlchemyWebhook] PATCH ${this.baseUrl}/update-webhook-addresses`, JSON.stringify(requestBody));

      const response = await fetch(
        `${this.baseUrl}/update-webhook-addresses`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Alchemy-Token': this.apiKey,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error(`[AlchemyWebhook] Failed to add addresses (${response.status}):`, error);
        return false;
      }

      console.log(`[AlchemyWebhook] ✅ Added ${addresses.length} addresses to ${chainCode} webhook (${webhookId})`);
      return true;
    } catch (error) {
      console.error('[AlchemyWebhook] Error adding addresses:', error);
      return false;
    }
  }

  /**
   * Remove addresses from Alchemy webhook
   * Call this when a deposit address is deactivated
   */
  async removeAddresses(chainCode: string, addresses: string[]): Promise<boolean> {
    if (!this.apiKey) {
      return false;
    }

    const webhookId = this.webhookIdByChain.get(chainCode);
    if (!webhookId) {
      return false;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/update-webhook-addresses`,
        {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'X-Alchemy-Token': this.apiKey,
          },
          body: JSON.stringify({
            webhook_id: webhookId,
            addresses_to_add: [],
            addresses_to_remove: addresses,
          }),
        }
      );

      if (!response.ok) {
        const error = await response.text();
        console.error('[AlchemyWebhook] Failed to remove addresses:', error);
        return false;
      }

      console.log(`[AlchemyWebhook] Removed ${addresses.length} addresses from ${chainCode} webhook`);
      return true;
    } catch (error) {
      console.error('[AlchemyWebhook] Error removing addresses:', error);
      return false;
    }
  }

  /**
   * Sync all active deposit addresses to Alchemy
   * Call this on startup to ensure addresses are registered
   */
  async syncAllAddresses(): Promise<{ synced: number; errors: number }> {
    const stats = { synced: 0, errors: 0 };

    if (!this.apiKey) {
      console.warn('[AlchemyWebhook] No API key - skipping address sync');
      return stats;
    }

    // Get all active deposit addresses grouped by chain
    const addresses = await this.db.query<{
      chain_code: string;
      address: string;
    }>(
      `SELECT c.code as chain_code, da.address 
       FROM deposit_addresses da
       JOIN networks c ON c.id = da.network_id
       WHERE da.is_active = true
       ORDER BY c.code`
    );

    // Group by chain
    const byChain = new Map<string, string[]>();
    for (const addr of addresses) {
      if (!byChain.has(addr.chain_code)) {
        byChain.set(addr.chain_code, []);
      }
      byChain.get(addr.chain_code)!.push(addr.address);
    }

    // Sync each chain
    for (const [chainCode, addrs] of byChain) {
      // Alchemy allows max 100 addresses per request
      const batches = this.chunk(addrs, 100);
      
      for (const batch of batches) {
        const success = await this.addAddresses(chainCode, batch);
        if (success) {
          stats.synced += batch.length;
        } else {
          stats.errors += batch.length;
        }
      }
    }

    console.log(`[AlchemyWebhook] Synced ${stats.synced} addresses, ${stats.errors} errors`);
    return stats;
  }

  // ===========================================================================
  // ALCHEMY API - WEBHOOK MANAGEMENT
  // ===========================================================================

  /**
   * Get or create webhook for a specific chain
   */
  private async getOrCreateWebhookForChain(chainCode: string): Promise<string | null> {
    // Check cache (pre-loaded from env vars in constructor)
    if (this.webhookIdByChain.has(chainCode)) {
      return this.webhookIdByChain.get(chainCode)!;
    }

    const network = CHAIN_CODE_TO_ALCHEMY_NETWORK[chainCode];
    if (!network) {
      console.warn(`[AlchemyWebhook] No Alchemy network for chain: ${chainCode}`);
      return null;
    }

    try {
      // List existing webhooks and find by network
      const listResponse = await fetch(
        `${this.baseUrl}/team-webhooks`,
        {
          headers: {
            'X-Alchemy-Token': this.apiKey,
          },
        }
      );

      if (!listResponse.ok) {
        throw new Error(`Failed to list webhooks: ${await listResponse.text()}`);
      }

      const { data: webhooks } = await listResponse.json() as { data: AlchemyWebhookConfig[] };
      
      // Find existing webhook for this network
      const existing = webhooks.find(
        w => w.network === network && w.webhook_type === 'ADDRESS_ACTIVITY' && w.is_active
      );

      if (existing) {
        this.webhookIdByChain.set(chainCode, existing.id);
        return existing.id;
      }

      // Create new webhook
      const webhookUrl = process.env.ALCHEMY_WEBHOOK_URL || 
        `${process.env.API_BASE_URL}/webhooks/alchemy/deposits`;

      const createResponse = await fetch(
        `${this.baseUrl}/create-webhook`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Alchemy-Token': this.apiKey,
          },
          body: JSON.stringify({
            network,
            webhook_type: 'ADDRESS_ACTIVITY',
            webhook_url: webhookUrl,
          } as AlchemyCreateWebhookRequest),
        }
      );

      if (!createResponse.ok) {
        throw new Error(`Failed to create webhook: ${await createResponse.text()}`);
      }

      const { data: newWebhook } = await createResponse.json() as { data: AlchemyWebhookConfig };
      this.webhookIdByChain.set(chainCode, newWebhook.id);
      
      console.log(`[AlchemyWebhook] Created webhook for ${chainCode}: ${newWebhook.id}`);
      return newWebhook.id;

    } catch (error) {
      console.error(`[AlchemyWebhook] Error getting/creating webhook for ${chainCode}:`, error);
      return null;
    }
  }

  /**
   * Get all registered webhooks
   */
  async listWebhooks(): Promise<AlchemyWebhookConfig[]> {
    if (!this.apiKey) {
      return [];
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/team-webhooks`,
        {
          headers: {
            'X-Alchemy-Token': this.apiKey,
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to list webhooks: ${await response.text()}`);
      }

      const { data } = await response.json() as { data: AlchemyWebhookConfig[] };
      return data;
    } catch (error) {
      console.error('[AlchemyWebhook] Error listing webhooks:', error);
      return [];
    }
  }

  // ===========================================================================
  // HELPERS
  // ===========================================================================

  private chunk<T>(array: T[], size: number): T[][] {
    const chunks: T[][] = [];
    for (let i = 0; i < array.length; i += size) {
      chunks.push(array.slice(i, i + size));
    }
    return chunks;
  }
}
