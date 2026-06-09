/**
 * Wallet Authentication Service Tests
 * Tests for Web3 wallet-based authentication
 */

import { describe, expect, test, beforeAll, afterAll, beforeEach, mock } from 'bun:test';
import { WalletAuthService } from '../../src/services/wallet-auth.service';
import { AuthService, type AuthConfig } from '../../src/services/auth.service';
import { TestDatabase, ensureTestDatabase } from '../../src/test-db-helper';
import { PostgresDB } from '../../src/db/postgres-client';

describe('WalletAuthService', () => {
  let testDb: TestDatabase;
  let db: PostgresDB;
  let authService: AuthService;
  let walletAuthService: WalletAuthService;

  const testConfig: Partial<AuthConfig> = {
    jwt_secret: 'test-jwt-secret-key-minimum-32-chars',
    jwt_access_expiry: 900,
    jwt_refresh_expiry: 604800,
  };

  const testWalletAddress = '0x1234567890123456789012345678901234567890';
  const testChainCode = 'ETH';

  beforeAll(async () => {
    await ensureTestDatabase();
    testDb = new TestDatabase();
    await testDb.connect();
    await testDb.setupDatabase();
    db = new PostgresDB(testDb.getClient());
    authService = new AuthService(db, testConfig);
    walletAuthService = new WalletAuthService(
      db as any,
      authService
    );
  });

  afterAll(async () => {
    await testDb.disconnect();
  });

  beforeEach(async () => {
    await testDb.clearDatabase();
    mock.restore();
  });

  // ============================================================================
  // CHALLENGE CREATION TESTS
  // ============================================================================

  describe('Challenge Creation', () => {
    test('should create challenge for valid EVM wallet address', async () => {
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: testChainCode,
      });

      expect(challenge).toBeDefined();
      expect(challenge.challenge_message).toContain('DotMX');
      expect(challenge.nonce).toBeDefined();
      expect(challenge.expires_at).toBeInstanceOf(Date);
    });

    test('should reject invalid wallet address format', async () => {
      await expect(walletAuthService.createChallenge({
        wallet_address: 'invalid-address',
        chain_code: testChainCode,
      })).rejects.toThrow('Invalid wallet address');
    });

    test('should accept Bitcoin address format', async () => {
      const btcAddress = '1BvBMSEYstWetqTFn5Au4m4GFg7xJaNVN2';
      const challenge = await walletAuthService.createChallenge({
        wallet_address: btcAddress,
        chain_code: 'BTC',
      });

      expect(challenge).toBeDefined();
      expect(challenge.nonce).toBeDefined();
    });

    test('should accept Solana address format', async () => {
      const solAddress = 'So11111111111111111111111111111111111111112';
      const challenge = await walletAuthService.createChallenge({
        wallet_address: solAddress,
        chain_code: 'SOL',
      });

      expect(challenge).toBeDefined();
      expect(challenge.nonce).toBeDefined();
    });

    test('should store challenge in database', async () => {
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: testChainCode,
      });

      const stored = await db.queryOne<any>(
        `SELECT * FROM wallet_auth_challenges WHERE nonce = $1`,
        [challenge.nonce]
      );

      expect(stored).toBeDefined();
      expect(stored.wallet_address).toBe(testWalletAddress.toLowerCase());
      expect(stored.chain_code).toBe(testChainCode.toUpperCase());
    });
  });

  // ============================================================================
  // WALLET ADDRESS VALIDATION TESTS
  // ============================================================================

  describe('Wallet Address Validation', () => {
    test('should validate EVM addresses correctly', async () => {
      // Valid EVM address
      const challenge = await walletAuthService.createChallenge({
        wallet_address: '0xAb5801a7D398351b8bE11C439e05C5B3259aeC9B',
        chain_code: 'ETH',
      });
      expect(challenge.nonce).toBeDefined();
    });

    test('should support Polygon chain', async () => {
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: 'POLYGON',
      });
      expect(challenge.nonce).toBeDefined();
    });

    test('should support BSC chain', async () => {
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: 'BSC',
      });
      expect(challenge.nonce).toBeDefined();
    });

    test('should support Arbitrum chain', async () => {
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: 'ARB',
      });
      expect(challenge.nonce).toBeDefined();
    });

    test('should normalize wallet address to lowercase', async () => {
      const mixedCaseAddress = '0xAB5801A7D398351B8BE11C439E05C5B3259AEC9B';
      const challenge = await walletAuthService.createChallenge({
        wallet_address: mixedCaseAddress,
        chain_code: 'ETH',
      });

      const stored = await db.queryOne<any>(
        `SELECT wallet_address FROM wallet_auth_challenges WHERE nonce = $1`,
        [challenge.nonce]
      );

      expect(stored.wallet_address).toBe(mixedCaseAddress.toLowerCase());
    });

    test('should normalize chain code to uppercase', async () => {
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: 'eth',
      });

      const stored = await db.queryOne<any>(
        `SELECT chain_code FROM wallet_auth_challenges WHERE nonce = $1`,
        [challenge.nonce]
      );

      expect(stored.chain_code).toBe('ETH');
    });
  });

  // ============================================================================
  // USER WALLET MANAGEMENT TESTS
  // ============================================================================

  describe('User Wallet Management', () => {
    let testUserId: string;

    beforeEach(async () => {
      // Create a user with email/password for wallet linking tests
      const email = `wallet-${Date.now()}-${Math.random().toString(36).slice(2)}@test.com`;
      const result = await authService.register({
        email,
        password: 'SecurePass123!',
      });
      testUserId = result.user.id;
    });

    test('should get empty wallet list for new user', async () => {
      const wallets = await walletAuthService.getUserWallets(testUserId);
      expect(wallets).toEqual([]);
    });

    test('should link wallet to existing user', async () => {
      // Create a challenge
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: testChainCode,
      });

      // Mock verifySignature to return true for this test
      const originalVerify = (walletAuthService as any).verifySignature;
      (walletAuthService as any).verifySignature = mock(() => Promise.resolve(true));

      try {
        // Link wallet
        const walletLink = await walletAuthService.linkWallet(testUserId, {
          wallet_address: testWalletAddress,
          chain_code: testChainCode,
          nonce: challenge.nonce,
          signature: '0xmocksignature',
          is_primary: true,
        });

        expect(walletLink).toBeDefined();
        expect(walletLink.user_id).toBe(testUserId);
        expect(walletLink.wallet_address).toBe(testWalletAddress.toLowerCase());
        expect(walletLink.is_primary).toBe(true);

        // Verify wallet appears in user's wallet list
        const wallets = await walletAuthService.getUserWallets(testUserId);
        expect(wallets).toHaveLength(1);
        expect(wallets[0].wallet_address).toBe(testWalletAddress.toLowerCase());
      } finally {
        // Restore original method
        (walletAuthService as any).verifySignature = originalVerify;
      }
    });

    test('should set primary wallet', async () => {
      // Link first wallet
      const wallet1Address = '0x1111111111111111111111111111111111111111';
      const challenge1 = await walletAuthService.createChallenge({
        wallet_address: wallet1Address,
        chain_code: testChainCode,
      });

      const originalVerify = (walletAuthService as any).verifySignature;
      (walletAuthService as any).verifySignature = mock(() => Promise.resolve(true));

      try {
        const wallet1 = await walletAuthService.linkWallet(testUserId, {
          wallet_address: wallet1Address,
          chain_code: testChainCode,
          nonce: challenge1.nonce,
          signature: '0xmocksignature',
          is_primary: true,
        });

        // Link second wallet
        const wallet2Address = '0x2222222222222222222222222222222222222222';
        const challenge2 = await walletAuthService.createChallenge({
          wallet_address: wallet2Address,
          chain_code: testChainCode,
        });

        const wallet2 = await walletAuthService.linkWallet(testUserId, {
          wallet_address: wallet2Address,
          chain_code: testChainCode,
          nonce: challenge2.nonce,
          signature: '0xmocksignature',
          is_primary: false,
        });

        // Set wallet2 as primary
        await walletAuthService.setPrimaryWallet(testUserId, wallet2.id);

        // Verify wallet2 is now primary
        const wallets = await walletAuthService.getUserWallets(testUserId);
        expect(wallets).toHaveLength(2);
        
        const primaryWallet = wallets.find(w => w.is_primary);
        expect(primaryWallet?.id).toBe(wallet2.id);
        expect(primaryWallet?.wallet_address).toBe(wallet2Address.toLowerCase());
      } finally {
        (walletAuthService as any).verifySignature = originalVerify;
      }
    });

    test('should unlink wallet', async () => {
      // Create user with password (required to unlink wallet)
      const emailWithPassword = `wallet-unlink-${Date.now()}@test.com`;
      const userWithPassword = await authService.register({
        email: emailWithPassword,
        password: 'SecurePass123!',
      });

      // Link wallet
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: testChainCode,
      });

      const originalVerify = (walletAuthService as any).verifySignature;
      (walletAuthService as any).verifySignature = mock(() => Promise.resolve(true));

      try {
        const walletLink = await walletAuthService.linkWallet(userWithPassword.user.id, {
          wallet_address: testWalletAddress,
          chain_code: testChainCode,
          nonce: challenge.nonce,
          signature: '0xmocksignature',
          is_primary: true,
        });

        // Verify wallet is linked
        let wallets = await walletAuthService.getUserWallets(userWithPassword.user.id);
        expect(wallets).toHaveLength(1);

        // Unlink wallet
        await walletAuthService.unlinkWallet(userWithPassword.user.id, walletLink.id);

        // Verify wallet is unlinked
        wallets = await walletAuthService.getUserWallets(userWithPassword.user.id);
        expect(wallets).toHaveLength(0);
      } finally {
        (walletAuthService as any).verifySignature = originalVerify;
      }
    });
  });

  // ============================================================================
  // CHALLENGE MESSAGE FORMAT TESTS
  // ============================================================================

  describe('Challenge Message Format', () => {
    test('should include wallet address in message', async () => {
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: testChainCode,
      });

      expect(challenge.challenge_message).toContain(testWalletAddress);
    });

    test('should include nonce in message', async () => {
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: testChainCode,
      });

      expect(challenge.challenge_message).toContain(challenge.nonce);
    });

    test('should include expiry info in message', async () => {
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: testChainCode,
      });

      expect(challenge.challenge_message).toContain('Expires:');
    });

    test('should include security disclaimer', async () => {
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: testChainCode,
      });

      // Message should mention that signing doesn't cost gas
      expect(challenge.challenge_message).toContain('gas fees');
    });
  });

  // ============================================================================
  // CHALLENGE EXPIRY TESTS
  // ============================================================================

  describe('Challenge Expiry', () => {
    test('should set expiry 5 minutes from now', async () => {
      const now = Date.now();
      const challenge = await walletAuthService.createChallenge({
        wallet_address: testWalletAddress,
        chain_code: testChainCode,
      });

      const expiryTime = challenge.expires_at.getTime();
      const expectedExpiry = now + 5 * 60 * 1000; // 5 minutes

      // Allow 10 second tolerance for test execution time
      expect(Math.abs(expiryTime - expectedExpiry)).toBeLessThan(10000);
    });
  });
});
