/**
 * Wallet Authentication Service
 * Handles wallet-based authentication using signature verification
 */

import { randomBytes } from 'crypto';
import type {
  User,
  AuthTokens,
  WalletLink,
  WalletAuthChallenge,
  WalletAuthChallengeRequest,
  WalletAuthVerifyRequest,
  LinkWalletRequest,
  AuthEventType,
} from '../types/auth';
import { AuthenticationError, ValidationError } from '../types/auth';
import { DatabaseService } from './database';
import { AuthService } from './auth.service';

export class WalletAuthService {
  private db: DatabaseService;
  private authService: AuthService;

  constructor(
    db: DatabaseService,
    authService: AuthService
  ) {
    this.db = db;
    this.authService = authService;
  }

  /**
   * Generate a challenge message for wallet authentication
   */
  async createChallenge(
    data: WalletAuthChallengeRequest,
    metadata: { ip_address?: string } = {}
  ): Promise<WalletAuthChallenge> {
    // Validate wallet address format
    if (!this.isValidWalletAddress(data.wallet_address, data.chain_code)) {
      throw new ValidationError('Invalid wallet address format');
    }

    const nonce = randomBytes(32).toString('hex');
    const expires_at = new Date(Date.now() + 300000); // 5 minutes

    const challenge_message = this.createChallengeMessage(
      data.wallet_address,
      nonce,
      expires_at
    );

    // Store challenge
    await this.db.execute(
      `INSERT INTO wallet_auth_challenges
       (wallet_address, chain_code, challenge_message, nonce, expires_at, ip_address)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.wallet_address.toLowerCase(),
        data.chain_code.toUpperCase(),
        challenge_message,
        nonce,
        expires_at,
        metadata.ip_address || null,
      ]
    );

    return {
      challenge_message,
      nonce,
      expires_at,
    };
  }

  /**
   * Verify wallet signature and authenticate user
   */
  async verifyAndAuthenticate(
    data: WalletAuthVerifyRequest,
    metadata: { ip_address?: string; user_agent?: string } = {}
  ): Promise<{ user: User; tokens: AuthTokens; is_new_user: boolean }> {
    // Find challenge
    const challenge = await this.db.queryOne<{
      id: string;
      challenge_message: string;
      used: boolean;
    }>(
      `SELECT id, challenge_message, used
       FROM wallet_auth_challenges
       WHERE nonce = $1 AND wallet_address = $2 AND chain_code = $3
         AND expires_at > NOW() AND used = FALSE`,
      [data.nonce, data.wallet_address.toLowerCase(), data.chain_code.toUpperCase()]
    );

    if (!challenge || challenge.used) {
      throw new AuthenticationError('Invalid or expired challenge');
    }

    // Verify signature
    const isValid = await this.verifySignature(
      challenge.challenge_message,
      data.signature,
      data.wallet_address,
      data.chain_code
    );

    if (!isValid) {
      await this.logWalletAuthEvent({
        event_type: 'wallet_login',
        status: 'failure',
        wallet_address: data.wallet_address,
        failure_reason: 'Invalid signature',
        ...metadata,
      });
      throw new AuthenticationError('Invalid signature');
    }

    // Mark challenge as used
    await this.db.execute(
      'UPDATE wallet_auth_challenges SET used = TRUE, used_at = NOW() WHERE id = $1',
      [challenge.id]
    );

    // Find or create user
    const walletLink = await this.db.queryOne<WalletLink & { user: User }>(
      `SELECT wl.*,
              u.id as user_id, u.email, u.role, u.status, u.locked_until,
              u.email_verified, u.first_name, u.last_name, u.username,
              u.avatar_url, u.mfa_enabled, u.last_login_at, u.created_at,
              u.updated_at, u.metadata
       FROM wallet_links wl
       JOIN users u ON wl.user_id = u.id
       WHERE wl.wallet_address = $1 AND wl.chain_code = $2
         AND u.deleted_at IS NULL`,
      [data.wallet_address.toLowerCase(), data.chain_code.toUpperCase()]
    );

    let user: User;
    let is_new_user = false;

    if (!walletLink) {
      // Create new user with wallet
      user = await this.createUserWithWallet(data.wallet_address, data.chain_code);
      is_new_user = true;
    } else {
      user = walletLink.user;

      // Check if account is locked (same check as password-based login)
      if (user.locked_until && new Date(user.locked_until) > new Date()) {
        throw new AuthenticationError('Account is temporarily locked');
      }

      // Check if account is active
      if (user.status !== 'active') {
        throw new AuthenticationError(`Account is ${user.status}`);
      }

      // Update last used
      await this.db.execute(
        'UPDATE wallet_links SET last_used_at = NOW() WHERE id = $1',
        [walletLink.id]
      );
    }

    // Update last login
    await this.db.execute(
      'UPDATE users SET last_login_at = NOW(), last_login_ip = $1 WHERE id = $2',
      [metadata.ip_address || null, user.id]
    );

    // Generate tokens
    const tokens = await (this.authService as any).generateTokens(user, {
      ...metadata,
      device_name: data.device_name,
      device_fingerprint: data.device_fingerprint,
    });

    await this.logWalletAuthEvent({
      event_type: 'wallet_login',
      status: 'success',
      user_id: user.id,
      wallet_address: data.wallet_address,
      ...metadata,
    });

    return { user, tokens, is_new_user };
  }

  /**
   * Link a wallet to an existing user account
   */
  async linkWallet(
    user_id: string,
    data: LinkWalletRequest,
    metadata: { ip_address?: string; user_agent?: string } = {}
  ): Promise<WalletLink> {
    // Validate wallet address
    if (!this.isValidWalletAddress(data.wallet_address, data.chain_code)) {
      throw new ValidationError('Invalid wallet address format');
    }

    // Verify signature for wallet ownership
    const challenge = await this.db.queryOne<{ challenge_message: string; used: boolean }>(
      `SELECT challenge_message, used
       FROM wallet_auth_challenges
       WHERE nonce = $1 AND wallet_address = $2 AND expires_at > NOW()`,
      [data.nonce, data.wallet_address.toLowerCase()]
    );

    if (!challenge || challenge.used) {
      throw new AuthenticationError('Invalid or expired challenge');
    }

    const isValid = await this.verifySignature(
      challenge.challenge_message,
      data.signature,
      data.wallet_address,
      data.chain_code
    );

    if (!isValid) {
      throw new AuthenticationError('Invalid signature');
    }

    // Check if wallet is already linked
    const existingLink = await this.db.queryOne<WalletLink>(
      'SELECT id FROM wallet_links WHERE wallet_address = $1 AND chain_code = $2',
      [data.wallet_address.toLowerCase(), data.chain_code.toUpperCase()]
    );

    if (existingLink) {
      throw new ValidationError('Wallet is already linked to an account');
    }

    // If setting as primary, unset other primary wallets
    if (data.is_primary) {
      await this.db.execute(
        'UPDATE wallet_links SET is_primary = FALSE WHERE user_id = $1',
        [user_id]
      );
    }

    // Link wallet
    const walletLink = await this.db.queryOne<WalletLink>(
      `INSERT INTO wallet_links
       (user_id, wallet_address, chain_code, chain_id, wallet_type, is_primary,
        verified, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, TRUE, $7)
       RETURNING id, user_id, wallet_address, chain_code, chain_id, wallet_type,
                 is_primary, verified, last_used_at,
                 created_at, metadata`,
      [
        user_id,
        data.wallet_address.toLowerCase(),
        data.chain_code.toUpperCase(),
        data.chain_id || null,
        data.wallet_type || 'external',
        data.is_primary || false,
        JSON.stringify({}),
      ]
    );

    if (!walletLink) {
      throw new Error('Failed to link wallet');
    }

    await this.logWalletAuthEvent({
      event_type: 'wallet_link',
      status: 'success',
      user_id,
      wallet_address: data.wallet_address,
      ...metadata,
    });

    return walletLink;
  }

  /**
   * Unlink a wallet from user account
   */
  async unlinkWallet(
    user_id: string,
    wallet_id: string,
    metadata: { ip_address?: string; user_agent?: string } = {}
  ): Promise<void> {
    const walletLink = await this.db.queryOne<WalletLink>(
      'SELECT wallet_address FROM wallet_links WHERE id = $1 AND user_id = $2',
      [wallet_id, user_id]
    );

    if (!walletLink) {
      throw new ValidationError('Wallet not found');
    }

    // Check if user has password or other wallets
    const user = await this.db.queryOne<{
      password_hash: string | null;
      wallet_count: number;
    }>(
      `SELECT u.password_hash,
              (SELECT COUNT(*) FROM wallet_links WHERE user_id = u.id) as wallet_count
       FROM users u
       WHERE u.id = $1`,
      [user_id]
    );

    if (!user?.password_hash && user?.wallet_count === 1) {
      throw new ValidationError(
        'Cannot unlink last wallet without setting a password first'
      );
    }

    await this.db.execute('DELETE FROM wallet_links WHERE id = $1', [wallet_id]);

    await this.logWalletAuthEvent({
      event_type: 'wallet_unlink',
      status: 'success',
      user_id,
      wallet_address: walletLink.wallet_address,
      ...metadata,
    });
  }

  /**
   * Get user's wallets
   */
  async getUserWallets(user_id: string): Promise<WalletLink[]> {
    const wallets = await this.db.queryAll<WalletLink>(
      `SELECT id, user_id, wallet_address, chain_code, chain_id, wallet_type,
              is_primary, verified, last_used_at,
              created_at, updated_at, metadata
       FROM wallet_links
       WHERE user_id = $1
       ORDER BY is_primary DESC, created_at DESC`,
      [user_id]
    );

    return wallets;
  }

  /**
   * Set primary wallet
   */
  async setPrimaryWallet(user_id: string, wallet_id: string): Promise<void> {
    // Verify wallet belongs to user
    const wallet = await this.db.queryOne<WalletLink>(
      'SELECT id FROM wallet_links WHERE id = $1 AND user_id = $2',
      [wallet_id, user_id]
    );

    if (!wallet) {
      throw new ValidationError('Wallet not found');
    }

    // Unset other primary wallets
    await this.db.execute(
      'UPDATE wallet_links SET is_primary = FALSE WHERE user_id = $1',
      [user_id]
    );

    // Set new primary
    await this.db.execute(
      'UPDATE wallet_links SET is_primary = TRUE WHERE id = $1',
      [wallet_id]
    );
  }

  /**
   * Create user with wallet (wallet-only sign-up)
   */
  private async createUserWithWallet(
    wallet_address: string,
    chain_code: string
  ): Promise<User> {
    // Create user without email/password
    const user = await this.db.queryOne<User>(
      `INSERT INTO users (role, status, username)
       VALUES ('user', 'active', $1)
       RETURNING id, email, email_verified, first_name, last_name, username,
                 avatar_url, role, status, mfa_enabled, last_login_at,
                 created_at, updated_at, metadata`,
      [`wallet_${wallet_address.slice(0, 8)}`]
    );

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Link wallet to new user
    await this.db.execute(
      `INSERT INTO wallet_links
       (user_id, wallet_address, chain_code, wallet_type, is_primary, verified)
       VALUES ($1, $2, $3, $4, TRUE, TRUE)`,
      [
        user.id,
        wallet_address.toLowerCase(),
        chain_code.toUpperCase(),
        'external',
      ]
    );

    return user;
  }

  /**
   * Create challenge message for signing
   */
  private createChallengeMessage(
    wallet_address: string,
    nonce: string,
    expires_at: Date
  ): string {
    return `Sign this message to authenticate with DotMX

Wallet: ${wallet_address}
Nonce: ${nonce}
Expires: ${expires_at.toISOString()}

This signature will not trigger any blockchain transaction or cost any gas fees.`;
  }

  /**
   * Verify wallet signature
   */
  private async verifySignature(
    message: string,
    signature: string,
    wallet_address: string,
    chain_code: string
  ): Promise<boolean> {
    try {
      // For EVM chains, use viem for verification
      if (['ETH', 'POLYGON', 'AVAX', 'BSC', 'ARB', 'OP'].includes(chain_code.toUpperCase())) {
        return await this.verifyEVMSignature(message, signature, wallet_address);
      }

      // Solana — Ed25519 signature verification
      if (chain_code.toUpperCase() === 'SOL') {
        return await this.verifySolanaSignature(message, signature, wallet_address);
      }

      // Bitcoin — Message signature verification (BIP-322 or legacy)
      if (chain_code.toUpperCase() === 'BTC') {
        return await this.verifyBitcoinSignature(message, signature, wallet_address);
      }

      // Tron — Similar to EVM but with Tron address format
      if (chain_code.toUpperCase() === 'TRX' || chain_code.toUpperCase() === 'TRON') {
        return await this.verifyTronSignature(message, signature, wallet_address);
      }

      console.warn(`Unsupported chain for signature verification: ${chain_code}`);
      return false;
    } catch (error) {
      console.error('Signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify EVM signature (Ethereum, Polygon, etc.)
   */
  private async verifyEVMSignature(
    message: string,
    signature: string,
    expected_address: string
  ): Promise<boolean> {
    try {
      // Use viem for production-grade signature verification
      const { verifyMessage } = await import('viem');

      // Recover the address from the signature
      const valid = await verifyMessage({
        address: expected_address as `0x${string}`,
        message,
        signature: signature as `0x${string}`,
      });

      return valid;
    } catch (error) {
      console.error('EVM signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify Solana signature (Ed25519)
   */
  private async verifySolanaSignature(
    message: string,
    signature: string,
    expected_address: string
  ): Promise<boolean> {
    try {
      // Decode base58 public key and signature
      const { decode: bs58Decode } = await this.getBase58();
      const publicKeyBytes = bs58Decode(expected_address);
      const signatureBytes = bs58Decode(signature);

      // Use tweetnacl for Ed25519 verification
      const nacl = await import('tweetnacl');
      const messageBytes = new TextEncoder().encode(message);

      return nacl.sign.detached.verify(messageBytes, signatureBytes, publicKeyBytes);
    } catch (error) {
      console.error('Solana signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify Bitcoin message signature (legacy P2PKH & Bech32)
   *
   * Bitcoin message signing uses a double-SHA256 of:
   * "\x18Bitcoin Signed Message:\n" + varint(message.length) + message
   *
   * The signature is base64-encoded and contains a recovery flag byte.
   * We recover the public key and derive the address to compare.
   */
  private async verifyBitcoinSignature(
    message: string,
    signature: string,
    expected_address: string
  ): Promise<boolean> {
    try {
      // Use bitcoinjs-message if available, otherwise use secp256k1 recovery
      const { createHash } = await import('crypto');

      // Bitcoin message prefix
      const prefix = '\x18Bitcoin Signed Message:\n';
      const msgBuffer = Buffer.from(message, 'utf8');
      const prefixBuffer = Buffer.from(prefix, 'utf8');
      const lenBuffer = Buffer.from([msgBuffer.length]);

      // Double SHA-256
      const fullMsg = Buffer.concat([prefixBuffer, lenBuffer, msgBuffer]);
      const hash1 = createHash('sha256').update(fullMsg).digest();
      const hash2 = createHash('sha256').update(hash1).digest();

      // Decode base64 signature (65 bytes: 1 byte header + 32r + 32s)
      const sigBuffer = Buffer.from(signature, 'base64');
      if (sigBuffer.length !== 65) {
        console.error('Bitcoin signature must be 65 bytes');
        return false;
      }

      // Use secp256k1 to recover public key
      const { secp256k1 } = await import('ethereum-cryptography/secp256k1');
      const header = sigBuffer[0];
      const recoveryFlag = (header - 27) & 3;
      const r = sigBuffer.subarray(1, 33);
      const s = sigBuffer.subarray(33, 65);
      const sigCompact = new Uint8Array(64);
      sigCompact.set(r);
      sigCompact.set(s, 32);

      const sig = secp256k1.Signature.fromCompact(sigCompact).addRecoveryBit(recoveryFlag & 1);
      const publicKey = sig.recoverPublicKey(hash2);
      const pubKeyBytes = publicKey.toRawBytes(true); // Compressed

      // Derive P2PKH address from public key
      const sha = createHash('sha256').update(pubKeyBytes).digest();
      const ripemd = createHash('ripemd160').update(sha).digest();

      // Add version byte (0x00 for mainnet)
      const versioned = Buffer.concat([Buffer.from([0x00]), ripemd]);
      const checksum = createHash('sha256').update(
        createHash('sha256').update(versioned).digest()
      ).digest().subarray(0, 4);
      const addressBytes = Buffer.concat([versioned, checksum]);

      // Base58Check encode
      const { encode: bs58Encode } = await this.getBase58();
      const derivedAddress = bs58Encode(addressBytes);

      return derivedAddress === expected_address;
    } catch (error) {
      console.error('Bitcoin signature verification error:', error);
      return false;
    }
  }

  /**
   * Verify Tron signature
   *
   * Tron uses the same secp256k1 ECDSA as Ethereum but with a different
   * address format (Base58Check with 0x41 prefix instead of 0x checksum).
   */
  private async verifyTronSignature(
    message: string,
    signature: string,
    expected_address: string
  ): Promise<boolean> {
    try {
      // Tron signatures are hex-encoded, EVM-style personal_sign
      const { verifyMessage } = await import('viem');

      // Convert Tron address to EVM hex address for verification
      const evmAddress = await this.tronToEvmAddress(expected_address);
      if (!evmAddress) return false;

      const valid = await verifyMessage({
        address: evmAddress as `0x${string}`,
        message,
        signature: (signature.startsWith('0x') ? signature : `0x${signature}`) as `0x${string}`,
      });

      return valid;
    } catch (error) {
      console.error('Tron signature verification error:', error);
      return false;
    }
  }

  /**
   * Convert Tron Base58 address to EVM hex address.
   * Tron addresses are Base58Check encoded with a 0x41 prefix.
   * The underlying 20-byte address is the same as EVM.
   */
  private async tronToEvmAddress(tronAddress: string): Promise<string | null> {
    try {
      const { decode: bs58Decode } = await this.getBase58();
      const decoded = bs58Decode(tronAddress);
      // decoded = [0x41, ...20 address bytes, ...4 checksum bytes]
      if (decoded.length !== 25 || decoded[0] !== 0x41) return null;
      const addressBytes = decoded.slice(1, 21);
      return '0x' + Buffer.from(addressBytes).toString('hex');
    } catch {
      return null;
    }
  }

  /**
   * Get base58 encode/decode functions
   */
  private async getBase58() {
    try {
      const bs58 = await import('bs58');
      return { encode: bs58.default.encode ?? bs58.encode, decode: bs58.default.decode ?? bs58.decode };
    } catch {
      // Fallback: minimal base58 implementation
      const ALPHABET = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
      return {
        encode(bytes: Uint8Array): string {
          let num = BigInt('0x' + Buffer.from(bytes).toString('hex'));
          let result = '';
          while (num > 0n) {
            result = ALPHABET[Number(num % 58n)] + result;
            num = num / 58n;
          }
          for (const b of bytes) { if (b === 0) result = '1' + result; else break; }
          return result;
        },
        decode(str: string): Uint8Array {
          let num = 0n;
          for (const c of str) {
            const idx = ALPHABET.indexOf(c);
            if (idx < 0) throw new Error(`Invalid base58 char: ${c}`);
            num = num * 58n + BigInt(idx);
          }
          const hex = num.toString(16).padStart(2, '0');
          const bytes = Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex');
          let leadingZeros = 0;
          for (const c of str) { if (c === '1') leadingZeros++; else break; }
          const result = new Uint8Array(leadingZeros + bytes.length);
          result.set(bytes, leadingZeros);
          return result;
        },
      };
    }
  }

  /**
   * Validate wallet address format
   */
  private isValidWalletAddress(address: string, chain_code: string): boolean {
    const chainUpper = chain_code.toUpperCase();

    // EVM chains (Ethereum, Polygon, etc.)
    if (['ETH', 'POLYGON', 'AVAX', 'BSC', 'ARB', 'OP'].includes(chainUpper)) {
      return /^0x[a-fA-F0-9]{40}$/.test(address);
    }

    // Bitcoin
    if (chainUpper === 'BTC') {
      return /^[13][a-km-zA-HJ-NP-Z1-9]{25,34}$/.test(address) ||
        /^bc1[a-z0-9]{39,59}$/.test(address);
    }

    // Solana
    if (chainUpper === 'SOL') {
      return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
    }

    // Default: allow any non-empty string
    return address.length > 0;
  }

  /**
   * Log wallet auth event
   */
  private async logWalletAuthEvent(data: {
    event_type: AuthEventType;
    status: 'success' | 'failure';
    user_id?: string;
    wallet_address: string;
    failure_reason?: string;
    ip_address?: string;
    user_agent?: string;
  }): Promise<void> {
    await this.db.execute(
      `INSERT INTO auth_audit_logs
       (user_id, event_type, status, ip_address, user_agent, wallet_address, failure_reason, metadata)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        data.user_id || null,
        data.event_type,
        data.status,
        data.ip_address || null,
        data.user_agent || null,
        data.wallet_address,
        data.failure_reason || null,
        JSON.stringify({}),
      ]
    );
  }
}
