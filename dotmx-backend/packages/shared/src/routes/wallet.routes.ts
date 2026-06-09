/**
 * Custodial Wallet API Routes
 * Handles deposit addresses, balances, and withdrawals
 */

import { Elysia, t } from 'elysia';
import type { DatabaseService } from '../services/database';
import type { HDWalletService } from '../services/hd-wallet.service';
import type { WithdrawalService } from '../services/withdrawal.service';
import type { SweeperService } from '../services/sweeper.service';
import type { AuthService } from '../services/auth.service';
import { CHAIN_CONFIGS } from '../types/custodial-wallet';

/**
 * Create wallet routes for authenticated users
 */
export function createWalletRoutes(
  db: DatabaseService,
  authService: AuthService,
  hdWallet: HDWalletService,
  withdrawalService: WithdrawalService
) {
  return new Elysia({ prefix: '/wallet' })
    .decorate('db', db)
    .decorate('hdWallet', hdWallet)
    .decorate('withdrawalService', withdrawalService)
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
          const user = await db.queryOne<any>(
            `SELECT id, email, email_verified, first_name, last_name, username,
                    avatar_url, role, status, mfa_enabled, last_login_at,
                    created_at, updated_at, metadata
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
        })),
      };
    })

    /**
     * Get or create deposit address for a chain
     */
    .post(
      '/deposit-address',
      async ({ body, hdWallet, user, set }) => {
        if (!user) {
          set.status = 401;
          return { error: 'Authentication required' };
        }

        const depositAddress = await hdWallet.getOrCreateDepositAddress({
          user_id: user.id,
          chain_code: body.chain_code,
        });

        const chainConfig = CHAIN_CONFIGS[body.chain_code];

        return {
          address: depositAddress.address,
          chain_code: depositAddress.chain_code,
          chain_id: chainConfig?.chain_id,
          chain_name: chainConfig?.name,
        };
      },
      {
        body: t.Object({
          chain_code: t.String(),
        }),
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
            created_at: a.created_at,
          };
        }),
      };
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
          total: (parseFloat(b.available) + parseFloat(b.locked)).toString(),
        })),
      };
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

        const limit = query.limit ? parseInt(query.limit, 10) : 50;
        const offset = query.offset ? parseInt(query.offset, 10) : 0;

        const deposits = await db.query<any>(
          `SELECT d.id, n.code as chain_code, a.symbol as token_symbol, d.amount, d.tx_hash, d.status, 
                  d.confirmations, d.detected_at, d.confirmed_at, d.swept_at, d.created_at
           FROM deposits d
           JOIN networks n ON d.network_id = n.id
           JOIN assets a ON d.asset_id = a.id
           WHERE d.user_id = $1
           ORDER BY d.created_at DESC
           LIMIT $2 OFFSET $3`,
          [user.id, limit, offset]
        );

        return { deposits };
      },
      {
        query: t.Object({
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
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

        const ip_address = request.headers.get('x-forwarded-for') || undefined;
        const user_agent = request.headers.get('user-agent') || undefined;

        const withdrawal = await withdrawalService.createWithdrawal({
          user_id: user.id,
          chain_code: body.chain_code,
          token_symbol: body.token_symbol,
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
      },
      {
        body: t.Object({
          chain_code: t.String(),
          token_symbol: t.String(),
          amount: t.String(),
          destination_address: t.String(),
        }),
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

        const limit = query.limit ? parseInt(query.limit, 10) : 50;
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
          status: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
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

        await withdrawalService.cancelWithdrawal(user.id, params.id);
        return { message: 'Withdrawal cancelled' };
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    )

    /**
     * Validate address
     */
    .post(
      '/validate-address',
      async ({ body, hdWallet }) => {
        const result = hdWallet.validateAddress(body.address);
        return result;
      },
      {
        body: t.Object({
          address: t.String(),
        }),
      }
    );
}

/**
 * Create admin wallet routes
 */
export function createAdminWalletRoutes(
  db: DatabaseService,
  hdWallet: HDWalletService,
  withdrawalService: WithdrawalService,
  sweeperService: SweeperService
) {
  return new Elysia({ prefix: '/admin/wallet' })
    .decorate('db', db)
    .decorate('hdWallet', hdWallet)
    .decorate('withdrawalService', withdrawalService)
    .decorate('sweeperService', sweeperService)

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
      };
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
      }
    )

    /**
     * Create withdrawal batch
     */
    .post(
      '/withdrawals/batch',
      async ({ body, withdrawalService, set }) => {
        const batch = await withdrawalService.createBatch(body.chain_code);
        set.status = 201;
        return { batch };
      },
      {
        body: t.Object({
          chain_code: t.String(),
        }),
      }
    )

    /**
     * Export batch for offline signing
     */
    .get(
      '/withdrawals/batch/:id/export',
      async ({ params, withdrawalService }) => {
        const exportData = await withdrawalService.exportBatch(params.id);
        return exportData;
      },
      {
        params: t.Object({
          id: t.String(),
        }),
      }
    )

    /**
     * Get pending batches
     */
    .get('/withdrawals/batches', async ({ withdrawalService }) => {
      const batches = await withdrawalService.getPendingBatches();
      return { batches };
    })

    /**
     * Submit signed transaction
     */
    .post(
      '/withdrawals/batch/:id/submit',
      async ({ params, body, withdrawalService }) => {
        const result = await withdrawalService.importAndBroadcast({
          batch_id: params.id,
          signed_tx: body.signed_tx,
          signatures: body.signatures,
        });
        return result;
      },
      {
        params: t.Object({
          id: t.String(),
        }),
        body: t.Object({
          signed_tx: t.String(),
          signatures: t.Optional(t.Array(t.String())),
        }),
      }
    )

    /**
     * Get sweeper status
     */
    .get('/sweeper/status', async ({ sweeperService }) => {
      const status = await sweeperService.getStatus();
      return status;
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
      }
    )

    /**
     * Start sweeper
     */
    .post('/sweeper/start', async ({ sweeperService }) => {
      sweeperService.start();
      return { message: 'Sweeper started' };
    })

    /**
     * Stop sweeper
     */
    .post('/sweeper/stop', async ({ sweeperService }) => {
      sweeperService.stop();
      return { message: 'Sweeper stopped' };
    })

    /**
     * Run balance reconciliation
     */
    .get('/reconciliation', async ({ db }) => {
      // Get total balances from user_balances
      const internalBalances = await db.query<{
        token_symbol: string;
        total_available: string;
        total_locked: string;
      }>(
        `SELECT a.symbol as token_symbol, 
                SUM(ub.available) as total_available,
                SUM(ub.locked) as total_locked
         FROM user_balances ub
         JOIN assets a ON ub.asset_id = a.id
         GROUP BY a.symbol
         ORDER BY a.symbol`
      );

      // Get warm wallet addresses for each chain
      const warmWallets = await db.query<{ chain_code: string; address: string }>(
        `SELECT n.code as chain_code, w.address FROM warm_wallets w JOIN networks n ON w.network_id = n.id WHERE w.is_active = TRUE`
      );

      return {
        internal_balances: internalBalances,
        warm_wallets: warmWallets,
        note: 'Compare internal balances against warm wallet on-chain balances manually',
      };
    })

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
    })

    /**
     * Add supported token
     */
    .post(
      '/tokens',
      async ({ body, db, set }) => {
        const token = await db.queryOne<any>(
          `INSERT INTO asset_networks 
           (asset_id, network_id, contract_address, decimals, is_native, min_deposit, min_withdrawal, withdrawal_fee)
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
            body.token_symbol,
            body.chain_code,
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
      },
      {
        body: t.Object({
          chain_code: t.String(),
          token_address: t.Optional(t.String()),
          token_symbol: t.String(),
          decimals: t.Number(),
          is_native: t.Optional(t.Boolean()),
          min_deposit: t.Optional(t.String()),
          min_withdrawal: t.Optional(t.String()),
          withdrawal_fee: t.Optional(t.String()),
        }),
      }
    )

    /**
     * Configure warm wallet
     */
    .post(
      '/warm-wallets',
      async ({ body, db, set }) => {
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
            body.chain_code,
            body.address,
            body.wallet_type,
            body.required_signatures,
            body.total_signers,
          ]
        );
        set.status = 201;
        return { wallet };
      },
      {
        body: t.Object({
          chain_code: t.String(),
          address: t.String(),
          wallet_type: t.String(),
          required_signatures: t.Number(),
          total_signers: t.Number(),
        }),
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
    })

    /**
     * Get audit logs
     */
    .get(
      '/audit-logs',
      async ({ db, query }) => {
        const limit = query.limit ? parseInt(query.limit, 10) : 100;
        const offset = query.offset ? parseInt(query.offset, 10) : 0;

        let sql = `SELECT * FROM balance_transactions`;
        const params: any[] = [];

        if (query.user_id) {
          sql += ` WHERE user_id = $1`;
          params.push(query.user_id);
        }

        sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
        params.push(limit, offset);

        const logs = await db.query<any>(sql, params);
        return { logs };
      },
      {
        query: t.Object({
          user_id: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
      }
    );
}
