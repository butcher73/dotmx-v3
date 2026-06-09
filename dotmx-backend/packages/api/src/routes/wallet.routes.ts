/**
 * Custodial Wallet Routes
 * API endpoints for deposit addresses, balances, and withdrawals
 * 
 * This integrates with the custodial wallet system for:
 * - HD wallet deposit address generation
 * - User balance tracking
 * - Withdrawal requests with multisig support
 */

import { Elysia, t } from 'elysia';
import { DatabaseService, AuthService, AlchemyWebhookService } from '@dotmx/shared';
import {
  GCPKMSService,
  HDWalletService,
  SweeperService,
  WithdrawalService,
  CHAIN_CONFIGS,
} from '@dotmx/shared';

interface User {
  id: string;
  email?: string;
  role: string;
}

/**
 * Create custodial wallet routes for authenticated users
 */
export function createCustodialWalletRoutes(
  db: DatabaseService,
  authService: AuthService,
  kms: GCPKMSService,
  hdWallet: HDWalletService,
  withdrawalService: WithdrawalService,
  alchemyWebhook?: AlchemyWebhookService
) {
  return new Elysia({ prefix: '/wallet' })
    .decorate('db', db)
    .decorate('hdWallet', hdWallet)
    .decorate('withdrawalService', withdrawalService)
    .decorate('alchemyWebhook', alchemyWebhook)
    .derive(async ({ headers, db }) => {
      // Derive user from Authorization header
      const authHeader = headers.authorization || headers.Authorization;
      
      if (!authHeader) {
        return { user: null };
      }

      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.substring(7);
        try {
          const jwt = await authService.verifyToken(token);
          const user = await db.queryOne<User>(
            `SELECT id, email, role
             FROM users WHERE id = $1 AND deleted_at IS NULL AND status = 'active'`,
            [jwt.sub]
          );
          return { user };
        } catch (error) {
          return { user: null };
        }
      }

      return { user: null };
    })

    /**
     * Get supported chains
     */
    .get('/chains', async ({ hdWallet }) => {
      const chains = hdWallet.getSupportedChains();
      return {
        chains: chains.map(c => ({
          chain_code: c.chain_code,
          chain_id: c.chain_id,
          name: c.name,
          native_symbol: c.native_symbol,
          explorer_url: c.explorer_url,
          confirmations_required: c.confirmations_required,
        })),
      };
    })

    /**
     * Get or create deposit address for a chain
     */
    .post(
      '/deposit-address',
      async ({ body, hdWallet, user, set, alchemyWebhook }) => {
        if (!user) {
          set.status = 401;
          return { error: 'Authentication required' };
        }

        const chainCode = body.chain_code.toUpperCase();

        try {
          const depositAddress = await hdWallet.getOrCreateDepositAddress({
            user_id: user.id,
            chain_code: chainCode,
          });

          // Register address with Alchemy for webhook notifications
          if (alchemyWebhook) {
            alchemyWebhook.addAddresses(chainCode, [depositAddress.address])
              .catch(err => console.error('[Wallet] Failed to register address with Alchemy:', err));
          }

          const chainConfig = CHAIN_CONFIGS[chainCode];

          return {
            address: depositAddress.address,
            chain_code: chainCode,
            chain_id: chainConfig?.chain_id,
            chain_name: chainConfig?.name,
            explorer_url: chainConfig?.explorer_url,
            created_at: depositAddress.created_at,
          };
        } catch (error) {
          set.status = 400;
          return { error: (error as Error).message };
        }
      },
      {
        body: t.Object({
          chain_code: t.String({ description: 'Chain code (ETH, MATIC, BSC, ARB, OP)' }),
        }),
        detail: {
          tags: ['wallet'],
          summary: 'Get or create deposit address',
          description: 'Returns a unique deposit address for the authenticated user on the specified chain',
        },
      }
    )

    /**
     * Get all deposit addresses for user
     */
    .get('/deposit-addresses', async ({ hdWallet, user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Authentication required' };
      }

      const addresses = await hdWallet.getUserDepositAddresses(user.id);

      return {
        addresses: addresses.map(a => {
          const chainConfig = CHAIN_CONFIGS[a.chain_code];
          return {
            address: a.address,
            chain_code: a.chain_code,
            chain_id: chainConfig?.chain_id,
            chain_name: chainConfig?.name,
            explorer_url: chainConfig?.explorer_url,
            created_at: a.created_at,
          };
        }),
      };
    }, {
      detail: {
        tags: ['wallet'],
        summary: 'List deposit addresses',
        description: 'Returns all deposit addresses for the authenticated user',
      },
    })

    /**
     * Get user balances
     */
    .get('/balances', async ({ withdrawalService, user, set }) => {
      if (!user) {
        set.status = 401;
        return { error: 'Authentication required' };
      }

      const balances = await withdrawalService.getAllUserBalances(user.id);

      return {
        balances: balances.map(b => ({
          token_symbol: b.token_symbol,
          chain_code: b.chain_code,
          available: b.available,
          locked: b.locked,
          total: (parseFloat(b.available) + parseFloat(b.locked)).toFixed(18),
        })),
      };
    }, {
      detail: {
        tags: ['wallet'],
        summary: 'Get balances',
        description: 'Returns token balances for the authenticated user',
      },
    })

    /**
     * Get deposit history
     */
    .get(
      '/deposits',
      async ({ db, user, query, set }) => {
        if (!user) {
          set.status = 401;
          return { error: 'Authentication required' };
        }

        const limit = Math.min(query.limit ? parseInt(query.limit, 10) : 50, 100);
        const offset = query.offset ? parseInt(query.offset, 10) : 0;

        const deposits = await db.query<any>(
          `SELECT d.id, 
                  c.code as network_code, 
                  t.symbol as asset_symbol, 
                  d.amount, 
                  d.tx_hash, 
                  d.status, 
                  d.confirmations, 
                  d.detected_at, 
                  d.confirmed_at, 
                  d.swept_at,
                  d.created_at
           FROM deposits d
           LEFT JOIN networks c ON d.network_id = c.id
           LEFT JOIN assets t ON d.asset_id = t.id
           WHERE d.user_id = $1
           ORDER BY d.created_at DESC
           LIMIT $2 OFFSET $3`,
          [user.id, limit, offset]
        );

        const total = await db.queryOne<{ count: string }>(
          'SELECT COUNT(*) as count FROM deposits WHERE user_id = $1',
          [user.id]
        );

        return { 
          deposits,
          pagination: {
            limit,
            offset,
            total: parseInt(total?.count || '0', 10),
          },
        };
      },
      {
        query: t.Object({
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
        detail: {
          tags: ['wallet'],
          summary: 'Get deposit history',
          description: 'Returns deposit history for the authenticated user',
        },
      }
    )

    /**
     * Request withdrawal
     */
    .post(
      '/withdraw',
      async ({ body, withdrawalService, user, request, set }) => {
        if (!user) {
          set.status = 401;
          return { error: 'Authentication required' };
        }

        try {
          const ip_address = request.headers.get('x-forwarded-for') || 
                            request.headers.get('x-real-ip') || 
                            undefined;
          const user_agent = request.headers.get('user-agent') || undefined;

          const withdrawal = await withdrawalService.createWithdrawal({
            user_id: user.id,
            chain_code: body.chain_code.toUpperCase(),
            token_symbol: body.token_symbol.toUpperCase(),
            amount: body.amount,
            destination_address: body.destination_address,
            ip_address,
            user_agent,
          });

          set.status = 201;
          return {
            id: withdrawal.id,
            status: withdrawal.status,
            amount: withdrawal.amount,
            fee: withdrawal.fee,
            destination_address: withdrawal.to_address,
            token_symbol: withdrawal.token_symbol,
            chain_code: withdrawal.chain_code,
            created_at: withdrawal.created_at,
          };
        } catch (error) {
          const err = error as any;
          set.status = err.status || 400;
          return { error: err.message, code: err.code };
        }
      },
      {
        body: t.Object({
          chain_code: t.String({ description: 'Chain code (ETH, MATIC, etc.)' }),
          token_symbol: t.String({ description: 'Token symbol (ETH, USDT, etc.)' }),
          amount: t.String({ description: 'Amount to withdraw' }),
          destination_address: t.String({ description: 'Destination wallet address' }),
        }),
        detail: {
          tags: ['wallet'],
          summary: 'Request withdrawal',
          description: 'Create a new withdrawal request. Funds will be locked until processed.',
        },
      }
    )

    /**
     * Get withdrawal history
     */
    .get(
      '/withdrawals',
      async ({ withdrawalService, user, query, set }) => {
        if (!user) {
          set.status = 401;
          return { error: 'Authentication required' };
        }

        const limit = Math.min(query.limit ? parseInt(query.limit, 10) : 50, 100);
        const offset = query.offset ? parseInt(query.offset, 10) : 0;

        const withdrawals = await withdrawalService.getUserWithdrawals(user.id, {
          status: query.status as any,
          limit,
          offset,
        });

        return {
          withdrawals: withdrawals.map(w => ({
            id: w.id,
            status: w.status,
            amount: w.amount,
            fee: w.fee,
            destination_address: w.to_address,
            token_symbol: w.token_symbol,
            chain_code: w.chain_code,
            tx_hash: w.tx_hash,
            created_at: w.created_at,
            completed_at: w.completed_at,
          })),
        };
      },
      {
        query: t.Object({
          status: t.Optional(t.String({ description: 'Filter by status' })),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
        detail: {
          tags: ['wallet'],
          summary: 'Get withdrawal history',
          description: 'Returns withdrawal history for the authenticated user',
        },
      }
    )

    /**
     * Cancel pending withdrawal
     */
    .delete(
      '/withdrawals/:id',
      async ({ params, withdrawalService, user, set }) => {
        if (!user) {
          set.status = 401;
          return { error: 'Authentication required' };
        }

        try {
          await withdrawalService.cancelWithdrawal(user.id, params.id);
          return { message: 'Withdrawal cancelled successfully' };
        } catch (error) {
          const err = error as any;
          set.status = err.status || 400;
          return { error: err.message };
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['wallet'],
          summary: 'Cancel withdrawal',
          description: 'Cancel a pending withdrawal request',
        },
      }
    )

    /**
     * Validate address
     */
    .post(
      '/validate-address',
      async ({ body, hdWallet }) => {
        const result = hdWallet.validateAddress(body.address);
        return {
          valid: result.valid,
          checksum_address: result.checksum_address,
          chain_code: body.chain_code,
        };
      },
      {
        body: t.Object({
          address: t.String(),
          chain_code: t.Optional(t.String()),
        }),
        detail: {
          tags: ['wallet'],
          summary: 'Validate address',
          description: 'Validate an EVM wallet address format',
        },
      }
    )

    /**
     * Get supported tokens
     */
    .get('/tokens', async ({ db }) => {
      const tokens = await db.query<any>(
        `SELECT n.code as chain_code, an.contract_address as token_address, a.symbol as token_symbol, 
                a.name as token_name, an.decimals, an.is_native, 
                an.min_deposit, an.min_withdrawal, an.withdrawal_fee
         FROM asset_networks an
         JOIN assets a ON an.asset_id = a.id
         JOIN networks n ON an.network_id = n.id
         WHERE an.is_active = TRUE AND a.is_active = TRUE AND n.is_active = TRUE
         ORDER BY n.code, a.symbol`
      );
      return { tokens };
    }, {
      detail: {
        tags: ['wallet'],
        summary: 'List supported tokens',
        description: 'Returns list of supported tokens for deposits and withdrawals',
      },
    });
}

/**
 * Create admin wallet routes for operators
 */
export function createAdminCustodialWalletRoutes(
  db: DatabaseService,
  authService: AuthService,
  hdWallet: HDWalletService,
  withdrawalService: WithdrawalService,
  sweeperService: SweeperService
) {
  return new Elysia({ prefix: '/admin/wallet' })
    .decorate('db', db)
    .decorate('hdWallet', hdWallet)
    .decorate('withdrawalService', withdrawalService)
    .decorate('sweeperService', sweeperService)
    .derive(async ({ headers, db }) => {
      // Admin authentication
      const authHeader = headers.authorization || headers.Authorization;
      
      if (!authHeader?.startsWith('Bearer ')) {
        return { admin: null };
      }

      const token = authHeader.substring(7);
      try {
        const jwt = await authService.verifyToken(token);
        const user = await db.queryOne<User>(
          `SELECT id, email, role
           FROM users WHERE id = $1 AND deleted_at IS NULL AND status = 'active' AND role IN ('admin', 'super_admin')`,
          [jwt.sub]
        );
        return { admin: user };
      } catch (error) {
        return { admin: null };
      }
    })
    .onBeforeHandle(({ admin, set }) => {
      if (!admin) {
        set.status = 403;
        return { error: 'Admin access required' };
      }
    })

    /**
     * Get system status
     */
    .get('/status', async ({ hdWallet, withdrawalService, sweeperService }) => {
      const [walletHealth, sweeperStatus, withdrawalStatus] = await Promise.all([
        hdWallet.healthCheck(),
        sweeperService.getStatus(),
        withdrawalService.getStatus(),
      ]);

      return {
        wallet: walletHealth,
        sweeper: sweeperStatus,
        withdrawals: withdrawalStatus,
        timestamp: new Date().toISOString(),
      };
    }, {
      detail: {
        tags: ['admin-wallet'],
        summary: 'Get wallet system status',
      },
    })

    /**
     * Get pending withdrawals
     */
    .get(
      '/withdrawals/pending',
      async ({ withdrawalService, query }) => {
        const withdrawals = await withdrawalService.getPendingWithdrawals(query.chain_code);
        return { withdrawals };
      },
      {
        query: t.Object({
          chain_code: t.Optional(t.String()),
        }),
        detail: {
          tags: ['admin-wallet'],
          summary: 'List pending withdrawals',
        },
      }
    )

    /**
     * Create withdrawal batch
     */
    .post(
      '/withdrawals/batch',
      async ({ body, withdrawalService, set }) => {
        try {
          const batch = await withdrawalService.createBatch(body.chain_code.toUpperCase());
          set.status = 201;
          return { batch };
        } catch (error) {
          set.status = 400;
          return { error: (error as Error).message };
        }
      },
      {
        body: t.Object({
          chain_code: t.String(),
        }),
        detail: {
          tags: ['admin-wallet'],
          summary: 'Create withdrawal batch',
          description: 'Group pending withdrawals into a batch for processing',
        },
      }
    )

    /**
     * Export batch for offline signing
     */
    .get(
      '/withdrawals/batch/:id/export',
      async ({ params, withdrawalService, set }) => {
        try {
          const exportData = await withdrawalService.exportBatch(params.id);
          return exportData;
        } catch (error) {
          set.status = 400;
          return { error: (error as Error).message };
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        detail: {
          tags: ['admin-wallet'],
          summary: 'Export batch for signing',
          description: 'Export unsigned transaction data for offline multisig signing',
        },
      }
    )

    /**
     * Get pending batches
     */
    .get('/withdrawals/batches', async ({ withdrawalService }) => {
      const batches = await withdrawalService.getPendingBatches();
      return { batches };
    }, {
      detail: {
        tags: ['admin-wallet'],
        summary: 'List pending batches',
      },
    })

    /**
     * Submit signed transaction
     */
    .post(
      '/withdrawals/batch/:id/submit',
      async ({ params, body, withdrawalService, set }) => {
        try {
          const result = await withdrawalService.importAndBroadcast({
            batch_id: params.id,
            signed_tx: body.signed_tx,
            signatures: body.signatures,
          });
          return result;
        } catch (error) {
          set.status = 400;
          return { error: (error as Error).message };
        }
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          signed_tx: t.String({ description: 'Signed transaction hex' }),
          signatures: t.Optional(t.Array(t.String())),
        }),
        detail: {
          tags: ['admin-wallet'],
          summary: 'Submit signed transaction',
          description: 'Submit a signed multisig transaction for broadcast',
        },
      }
    )

    /**
     * Get sweeper status
     */
    .get('/sweeper/status', async ({ sweeperService }) => {
      const status = await sweeperService.getStatus();
      return status;
    }, {
      detail: {
        tags: ['admin-wallet'],
        summary: 'Get sweeper status',
      },
    })

    /**
     * Trigger manual sweep
     */
    .post(
      '/sweeper/sweep',
      async ({ body, sweeperService }) => {
        const result = await sweeperService.manualSweep(body.chain_code);
        return result;
      },
      {
        body: t.Object({
          chain_code: t.Optional(t.String()),
        }),
        detail: {
          tags: ['admin-wallet'],
          summary: 'Trigger manual sweep',
        },
      }
    )

    /**
     * Start sweeper
     */
    .post('/sweeper/start', async ({ sweeperService }) => {
      sweeperService.start();
      return { message: 'Sweeper started', timestamp: new Date().toISOString() };
    }, {
      detail: {
        tags: ['admin-wallet'],
        summary: 'Start sweeper service',
      },
    })

    /**
     * Stop sweeper
     */
    .post('/sweeper/stop', async ({ sweeperService }) => {
      sweeperService.stop();
      return { message: 'Sweeper stopped', timestamp: new Date().toISOString() };
    }, {
      detail: {
        tags: ['admin-wallet'],
        summary: 'Stop sweeper service',
      },
    })

    /**
     * Configure warm wallet
     */
    .post(
      '/warm-wallets',
      async ({ body, db, set }) => {
        try {
          const wallet = await db.queryOne<any>(
            `INSERT INTO warm_wallets 
             (network_id, address, wallet_type, required_signatures, total_signers, is_active)
             VALUES (
               (SELECT id FROM networks WHERE code = $1),
               $2, $3, $4, $5, TRUE
             )
             ON CONFLICT (network_id) 
             DO UPDATE SET 
               address = $2, wallet_type = $3, required_signatures = $4, 
               total_signers = $5, is_active = TRUE, updated_at = NOW()
             RETURNING *`,
            [
              body.chain_code.toUpperCase(),
              body.address,
              body.wallet_type,
              body.required_signatures,
              body.total_signers,
            ]
          );
          set.status = 201;
          return { wallet };
        } catch (error) {
          set.status = 400;
          return { error: (error as Error).message };
        }
      },
      {
        body: t.Object({
          chain_code: t.String({ description: 'Network code (ETH, MATIC, etc.)' }),
          address: t.String({ description: 'Multisig wallet address' }),
          wallet_type: t.String({ description: 'gnosis_safe, custom_multisig, or eoa' }),
          required_signatures: t.Number(),
          total_signers: t.Number(),
        }),
        detail: {
          tags: ['admin-wallet'],
          summary: 'Configure warm wallet',
        },
      }
    )

    /**
     * Get warm wallets
     */
    .get('/warm-wallets', async ({ db }) => {
      const wallets = await db.query<any>(
        `SELECT w.*, n.code as chain_code FROM warm_wallets w JOIN networks n ON w.network_id = n.id ORDER BY n.code`
      );
      return { wallets };
    }, {
      detail: {
        tags: ['admin-wallet'],
        summary: 'List warm wallets',
      },
    })

    /**
     * Add supported token
     */
    .post(
      '/tokens',
      async ({ body, db, set }) => {
        try {
          const token = await db.queryOne<any>(
            `INSERT INTO asset_networks 
             (asset_id, network_id, contract_address, decimals, is_native, 
              min_deposit, min_withdrawal, withdrawal_fee)
             VALUES (
               (SELECT id FROM assets WHERE symbol = $1),
               (SELECT id FROM networks WHERE code = $2),
               $3, $4, $5, $6, $7, $8
             )
             ON CONFLICT (asset_id, network_id) DO UPDATE SET
               contract_address = $3, decimals = $4,
               min_deposit = $6, min_withdrawal = $7, withdrawal_fee = $8
             RETURNING *`,
            [
              body.token_symbol.toUpperCase(),
              body.chain_code.toUpperCase(),
              body.token_address || null,
              body.decimals,
              body.is_native || false,
              body.min_deposit || '0',
              body.min_withdrawal || '0',
              body.withdrawal_fee || '0',
            ]
          );
          set.status = 201;
          return { token };
        } catch (error) {
          set.status = 400;
          return { error: (error as Error).message };
        }
      },
      {
        body: t.Object({
          chain_code: t.String({ description: 'Network code (ETH, MATIC, etc.)' }),
          token_symbol: t.String({ description: 'Asset symbol (ETH, USDT, etc.)' }),
          token_address: t.Optional(t.String({ description: 'Contract address (null for native)' })),
          decimals: t.Number(),
          is_native: t.Optional(t.Boolean()),
          min_deposit: t.Optional(t.String()),
          min_withdrawal: t.Optional(t.String()),
          withdrawal_fee: t.Optional(t.String()),
        }),
        detail: {
          tags: ['admin-wallet'],
          summary: 'Add supported token',
        },
      }
    )

    /**
     * Balance reconciliation
     */
    .get('/reconciliation', async ({ db }) => {
      const internalBalances = await db.query<any>(
        `SELECT a.symbol as token_symbol, 
                SUM(CAST(ub.available AS DECIMAL)) as total_available,
                SUM(CAST(ub.locked AS DECIMAL)) as total_locked
         FROM user_balances ub
         JOIN assets a ON ub.asset_id = a.id
         GROUP BY a.symbol
         ORDER BY a.symbol`
      );

      const warmWallets = await db.query<any>(
        `SELECT n.code as chain_code, w.address FROM warm_wallets w JOIN networks n ON w.network_id = n.id WHERE w.is_active = TRUE`
      );

      const pendingDeposits = await db.queryOne<{ count: string; total: string }>(
        `SELECT COUNT(*) as count, COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
         FROM deposits WHERE status IN ('pending', 'confirming')`
      );

      const pendingWithdrawals = await db.queryOne<{ count: string; total: string }>(
        `SELECT COUNT(*) as count, COALESCE(SUM(CAST(amount AS DECIMAL)), 0) as total
         FROM withdrawal_requests WHERE status IN ('pending_approval', 'approved', 'processing')`
      );

      return {
        internal_balances: internalBalances,
        warm_wallets: warmWallets,
        pending: {
          deposits: {
            count: parseInt(pendingDeposits?.count || '0', 10),
            total: pendingDeposits?.total || '0',
          },
          withdrawals: {
            count: parseInt(pendingWithdrawals?.count || '0', 10),
            total: pendingWithdrawals?.total || '0',
          },
        },
        timestamp: new Date().toISOString(),
        note: 'Compare internal balances against warm wallet on-chain balances for full reconciliation',
      };
    }, {
      detail: {
        tags: ['admin-wallet'],
        summary: 'Balance reconciliation',
        description: 'Get internal balance summary for reconciliation with on-chain data',
      },
    })

    /**
     * Get audit logs
     */
    .get(
      '/audit-logs',
      async ({ db, query }) => {
        const limit = Math.min(query.limit ? parseInt(query.limit, 10) : 100, 500);
        const offset = query.offset ? parseInt(query.offset, 10) : 0;

        let whereClause = '';
        const params: any[] = [];

        if (query.user_id) {
          whereClause = 'WHERE user_id = $1';
          params.push(query.user_id);
        }

        if (query.operation) {
          whereClause = whereClause 
            ? `${whereClause} AND tx_type = $${params.length + 1}`
            : `WHERE tx_type = $1`;
          params.push(query.operation);
        }

        const logs = await db.query<any>(
          `SELECT * FROM balance_transactions ${whereClause}
           ORDER BY created_at DESC 
           LIMIT $${params.length + 1} OFFSET $${params.length + 2}`,
          [...params, limit, offset]
        );

        return { logs };
      },
      {
        query: t.Object({
          user_id: t.Optional(t.String()),
          operation: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
        detail: {
          tags: ['admin-wallet'],
          summary: 'Get audit logs',
        },
      }
    );
}
