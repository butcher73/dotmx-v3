/**
 * Assets Routes
 * API endpoints for deposits, withdrawals, and balance management
 * Uses internal HD wallet system for address generation
 */

import { Elysia, t } from 'elysia';
import { DatabaseService, HDWalletService, AlchemyWebhookService } from '@dotmx/shared';
import { AuthService } from '@dotmx/shared/auth';

/**
 * Simple address validation based on chain type
 */
function validateAddress(address: string, chainType: string): { is_valid: boolean; checksum_address?: string } {
  if (!address || address.length < 10) {
    return { is_valid: false };
  }

  switch (chainType) {
    case 'EVM':
      // Basic EVM address validation (0x + 40 hex chars)
      const evmValid = /^0x[a-fA-F0-9]{40}$/.test(address);
      return { is_valid: evmValid, checksum_address: evmValid ? address.toLowerCase() : undefined };
    case 'BTC':
      // Basic Bitcoin address validation (Legacy P2PKH, P2SH, Bech32)
      const btcValid = /^(1|3|bc1)[a-zA-HJ-NP-Z0-9]{25,62}$/.test(address);
      return { is_valid: btcValid, checksum_address: address };
    case 'DOGE':
      // Dogecoin addresses start with D or A (P2SH), 25-34 chars base58
      const dogeValid = /^[DA][1-9A-HJ-NP-Za-km-z]{24,33}$/.test(address);
      return { is_valid: dogeValid, checksum_address: address };
    case 'SOL':
      // Basic Solana address validation (base58, 32-44 chars)
      const solValid = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address);
      return { is_valid: solValid, checksum_address: address };
    case 'TRON':
      // TRON addresses start with T, 34 chars base58
      const tronValid = /^T[1-9A-HJ-NP-Za-km-z]{33}$/.test(address);
      return { is_valid: tronValid, checksum_address: address };
    default:
      return { is_valid: address.length >= 20, checksum_address: address };
  }
}

interface User {
  id: string;
  email?: string;
  role: string;
}

interface AssetWithNetwork {
  id: string;
  symbol: string;
  name: string;
  asset_type: string;
  decimals: number;
  is_stablecoin: boolean;
  networks: Array<{
    network_code: string;
    network_name: string;
    chain_type: string;
    chain_id: number | null;
    contract_address: string | null;
    deposit_enabled: boolean;
    withdrawal_enabled: boolean;
    withdrawal_fee: string;
    min_withdrawal: string;
    confirmations_required: number;
  }>;
}

interface UserBalance {
  asset_id: string;
  symbol: string;
  name: string;
  available: string;
  locked: string;
  pending: string;
  total: string;
  usd_value?: string;
}

interface DepositAddress {
  address: string;
  network_code: string;
  network_name: string;
  chain_type: string;
  qr_data: string;
  memo?: string;
  warning?: string;
}

interface Transaction {
  id: string;
  tx_type: string;
  asset_symbol: string;
  amount: string;
  fee: string;
  status: string;
  tx_hash?: string;
  network_code?: string;
  created_at: string;
  confirmed_at?: string;
}

function getUser(context: { user: User | null }): User {
  if (!context.user) {
    throw new Error('User not authenticated');
  }
  return context.user;
}

export function createAssetRoutes(
  db: DatabaseService, 
  authService: AuthService, 
  hdWalletService?: HDWalletService | null,
  alchemyWebhookService?: AlchemyWebhookService | null
) {
  return new Elysia({ prefix: '/assets' })
    .decorate('db', db)
    .decorate('hdWallet', hdWalletService)
    .decorate('alchemyWebhook', alchemyWebhookService)
    .derive(async ({ headers, db, ...ctx }) => {
      // Support API key auth (set by apiKeyPlugin upstream)
      const apiKeyUser = (ctx as any).api_key_user;
      if (apiKeyUser) return { user: apiKeyUser };

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

    // =========================================================================
    // SUPPORTED ASSETS & NETWORKS
    // =========================================================================

    /**
     * Get list of supported assets with their networks
     */
    .get(
      '/supported',
      async () => {
        const assets = await db.query<AssetWithNetwork>(
          `SELECT 
             t.id,
             t.symbol,
             t.name,
             t.asset_type,
             t.decimals,
             t.is_stablecoin,
             t.logo_url as icon_url,
             COALESCE(
               json_agg(
                 json_build_object(
                   'network_code', c.code,
                   'network_name', c.name,
                   'chain_type', c.chain_type,
                   'chain_id', c.chain_id,
                   'contract_address', tc.contract_address,
                   'deposit_enabled', c.deposit_enabled,
                   'withdrawal_enabled', c.withdrawal_enabled,
                   'withdrawal_fee', COALESCE(tc.withdrawal_fee::text, '0'),
                   'min_withdrawal', COALESCE(tc.min_withdrawal::text, '0'),
                   'confirmations_required', c.min_confirmations
                 ) ORDER BY c.sort_order
               ) FILTER (WHERE tc.is_active = TRUE AND c.is_active = TRUE), '[]'
             ) as networks
           FROM assets t
           LEFT JOIN asset_networks tc ON t.id = tc.asset_id
           LEFT JOIN networks c ON tc.network_id = c.id
           GROUP BY t.id, t.symbol, t.name, t.asset_type, t.decimals, t.is_stablecoin, t.logo_url
           ORDER BY t.sort_order, t.symbol`
        );

        return { assets };
      }
    )

    /**
     * Get newly listed assets (sorted by listing date, newest first)
     */
    .get(
      '/new-listings',
      async ({ query }) => {
        const limit = Math.min(query.limit || 3, 10);
        
        const assets = await db.query(
          `SELECT 
             t.id,
             t.symbol,
             t.name,
             t.asset_type,
             t.decimals,
             t.is_stablecoin,
             t.logo_url as icon_url,
             t.created_at as listed_at,
             COALESCE(
               json_agg(
                 json_build_object(
                   'network_code', c.code,
                   'network_name', c.name,
                   'chain_type', c.chain_type,
                   'deposit_enabled', c.deposit_enabled,
                   'withdrawal_enabled', c.withdrawal_enabled
                 )
               ) FILTER (WHERE c.is_active = TRUE), '[]'
             ) as networks
           FROM assets t
           LEFT JOIN asset_networks tc ON t.id = tc.asset_id
           LEFT JOIN networks c ON tc.network_id = c.id
           GROUP BY t.id
           ORDER BY t.created_at DESC
           LIMIT $1`,
          [limit]
        );

        return { assets };
      },
      {
        query: t.Object({
          limit: t.Optional(t.Number({ minimum: 1, maximum: 10 }))
        })
      }
    )

    /**
     * Get list of supported networks
     */
    .get(
      '/networks',
      async () => {
        const networks = await db.query(
          `SELECT 
             id, code, name, 
             chain_type, 
             chain_id, 
             native_symbol, 
             native_decimals, 
             min_confirmations as confirmations_required, 
             explorer_url, 
             icon_url
           FROM networks 
           WHERE is_active = TRUE
           ORDER BY sort_order, name`
        );

        return { networks };
      }
    )

    /**
     * Get deposit-enabled tokens with their chains
     * Uses the assets/asset_networks/networks tables (admin panel data)
     * Only returns tokens that have at least one active, deposit-enabled network
     */
    .get(
      '/deposit-tokens',
      async () => {
        // First, get all chains with deposit enabled to know which tokens have valid networks
        const depositableChains = await db.query<{
          token_id: string;
          chain_code: string;
          chain_name: string;
          chain_id: number;
          contract_address: string | null;
          decimals: number;
          is_native: boolean;
          deposit_enabled: boolean;
          withdrawal_enabled: boolean;
          min_deposit: string;
          min_withdrawal: string;
          withdrawal_fee: string;
          explorer_url: string | null;
        }>(
          `SELECT 
            tc.asset_id as token_id,
            c.code as chain_code,
            c.name as chain_name,
            c.chain_id,
            tc.contract_address,
            tc.decimals,
            tc.is_native,
            tc.deposit_enabled,
            tc.withdrawal_enabled,
            tc.min_deposit,
            tc.min_withdrawal,
            tc.withdrawal_fee,
            c.explorer_url
          FROM asset_networks tc
          JOIN networks c ON tc.network_id = c.id
          WHERE tc.is_active = TRUE
            AND c.is_active = TRUE
            AND tc.deposit_enabled = TRUE
            AND c.deposit_enabled = TRUE
          ORDER BY c.sort_order ASC`
        );

        if (depositableChains.length === 0) {
          return { assets: [] };
        }

        // Get unique token IDs that have deposit-enabled chains
        const tokenIds = [...new Set(depositableChains.map(c => c.token_id))];
        const placeholders = tokenIds.map((_, i) => `$${i + 1}`).join(',');

        // Get token details only for tokens with deposit-enabled chains
        const tokens = await db.query<{
          id: string;
          symbol: string;
          name: string;
          logo_url: string | null;
          is_stablecoin: boolean;
        }>(
          `SELECT id, symbol, name, logo_url, is_stablecoin
           FROM assets
           WHERE id IN (${placeholders})
           ORDER BY sort_order ASC, symbol ASC`,
          tokenIds
        );

        // Map tokens with their deposit-enabled networks
        const assets = tokens.map(t => ({
          symbol: t.symbol,
          name: t.name,
          asset_type: 'crypto' as const,
          icon_url: t.logo_url,
          decimal_places: 18,
          is_active: true,
          is_stablecoin: t.is_stablecoin,
          networks: depositableChains
            .filter(c => c.token_id === t.id)
            .map(c => ({
              network_code: c.chain_code,
              network_name: c.chain_name,
              chain_id: c.chain_id,
              contract_address: c.contract_address,
              decimal_places: c.decimals,
              is_native: c.is_native,
              deposit_enabled: c.deposit_enabled,
              withdrawal_enabled: c.withdrawal_enabled,
              min_deposit: c.min_deposit,
              min_withdrawal: c.min_withdrawal,
              withdrawal_fee: c.withdrawal_fee,
              explorer_url: c.explorer_url,
            })),
        }));

        return { assets };
      },
      {
        detail: {
          tags: ['assets'],
          summary: 'Get deposit-enabled tokens',
          description: 'Returns tokens with their chain configurations for deposits',
        }
      }
    )

    // =========================================================================
    // USER BALANCES
    // =========================================================================

    /**
     * Get user's balances for all assets
     */
    .get(
      '/balances',
      async ({ user }) => {
        const currentUser = getUser({ user });

        const balances = await db.query<UserBalance>(
          `SELECT 
             ub.asset_id,
             t.symbol as asset_symbol,
             t.name as asset_name,
             t.asset_type,
             t.is_stablecoin,
             t.logo_url as icon_url,
             t.decimals,
             COALESCE(ub.available, 0)::text as available,
             COALESCE(ub.locked, 0)::text as locked,
             '0' as pending,
             (COALESCE(ub.available, 0) + COALESCE(ub.locked, 0))::text as total
           FROM assets t
           LEFT JOIN user_balances ub ON t.id = ub.asset_id AND ub.user_id = $1
           ORDER BY 
             CASE WHEN COALESCE(ub.available, 0) + COALESCE(ub.locked, 0) > 0 THEN 0 ELSE 1 END,
             t.sort_order,
             t.symbol`,
          [currentUser.id]
        );

        // Calculate totals
        const totalUsdValue = balances.reduce((sum, b) => {
          // In production, fetch prices and calculate USD value
          return sum + parseFloat(b.total || '0');
        }, 0);

        return { 
          balances,
          summary: {
            total_usd_value: totalUsdValue.toFixed(2),
            assets_count: balances.filter(b => parseFloat(b.total) > 0).length,
          }
        };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Get balance for a specific asset
     */
    .get(
      '/balances/:symbol',
      async ({ params, user }) => {
        const currentUser = getUser({ user });

        const balance = await db.queryOne<UserBalance>(
          `SELECT 
             ub.asset_id,
             t.symbol,
             t.name,
             t.logo_url as icon_url,
             18 as decimals,
             COALESCE(ub.available, 0)::text as available,
             COALESCE(ub.locked, 0)::text as locked,
             '0' as pending,
             (COALESCE(ub.available, 0) + COALESCE(ub.locked, 0))::text as total
           FROM assets t
           LEFT JOIN user_balances ub ON t.id = ub.asset_id AND ub.user_id = $1
           WHERE t.symbol = $2`,
          [currentUser.id, params.symbol.toUpperCase()]
        );

        if (!balance) {
          throw new Error(`Asset not found: ${params.symbol}`);
        }

        return { balance };
      },
      {
        params: t.Object({
          symbol: t.String(),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    // =========================================================================
    // DEPOSIT ADDRESSES
    // =========================================================================

    /**
     * Get deposit address for a specific token on a specific network
     * URL: GET /assets/:symbol/deposit-address/:networkCode
     * 
     * IMPORTANT: For EVM chains, the SAME address is returned for all tokens.
     * One address per user per chain receives ALL tokens on that chain.
     * The token validation ensures the token exists and is supported on the network.
     */
    .get(
      '/:symbol/deposit-address/:networkCode',
      async ({ params, user, hdWallet, alchemyWebhook, set }) => {
        const currentUser = getUser({ user });
        const tokenSymbol = params.symbol.toUpperCase();
        const networkCode = params.networkCode.toUpperCase();

        // Validate token exists and is active
        const token = await db.queryOne<{
          id: string;
          symbol: string;
          name: string;
        }>(
          `SELECT id, symbol, name FROM assets WHERE symbol = $1 AND is_active = TRUE`,
          [tokenSymbol]
        );

        if (!token) {
          set.status = 404;
          return {
            error: 'NOT_FOUND',
            message: `Asset not found: ${tokenSymbol}`,
          };
        }

        // Check if chain exists and supports deposits
        const chain = await db.queryOne<{
          id: string;
          code: string;
          name: string;
          chain_id: number | null;
          native_symbol: string;
          deposit_enabled: boolean;
          explorer_url: string | null;
        }>(
          `SELECT id, code, name, chain_id, native_symbol, deposit_enabled, explorer_url
           FROM networks 
           WHERE code = $1 AND is_active = TRUE`,
          [networkCode]
        );

        if (!chain) {
          set.status = 404;
          return {
            error: 'NOT_FOUND',
            message: `Network not supported: ${networkCode}`,
          };
        }

        if (!chain.deposit_enabled) {
          set.status = 400;
          return {
            error: 'DEPOSITS_DISABLED',
            message: `Deposits are currently disabled for ${chain.name}`,
          };
        }

        // Validate token is available on this network and get contract address
        const tokenChain = await db.queryOne<{
          is_active: boolean;
          deposit_enabled: boolean;
          contract_address: string | null;
          is_native: boolean;
        }>(
          `SELECT tc.is_active, tc.deposit_enabled, tc.contract_address, tc.is_native
           FROM asset_networks tc
           WHERE tc.asset_id = $1 AND tc.network_id = $2 AND tc.is_active = TRUE`,
          [token.id, chain.id]
        );

        if (!tokenChain || !tokenChain.deposit_enabled) {
          set.status = 400;
          return {
            error: 'TOKEN_NOT_AVAILABLE',
            message: `${token.symbol} deposits are not available on ${chain.name}`,
          };
        }

        // HDWalletService is REQUIRED for deposit address generation
        if (!hdWallet) {
          set.status = 503;
          return {
            error: 'WALLET_SERVICE_UNAVAILABLE',
            message: 'GCP KMS and HD Wallet must be configured to generate deposit addresses.',
          };
        }

        let isNew = false;
        let address: string;
        let createdAt: string;
        let derivationPath: string | undefined;

        try {
          // Generate/retrieve address for this user and chain
          // NOTE: For EVM chains, this returns the SAME address for all tokens on that chain
          const depositAddress = await hdWallet.getOrCreateDepositAddress({
            user_id: currentUser.id,
            chain_code: networkCode,
          });
          
          address = depositAddress.address;
          createdAt = typeof depositAddress.created_at === 'string' 
            ? depositAddress.created_at 
            : depositAddress.created_at.toISOString();
          derivationPath = depositAddress.derivation_path;
          isNew = depositAddress.is_new;
          
          console.log(`[HDWallet] Address for user ${currentUser.id} on ${networkCode}: ${address} (isNew: ${isNew}, token: ${tokenSymbol})`);
          
          // Always register with Alchemy webhook (handles deduplication)
          if (alchemyWebhook) {
            alchemyWebhook.addAddresses(networkCode, [address])
              .then(ok => ok && console.log(`[Alchemy] Address ${address} registered on ${networkCode}`))
              .catch(err => console.error(`[Alchemy] Failed to register address:`, err));
          }
        } catch (error) {
          console.error(`[HDWallet] Error generating address:`, error);
          set.status = 500;
          return {
            error: 'ADDRESS_GENERATION_FAILED',
            message: `Failed to generate deposit address: ${(error as Error).message}`,
          };
        }

        // Determine if this is an EVM chain (same address for all tokens)
        const isEVM = chain.chain_id !== null;

        return {
          address: {
            address,
            network_code: chain.code,
            network_name: chain.name,
            token_symbol: token.symbol,
            token_name: token.name,
            token_contract_address: tokenChain.contract_address,
            is_native_token: tokenChain.is_native,
            explorer_url: chain.explorer_url,
            qr_data: address,
            created_at: createdAt,
            derivation_path: derivationPath,
            is_evm: isEVM,
            warning: isEVM
              ? `This address receives ALL tokens on ${chain.name}. You can send ${token.symbol}, USDT, USDC, or any other ${chain.name} token to this address.`
              : `Only send ${token.symbol} on ${chain.name} to this address. Sending other tokens or from other networks will result in loss.`,
          },
          is_new: isNew,
          message: isNew 
            ? `New deposit address generated for ${chain.name}${isEVM ? ' (receives all tokens)' : ''}`
            : `Existing deposit address retrieved for ${chain.name}${isEVM ? ' (receives all tokens)' : ''}`,
        };
      },
      {
        params: t.Object({
          symbol: t.String(),
          networkCode: t.String(),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            return {
              error: 'UNAUTHORIZED',
              message: 'Authentication required',
            };
          }
        },
      }
    )

    /**
     * Get deposit address for a specific network (with optional token validation via query param)
     * URL: GET /assets/deposit-address/:networkCode?token=SYMBOL
     * Alternative endpoint supporting query parameter format
     */
    .get(
      '/deposit-address/:networkCode',
      async ({ params, query, user, hdWallet, alchemyWebhook, set }) => {
        const currentUser = getUser({ user });
        const networkCode = params.networkCode.toUpperCase();
        const tokenSymbol = query.token?.toUpperCase();

        // Optional: Validate token if provided
        let token: { id: string; symbol: string; name: string } | null = null;
        if (tokenSymbol) {
          token = await db.queryOne<{
            id: string;
            symbol: string;
            name: string;
          }>(
            `SELECT id, symbol, name FROM assets WHERE symbol = $1 AND is_active = TRUE`,
            [tokenSymbol]
          );

          if (!token) {
            set.status = 404;
            return {
              error: 'NOT_FOUND',
              message: `Asset not found: ${tokenSymbol}`,
            };
          }
        }

        // Check if chain exists and supports deposits (using new schema)
        const chain = await db.queryOne<{
          id: string;
          code: string;
          name: string;
          native_symbol: string;
          deposit_enabled: boolean;
        }>(
          `SELECT id, code, name, native_symbol, deposit_enabled 
           FROM networks 
           WHERE code = $1 AND is_active = TRUE`,
          [networkCode]
        );

        if (!chain) {
          set.status = 404;
          return {
            error: 'NOT_FOUND',
            message: `Network not supported: ${networkCode}`,
          };
        }

        if (!chain.deposit_enabled) {
          set.status = 400;
          return {
            error: 'DEPOSITS_DISABLED',
            message: `Deposits are currently disabled for ${chain.name}`,
          };
        }

        // If token is specified, validate it's available on this network
        if (token) {
          const tokenChain = await db.queryOne<{
            is_active: boolean;
            deposit_enabled: boolean;
          }>(
            `SELECT tc.is_active, tc.deposit_enabled
             FROM asset_networks tc
             JOIN networks c ON tc.network_id = c.id
             WHERE tc.asset_id = $1 AND c.id = $2 AND tc.is_active = TRUE`,
            [token.id, chain.id]
          );

          if (!tokenChain || !tokenChain.deposit_enabled) {
            set.status = 400;
            return {
              error: 'TOKEN_NOT_AVAILABLE',
              message: `${token.symbol} deposits are not available on ${chain.name}`,
            };
          }
        }

        let isNew = false;
        let address: string;
        let createdAt: string;
        let derivationPath: string | undefined;

        // HDWalletService is REQUIRED for deposit address generation
        // Both dev and prod must use real GCP KMS wallets
        if (!hdWallet) {
          set.status = 503;
          return {
            error: 'Wallet service not configured',
            message: 'GCP KMS and HD Wallet must be configured to generate deposit addresses. Please set GCP_PROJECT_ID, GCP_KMS_LOCATION, GCP_KMS_KEYRING, and GCP_KMS_KEY_NAME environment variables.',
          };
        }

        try {
          const depositAddress = await hdWallet.getOrCreateDepositAddress({
            user_id: currentUser.id,
            chain_code: networkCode,
          });
          
          address = depositAddress.address;
          createdAt = typeof depositAddress.created_at === 'string' 
            ? depositAddress.created_at 
            : depositAddress.created_at.toISOString();
          derivationPath = depositAddress.derivation_path;
          isNew = depositAddress.is_new;
          
          console.log(`[HDWallet] Generated address for user ${currentUser.id} on ${networkCode}: ${address} (isNew: ${isNew})`);
          
          // Always register with Alchemy webhook (handles deduplication)
          if (alchemyWebhook) {
            alchemyWebhook.addAddresses(networkCode, [address])
              .then(ok => ok && console.log(`[Alchemy] Address ${address} registered on ${networkCode}`))
              .catch(err => console.error(`[Alchemy] Failed to register address:`, err));
          }
        } catch (error) {
          console.error(`[HDWallet] Error generating address:`, error);
          set.status = 500;
          return {
            error: 'ADDRESS_GENERATION_FAILED',
            message: `Failed to generate deposit address: ${(error as Error).message}`,
          };
        }

        return {
          address: {
            address,
            network_code: chain.code,
            network_name: chain.name,
            ...(token && {
              token_symbol: token.symbol,
              token_name: token.name,
            }),
            qr_data: address,
            created_at: createdAt,
            derivation_path: derivationPath,
            warning: token
              ? `Only send ${token.symbol} on ${chain.name} (${chain.code}) to this address. Sending from other networks will result in loss.`
              : `Only send ${chain.name} (${chain.code}) tokens to this address. Sending from other networks will result in loss.`,
          },
          is_new: isNew,
          message: isNew 
            ? `New deposit address generated${token ? ` for ${token.symbol}` : ''} on ${chain.name}`
            : `Existing deposit address retrieved${token ? ` for ${token.symbol}` : ''} on ${chain.name}`,
        };
      },
      {
        params: t.Object({
          networkCode: t.String(),
        }),
        query: t.Object({
          token: t.Optional(t.String()),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            return {
              error: 'UNAUTHORIZED',
              message: 'Authentication required',
            };
          }
        },
      }
    )

    /**
     * Get all user's deposit addresses
     * Uses admin panel schema: deposit_addresses + chains tables
     */
    .get(
      '/deposit-addresses',
      async ({ user }) => {
        const currentUser = getUser({ user });

        const addresses = await db.query<DepositAddress>(
          `SELECT 
             da.address,
             c.code as network_code,
             c.name as network_name,
             da.created_at
           FROM deposit_addresses da
           JOIN networks c ON da.network_id = c.id
           WHERE da.user_id = $1 AND c.is_active = TRUE
           ORDER BY c.name`,
          [currentUser.id]
        );

        return { addresses };
      },
      {
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    // =========================================================================
    // WITHDRAWALS
    // =========================================================================

    /**
     * Create withdrawal request
     */
    .post(
      '/withdraw',
      async ({ body, user, request }) => {
        const currentUser = getUser({ user });

        // Validate network
        const network = await db.queryOne<{ id: string; code: string }>(
          `SELECT id, code FROM networks WHERE code = $1 AND is_active = TRUE`,
          [body.network_code.toUpperCase()]
        );

        if (!network) {
          throw new Error(`Network not supported: ${body.network_code}`);
        }

        // Validate asset
        const asset = await db.queryOne<{ id: string; symbol: string; decimals: number }>(
          `SELECT a.id, a.symbol, a.decimals
           FROM assets a
           JOIN asset_networks an ON a.id = an.asset_id
           WHERE a.symbol = $1 AND an.network_id = $2 AND an.withdrawal_enabled = TRUE`,
          [body.asset_symbol.toUpperCase(), network.id]
        );

        if (!asset) {
          throw new Error(`Asset ${body.asset_symbol} not available for withdrawal on ${body.network_code}`);
        }

        // Check user balance
        const balance = await db.queryOne<{ available: string }>(
          `SELECT available::text FROM user_balances WHERE user_id = $1 AND asset_id = $2`,
          [currentUser.id, asset.id]
        );

        const availableBalance = parseFloat(balance?.available || '0');
        const withdrawAmount = parseFloat(body.amount);

        if (withdrawAmount <= 0) {
          throw new Error('Invalid withdrawal amount');
        }

        if (withdrawAmount > availableBalance) {
          throw new Error(`Insufficient balance. Available: ${availableBalance}`);
        }

        // Validate address using internal validation
        const networkInfo = await db.queryOne<{ chain_type: string }>(
          `SELECT chain_type FROM networks WHERE id = $1`,
          [network.id]
        );
        const validation = validateAddress(body.to_address, networkInfo?.chain_type || 'EVM');
        if (!validation.is_valid) {
          throw new Error('Invalid withdrawal address');
        }

        // Check if address is whitelisted (if whitelist is enabled)
        const userSettings = await db.queryOne<{ whitelist_enabled: boolean }>(
          `SELECT whitelist_enabled FROM user_2fa WHERE user_id = $1`,
          [currentUser.id]
        );

        let isWhitelisted = true;
        let requires2FA = false;

        if (userSettings?.whitelist_enabled) {
          const whitelist = await db.queryOne(
            `SELECT id FROM withdrawal_whitelist 
             WHERE user_id = $1 AND address = $2 AND is_active = TRUE`,
            [currentUser.id, body.to_address]
          );
          isWhitelisted = !!whitelist;
        }

        // Check if 2FA is enabled
        const twoFa = await db.queryOne<{ enabled: boolean }>(
          `SELECT enabled FROM user_2fa WHERE user_id = $1`,
          [currentUser.id]
        );
        requires2FA = twoFa?.enabled || false;

        // Get withdrawal fee
        const assetNetwork = await db.queryOne<{ withdrawal_fee: string; min_withdrawal: string }>(
          `SELECT withdrawal_fee::text, min_withdrawal::text
           FROM asset_networks WHERE asset_id = $1 AND network_id = $2`,
          [asset.id, network.id]
        );

        const fee = parseFloat(assetNetwork?.withdrawal_fee || '0');
        const minWithdrawal = parseFloat(assetNetwork?.min_withdrawal || '0');

        if (withdrawAmount < minWithdrawal) {
          throw new Error(`Minimum withdrawal: ${minWithdrawal} ${asset.symbol}`);
        }

        // Lock the balance
        await db.execute(
          `SELECT lock_user_balance($1, $2, $3)`,
          [currentUser.id, asset.id, withdrawAmount]
        );

        // Create withdrawal request
        const ip = request.headers.get('x-forwarded-for') || request.headers.get('x-real-ip');
        const userAgent = request.headers.get('user-agent');

        const withdrawal = await db.queryOne<{ id: string }>(
          `INSERT INTO withdrawal_requests (
             user_id, asset_id, network_id, amount, fee, to_address,
             requires_2fa, is_2fa_verified, requires_whitelist, is_whitelisted,
             status, ip_address, user_agent
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
           RETURNING id`,
          [
            currentUser.id,
            asset.id,
            network.id,
            withdrawAmount,
            fee,
            validation.checksum_address || body.to_address,
            requires2FA,
            !requires2FA, // Auto-verified if 2FA not required
            userSettings?.whitelist_enabled || false,
            isWhitelisted,
            requires2FA ? 'pending_approval' : 'approved',
            ip,
            userAgent,
          ]
        );

        // If no 2FA required and address is whitelisted, process immediately
        if (!requires2FA && isWhitelisted) {
          // In production, queue for processing
          // await processWithdrawal(withdrawal.id);
        }

        return {
          withdrawal_id: withdrawal?.id,
          status: requires2FA ? 'pending_2fa' : 'approved',
          amount: withdrawAmount.toString(),
          fee: fee.toString(),
          net_amount: (withdrawAmount - fee).toString(),
          to_address: validation.checksum_address || body.to_address,
          requires_2fa: requires2FA,
          message: requires2FA 
            ? 'Please verify with 2FA to complete withdrawal' 
            : 'Withdrawal submitted successfully',
        };
      },
      {
        body: t.Object({
          asset_symbol: t.String(),
          network_code: t.String(),
          amount: t.String(),
          to_address: t.String(),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    /**
     * Get pending withdrawal requests
     */
    .get(
      '/withdrawals',
      async ({ user, query }) => {
        const currentUser = getUser({ user });

        const status = query.status || undefined;
        const limit = Math.min(parseInt(query.limit || '20'), 100);
        const offset = parseInt(query.offset || '0');

        const withdrawals = await db.query(
          `SELECT 
             wr.id,
             wr.amount::text,
             wr.fee::text,
             (wr.amount - wr.fee)::text as net_amount,
             wr.to_address,
             wr.status,
             wr.tx_hash,
             wr.confirmations,
             a.symbol as asset_symbol,
             n.code as network_code,
             n.name as network_name,
             wr.created_at,
             wr.completed_at,
             wr.failure_reason
           FROM withdrawal_requests wr
           JOIN assets a ON wr.asset_id = a.id
           JOIN networks n ON wr.network_id = n.id
           WHERE wr.user_id = $1 ${status ? 'AND wr.status = $4' : ''}
           ORDER BY wr.created_at DESC
           LIMIT $2 OFFSET $3`,
          status 
            ? [currentUser.id, limit, offset, status]
            : [currentUser.id, limit, offset]
        );

        return { withdrawals };
      },
      {
        query: t.Object({
          status: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    // =========================================================================
    // TRANSACTION HISTORY
    // =========================================================================

    /**
     * Get transaction history (deposits & withdrawals)
     * Uses the deposits and withdrawal_requests tables from the custodial wallet migration
     */
    .get(
      '/transactions',
      async ({ user, query }) => {
        const currentUser = getUser({ user });

        const txType = query.type || undefined;
        const limit = Math.min(parseInt(query.limit || '50'), 200);
        const offset = parseInt(query.offset || '0');

        // Query deposits and withdrawals using UNION ALL
        let depositFilter = '';
        let withdrawalFilter = '';
        
        if (txType === 'deposit') {
          withdrawalFilter = 'AND 1=0'; // Exclude withdrawals
        } else if (txType === 'withdrawal') {
          depositFilter = 'AND 1=0'; // Exclude deposits
        }

        const transactions = await db.query<Transaction>(
          `SELECT * FROM (
             -- Deposits
             SELECT 
               d.id,
               'deposit' as tx_type,
               t.symbol as asset_symbol,
               d.amount::text,
               '0' as fee,
               d.status,
               d.tx_hash,
               c.code as network_code,
               d.confirmations,
               COALESCE(c.min_confirmations, 12) as required_confirmations,
               d.created_at,
               d.confirmed_at
             FROM deposits d
             JOIN assets t ON d.asset_id = t.id
             JOIN networks c ON d.network_id = c.id
             WHERE d.user_id = $1 ${depositFilter}
             
             UNION ALL
             
             -- Withdrawals
             SELECT 
               w.id,
               'withdrawal' as tx_type,
               t.symbol as asset_symbol,
               w.amount::text,
               COALESCE(w.fee, 0)::text as fee,
               w.status,
               w.tx_hash,
               c.code as network_code,
               CASE WHEN w.status = 'completed' THEN 999 ELSE 0 END as confirmations,
               1 as required_confirmations,
               w.created_at,
               w.completed_at as confirmed_at
             FROM withdrawal_requests w
             JOIN assets t ON w.asset_id = t.id
             JOIN networks c ON w.network_id = c.id
             WHERE w.user_id = $1 ${withdrawalFilter}
           ) combined
           ORDER BY created_at DESC
           LIMIT $2 OFFSET $3`,
          [currentUser.id, limit, offset]
        );

        return { transactions };
      },
      {
        query: t.Object({
          type: t.Optional(t.String()),
          limit: t.Optional(t.String()),
          offset: t.Optional(t.String()),
        }),
        beforeHandle: ({ user, set }) => {
          if (!user) {
            set.status = 401;
            throw new Error('Authentication required');
          }
        },
      }
    )

    // =========================================================================
    // INTERNAL WEBHOOK (for deposit notifications from sweeper service)
    // =========================================================================

    /**
     * Internal webhook handler for deposit notifications
     * Called by the sweeper service when deposits are detected
     */
    .post(
      '/webhook/deposit',
      async ({ body, request }) => {
        // Verify internal webhook signature
        const signature = request.headers.get('x-internal-signature');
        const expectedSignature = process.env.INTERNAL_WEBHOOK_SECRET;
        
        if (expectedSignature && signature !== expectedSignature) {
          throw new Error('Invalid webhook signature');
        }

        const event = body as {
          id: string;
          event_type: string;
          payload: Record<string, unknown>;
        };

        // Check for duplicate events
        const existing = await db.queryOne(
          'SELECT id FROM webhook_events WHERE event_id = $1',
          [event.id]
        );

        if (existing) {
          return { status: 'already_processed' };
        }

        // Store event
        await db.execute(
          `INSERT INTO webhook_events (event_id, event_type, payload, signature)
           VALUES ($1, $2, $3, $4)`,
          [event.id, event.event_type, JSON.stringify(event.payload), signature]
        );

        try {
          // Process based on event type
          switch (event.event_type) {
            case 'deposit.confirmed':
              await handleDepositConfirmed(db, event.payload);
              break;
            case 'deposit.pending':
              await handleDepositPending(db, event.payload);
              break;
            case 'withdrawal.completed':
              await handleWithdrawalCompleted(db, event.payload);
              break;
            case 'withdrawal.failed':
              await handleWithdrawalFailed(db, event.payload);
              break;
            default:
              console.log(`Unhandled webhook event: ${event.event_type}`);
          }

          // Mark as processed
          await db.execute(
            `UPDATE webhook_events SET processed = TRUE, processed_at = NOW() WHERE event_id = $1`,
            [event.id]
          );

          return { status: 'processed' };
        } catch (error) {
          await db.execute(
            `UPDATE webhook_events SET error = $1, retry_count = retry_count + 1 WHERE event_id = $2`,
            [(error as Error).message, event.id]
          );
          throw error;
        }
      },
      {
        body: t.Object({
          id: t.String(),
          event_type: t.String(),
          payload: t.Any(),
        }),
      }
    );
}

// =========================================================================
// WEBHOOK HANDLERS (Internal wallet system)
// =========================================================================

async function handleDepositConfirmed(db: DatabaseService, payload: Record<string, unknown>) {
  const { address, amount, tx_hash, token_symbol } = payload as {
    address?: string;
    amount?: string;
    tx_hash?: string;
    token_symbol?: string;
  };

  if (!address || !amount) {
    console.error('Invalid deposit confirmed payload');
    return;
  }

  // Find user by deposit address
  const depositAddress = await db.queryOne<{ user_id: string; network_id: string }>(
    `SELECT user_id, network_id FROM deposit_addresses WHERE address = $1`,
    [address]
  );

  if (!depositAddress) {
    console.error(`No user found for address: ${address}`);
    return;
  }

  // Determine asset
  let asset: { id: string } | null;
  if (token_symbol) {
    asset = await db.queryOne('SELECT id FROM assets WHERE symbol = $1', [token_symbol]);
  } else {
    // Native token
    const network = await db.queryOne<{ native_symbol: string }>(
      'SELECT native_symbol FROM networks WHERE id = $1',
      [depositAddress.network_id]
    );
    asset = await db.queryOne('SELECT id FROM assets WHERE symbol = $1', [network?.native_symbol]);
  }

  if (!asset) {
    console.error('Asset not found for deposit');
    return;
  }

  // Clear pending and add to available
  await db.execute(
    `UPDATE user_balances SET pending = GREATEST(0, pending - $1) WHERE user_id = $2 AND asset_id = $3`,
    [amount, depositAddress.user_id, asset.id]
  );

  // Update balance via function
  await db.execute(
    `SELECT update_user_balance($1, $2, $3, 'deposit', $4, $5, $6)`,
    [depositAddress.user_id, asset.id, amount, `Deposit confirmed`, tx_hash, depositAddress.network_id]
  );

  console.log(`Deposit confirmed: ${amount} ${token_symbol || 'native'} to user ${depositAddress.user_id}`);
}

async function handleDepositPending(db: DatabaseService, payload: Record<string, unknown>) {
  const { address, amount, tx_hash, confirmations } = payload as {
    address?: string;
    amount?: string;
    tx_hash?: string;
    confirmations?: number;
  };

  if (!address || !amount) return;

  const depositAddress = await db.queryOne<{ user_id: string; network_id: string }>(
    `SELECT user_id, network_id FROM deposit_addresses WHERE address = $1`,
    [address]
  );

  if (!depositAddress) return;

  const network = await db.queryOne<{ native_symbol: string; confirmations_required: number }>(
    'Select native_symbol, confirmations_required FROM networks WHERE id = $1',
    [depositAddress.network_id]
  );

  const asset = await db.queryOne<{ id: string }>(
    'SELECT id FROM assets WHERE symbol = $1',
    [network?.native_symbol]
  );

  if (!asset) return;

  // Add to pending balance
  await db.execute(
    `INSERT INTO user_balances (user_id, asset_id, pending)
     VALUES ($1, $2, $3)
     ON CONFLICT (user_id, asset_id) DO UPDATE
     SET pending = user_balances.pending + $3`,
    [depositAddress.user_id, asset.id, amount]
  );

  // Create pending ledger entry
  await db.execute(
    `INSERT INTO balance_transactions (
       user_id, asset_id, tx_type, amount, balance_before, balance_after,
       tx_hash, network_id, confirmations, required_confirmations, status
     ) VALUES ($1, $2, 'deposit_pending', $3, 0, 0, $4, $5, $6, $7, 'confirming')
     ON CONFLICT DO NOTHING`,
    [
      depositAddress.user_id,
      asset.id,
      amount,
      tx_hash,
      depositAddress.network_id,
      confirmations || 0,
      network?.confirmations_required || 12,
    ]
  );

  console.log(`Pending deposit: ${amount} for user ${depositAddress.user_id}`);
}

async function handleWithdrawalCompleted(db: DatabaseService, payload: Record<string, unknown>) {
  const { withdrawal_id, tx_hash } = payload as { withdrawal_id?: string; tx_hash?: string };

  if (!withdrawal_id) return;

  await db.execute(
    `UPDATE withdrawal_requests 
     SET status = 'completed', completed_at = NOW(), tx_hash = $1
     WHERE id = $2`,
    [tx_hash, withdrawal_id]
  );

  console.log(`Withdrawal completed: ${withdrawal_id}`);
}

async function handleWithdrawalFailed(db: DatabaseService, payload: Record<string, unknown>) {
  const { withdrawal_id, reason } = payload as { withdrawal_id?: string; reason?: string };

  if (!withdrawal_id) return;

  // Return locked funds to available
  const withdrawal = await db.queryOne<{ user_id: string; asset_id: string; amount: string }>(
    'SELECT user_id, asset_id, amount::text FROM withdrawal_requests WHERE id = $1',
    [withdrawal_id]
  );

  if (withdrawal) {
    await db.execute(
      `UPDATE user_balances 
       SET available = available + $1, locked = GREATEST(0, locked - $1)
       WHERE user_id = $2 AND asset_id = $3`,
      [withdrawal.amount, withdrawal.user_id, withdrawal.asset_id]
    );
  }

  await db.execute(
    `UPDATE withdrawal_requests 
     SET status = 'failed', failed_at = NOW(), failure_reason = $1
     WHERE id = $2`,
    [reason || 'Withdrawal failed', withdrawal_id]
  );

  console.log(`Withdrawal failed: ${withdrawal_id}`);
}

export default createAssetRoutes;
