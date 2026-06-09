/**
 * GCP KMS Service
 * Envelope encryption for master seed protection
 * 
 * Security Model:
 * 1. Master seed encrypted with Data Encryption Key (DEK)
 * 2. DEK encrypted with KMS Key Encryption Key (KEK)
 * 3. Both encrypted values stored in database
 * 4. KMS never sees the actual seed data
 * 5. Mnemonic/private keys are NEVER stored - only encrypted entropy
 */

import { KeyManagementServiceClient } from '@google-cloud/kms';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { Mnemonic } from 'ethers';
import type { GCPKMSConfig, WalletMasterKey } from '../types/custodial-wallet';
import { KMSError } from '../types/custodial-wallet';
import type { DatabaseService } from './database';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;
const DEK_LENGTH = 32; // 256 bits

export class GCPKMSService {
  private client: KeyManagementServiceClient;
  private config: GCPKMSConfig;
  private keyResourceName: string;
  private db: DatabaseService;

  constructor(db: DatabaseService, config?: Partial<GCPKMSConfig>) {
    this.db = db;
    this.config = {
      project_id: config?.project_id || process.env.GCP_PROJECT_ID || '',
      location: config?.location || process.env.GCP_KMS_LOCATION || 'us-central1',
      key_ring: config?.key_ring || process.env.GCP_KMS_KEY_RING || 'dotmx-wallet-keys',
      key_name: config?.key_name || process.env.GCP_KMS_KEY_NAME || 'master-seed-kek',
    };

    this.keyResourceName = `projects/${this.config.project_id}/locations/${this.config.location}/keyRings/${this.config.key_ring}/cryptoKeys/${this.config.key_name}`;

    // Initialize KMS client
    // In production, this uses Application Default Credentials
    this.client = new KeyManagementServiceClient();
  }

  /**
   * Check if KMS is properly configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.project_id &&
      this.config.location &&
      this.config.key_ring &&
      this.config.key_name
    );
  }

  /**
   * Encrypt data using KMS (envelope encryption)
   */
  async encrypt(plaintext: Buffer): Promise<{ encrypted_dek: Buffer; encrypted_data: Buffer }> {
    if (!this.isConfigured()) {
      throw new KMSError('GCP KMS not configured');
    }

    try {
      // Generate a random DEK
      const dek = randomBytes(DEK_LENGTH);

      // Encrypt DEK with KMS KEK
      const [encryptResponse] = await this.client.encrypt({
        name: this.keyResourceName,
        plaintext: dek,
      });

      if (!encryptResponse.ciphertext) {
        throw new KMSError('KMS encryption returned empty ciphertext');
      }

      const encrypted_dek = Buffer.from(encryptResponse.ciphertext);

      // Encrypt data with DEK using AES-256-GCM
      const encrypted_data = this.encryptWithDEK(plaintext, dek);

      // Wipe DEK from memory
      dek.fill(0);

      return { encrypted_dek, encrypted_data };
    } catch (error) {
      if (error instanceof KMSError) throw error;
      throw new KMSError(`KMS encryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Decrypt data using KMS (envelope decryption)
   */
  async decrypt(encrypted_dek: Buffer, encrypted_data: Buffer): Promise<Buffer> {
    if (!this.isConfigured()) {
      throw new KMSError('GCP KMS not configured');
    }

    try {
      // Decrypt DEK with KMS KEK
      const [decryptResponse] = await this.client.decrypt({
        name: this.keyResourceName,
        ciphertext: encrypted_dek,
      });

      if (!decryptResponse.plaintext) {
        throw new KMSError('KMS decryption returned empty plaintext');
      }

      const dek = Buffer.from(decryptResponse.plaintext);

      // Decrypt data with DEK
      const plaintext = this.decryptWithDEK(encrypted_data, dek);

      // Wipe DEK from memory
      dek.fill(0);

      return plaintext;
    } catch (error) {
      if (error instanceof KMSError) throw error;
      throw new KMSError(`KMS decryption failed: ${(error as Error).message}`);
    }
  }

  /**
   * Encrypt data with DEK using AES-256-GCM
   */
  private encryptWithDEK(plaintext: Buffer, dek: Buffer): Buffer {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, dek, iv);
    
    const encrypted = Buffer.concat([
      cipher.update(plaintext),
      cipher.final(),
    ]);
    
    const authTag = cipher.getAuthTag();

    // Format: IV (12 bytes) + AuthTag (16 bytes) + Ciphertext
    return Buffer.concat([iv, authTag, encrypted]);
  }

  /**
   * Decrypt data with DEK using AES-256-GCM
   */
  private decryptWithDEK(encryptedData: Buffer, dek: Buffer): Buffer {
    // Extract IV, AuthTag, and Ciphertext
    const iv = encryptedData.subarray(0, IV_LENGTH);
    const authTag = encryptedData.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
    const ciphertext = encryptedData.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

    const decipher = createDecipheriv(ALGORITHM, dek, iv);
    decipher.setAuthTag(authTag);

    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
  }

  /**
   * Store encrypted master seed
   */
  async storeMasterSeed(key_name: string, seed: Buffer): Promise<void> {
    // Encrypt the seed
    const { encrypted_dek, encrypted_data } = await this.encrypt(seed);

    // Store in database
    await this.db.execute(
      `INSERT INTO wallet_master_keys 
       (key_name, encrypted_dek, encrypted_seed, kms_key_resource_name, algorithm, version, is_active)
       VALUES ($1, $2, $3, $4, $5, 1, TRUE)
       ON CONFLICT (key_name) 
       DO UPDATE SET 
         encrypted_dek = $2,
         encrypted_seed = $3,
         kms_key_resource_name = $4,
         rotated_at = NOW(),
         version = wallet_master_keys.version + 1`,
      [key_name, encrypted_dek, encrypted_data, this.keyResourceName, ALGORITHM]
    );

    // Wipe seed from memory
    seed.fill(0);
  }

  /**
   * Retrieve and decrypt master seed
   */
  async getMasterSeed(key_name: string): Promise<Buffer> {
    const masterKey = await this.db.queryOne<WalletMasterKey>(
      `SELECT encrypted_dek, encrypted_seed, kms_key_resource_name 
       FROM wallet_master_keys 
       WHERE key_name = $1 AND is_active = TRUE`,
      [key_name]
    );

    if (!masterKey) {
      throw new KMSError(`Master key not found: ${key_name}`);
    }

    // Verify KMS key matches
    if (masterKey.kms_key_resource_name !== this.keyResourceName) {
      throw new KMSError('KMS key mismatch - key may have been rotated');
    }

    return this.decrypt(
      Buffer.from(masterKey.encrypted_dek),
      Buffer.from(masterKey.encrypted_seed)
    );
  }

  /**
   * Check if master seed exists
   */
  async hasMasterSeed(key_name: string): Promise<boolean> {
    const result = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM wallet_master_keys WHERE key_name = $1 AND is_active = TRUE',
      [key_name]
    );
    return (result?.count || 0) > 0;
  }

  /**
   * Generate a new master seed (for initial setup only)
   * Returns the mnemonic for backup - SHOW ONCE AND NEVER STORE
   * Uses BIP-39 standard 24-word mnemonic (256 bits of entropy)
   */
  /**
   * Generate new master seed or import existing one
   * @param key_name - The key identifier
   * @param existingSeed - Optional existing seed phrase to import instead of generating
   */
  async generateAndStoreMasterSeed(key_name: string, existingSeed?: string): Promise<{ mnemonic: string }> {
    // Check if seed already exists
    const exists = await this.hasMasterSeed(key_name);
    if (exists) {
      throw new KMSError('Master seed already exists. Use rotate instead.');
    }

    let entropy: Buffer;
    let mnemonicPhrase: string;

    if (existingSeed) {
      // Import existing seed - validate and extract entropy
      try {
        const mnemonicObj = Mnemonic.fromPhrase(existingSeed);
        mnemonicPhrase = mnemonicObj.phrase; // Normalized
        entropy = Buffer.from(mnemonicObj.entropy.slice(2), 'hex'); // Remove '0x' prefix
      } catch (error) {
        throw new KMSError('Invalid BIP-39 mnemonic: ' + (error as Error).message);
      }
    } else {
      // Generate 256 bits of entropy for a 24-word mnemonic
      entropy = randomBytes(32);
      
      // Create BIP-39 mnemonic from entropy using ethers.js
      const mnemonicObj = Mnemonic.fromEntropy(entropy);
      mnemonicPhrase = mnemonicObj.phrase;
    }
    
    // Store the entropy (NOT the mnemonic phrase - entropy is sufficient to recreate it)
    // The entropy is encrypted with GCP KMS before storage
    await this.storeMasterSeed(key_name, entropy);

    // Wipe entropy from memory
    entropy.fill(0);

    // Return the mnemonic phrase for backup
    // CRITICAL: This is shown ONCE and must be backed up securely offline
    return { mnemonic: mnemonicPhrase };
  }

  /**
   * Rotate KMS key (re-encrypt with new KEK version)
   */
  async rotateKMSKey(key_name: string): Promise<void> {
    // Get current seed
    const seed = await this.getMasterSeed(key_name);

    // Re-encrypt with current (new) KMS key version
    await this.storeMasterSeed(key_name, seed);

    // Wipe seed
    seed.fill(0);
  }

  /**
   * Verify KMS connection and permissions
   */
  async healthCheck(): Promise<{ healthy: boolean; message: string }> {
    if (!this.isConfigured()) {
      return { healthy: false, message: 'KMS not configured' };
    }

    try {
      // Test encrypt/decrypt cycle
      const testData = Buffer.from('health-check-test');
      const { encrypted_dek, encrypted_data } = await this.encrypt(testData);
      const decrypted = await this.decrypt(encrypted_dek, encrypted_data);

      if (decrypted.toString() !== testData.toString()) {
        return { healthy: false, message: 'Encrypt/decrypt verification failed' };
      }

      return { healthy: true, message: 'KMS operational' };
    } catch (error) {
      return { healthy: false, message: (error as Error).message };
    }
  }

  /**
   * Get KMS key metadata
   */
  async getKeyInfo(): Promise<{ name: string; state: string; purpose: string } | null> {
    if (!this.isConfigured()) {
      return null;
    }

    try {
      const [key] = await this.client.getCryptoKey({ name: this.keyResourceName });
      return {
        name: key.name || '',
        state: String(key.primary?.state ?? 'UNKNOWN'),
        purpose: String(key.purpose ?? 'UNKNOWN'),
      };
    } catch (error) {
      console.error('Failed to get KMS key info:', error);
      return null;
    }
  }
}

/**
 * Create GCP KMS Service with database connection
 */
export function createGCPKMSService(db: DatabaseService, config?: Partial<GCPKMSConfig>): GCPKMSService {
  return new GCPKMSService(db, config);
}
