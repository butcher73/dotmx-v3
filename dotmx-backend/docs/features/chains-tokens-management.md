# Chains and Tokens Management Feature

This feature adds comprehensive blockchain chain and token management capabilities to the Alfred admin panel.

## Overview

The system now supports:
- **Multi-chain architecture**: One token can exist on multiple blockchain networks
- **Deposit/withdrawal controls**: Users can only deposit tokens on their supported chains
- **Flexible configuration**: Each token-chain pairing has independent settings for deposits, withdrawals, fees, and limits

## Database Schema

### Tables Created

#### `chains`
Stores blockchain network configurations:
- Chain metadata (code, name, chain ID)
- Network settings (RPC URL, explorer URL)
- Native currency information
- Deposit/withdrawal enablement flags
- Block confirmation requirements

#### `tokens`
Stores token information:
- Token symbol and name
- Logo and CoinGecko integration
- Stablecoin classification
- Sorting order

#### `token_chains`
Many-to-many relationship table linking tokens to chains:
- Contract address (null for native tokens)
- Decimals configuration
- Deposit limits (min/max)
- Withdrawal limits and fees
- Enable/disable flags per chain

## Backend API

### Chains Endpoints

- `GET /api/management/chains` - List all chains
- `GET /api/management/chains/:id` - Get single chain
- `POST /api/management/chains` - Create new chain
- `PATCH /api/management/chains/:id` - Update chain
- `DELETE /api/management/chains/:id` - Delete chain

### Tokens Endpoints

- `GET /api/management/tokens` - List all tokens with their chains
- `GET /api/management/tokens/:id` - Get single token with chains
- `POST /api/management/tokens` - Create new token
- `PATCH /api/management/tokens/:id` - Update token
- `DELETE /api/management/tokens/:id` - Delete token
- `POST /api/management/tokens/:id/chains` - Add chain to token
- `PATCH /api/management/tokens/:tokenId/chains/:chainId` - Update token-chain configuration
- `DELETE /api/management/tokens/:tokenId/chains/:chainId` - Remove chain from token

## Frontend Pages

### Chains Management (`/chains`)

Features:
- View all blockchain networks
- Create/edit/delete chains
- Configure chain-specific settings:
  - Network type (mainnet/testnet)
  - RPC and explorer URLs
  - Minimum confirmations
  - Deposit/withdrawal enablement
- Filter by status (active/inactive)
- Search by name or code

### Tokens Management (`/tokens`)

Features:
- View all tokens with their supported chains
- Create/edit/delete tokens
- Manage token properties:
  - Symbol, name, logo
  - CoinGecko integration
  - Stablecoin classification
- Manage chain associations:
  - Add/remove chains from tokens
  - Configure per-chain settings:
    - Contract address
    - Decimals
    - Min/max deposit amounts
    - Min/max withdrawal amounts
    - Withdrawal fees (fixed or percentage)
    - Enable/disable deposits
    - Enable/disable withdrawals

## Installation

### 1. Run Database Migration

```bash
cd dotmx-backend/scripts
./run-chains-tokens-migration.sh
```

Or manually:

```bash
psql $DATABASE_URL -f dotmx-backend/scripts/migrations/002_chains_and_tokens_management.sql
```

### 2. Restart Services

The backend services need to be restarted to load the new routes:

```bash
# Restart management server
cd dotmx-backend
npm run dev:management
# or
docker-compose restart management-server
```

### 3. Frontend

The Alfred frontend will automatically pick up the new pages. Just navigate to:
- `/chains` - Manage blockchain networks
- `/tokens` - Manage tokens and their chains

## Usage Examples

### Adding a New Chain

1. Navigate to `/chains` in Alfred
2. Click "Add Chain"
3. Fill in details:
   - Code: `ARB` (unique identifier)
   - Name: `Arbitrum One`
   - Chain ID: `42161`
   - Network Type: `mainnet`
   - RPC URL: `https://arb1.arbitrum.io/rpc`
   - Explorer URL: `https://arbiscan.io`
   - Native Currency: `ETH`
   - Decimals: `18`
4. Configure confirmations and block time
5. Enable/disable deposits and withdrawals
6. Click "Create Chain"

### Adding a Token with Multiple Chains

1. Navigate to `/tokens` in Alfred
2. Click "Add Token"
3. Fill in token details:
   - Symbol: `USDT`
   - Name: `Tether USD`
   - Logo URL: (optional)
   - CoinGecko ID: `tether`
   - Mark as stablecoin if applicable
4. Click "Create Token"
5. Click the link icon next to the token
6. Add chains:
   - Select chain (e.g., Ethereum)
   - Enter contract address: `0xdAC17F958D2ee523a2206206994597C13D831ec7`
   - Set decimals: `6`
   - Configure limits and fees
   - Click "Add Chain"
7. Repeat for other chains (Polygon, BSC, Arbitrum, etc.)

### Configuring Deposit/Withdrawal Rules

For each token-chain pairing, you can configure:

- **Min Deposit**: Minimum amount users can deposit (e.g., 10 USDT)
- **Max Deposit**: Maximum single deposit amount (optional)
- **Min Withdrawal**: Minimum withdrawal amount (e.g., 10 USDT)
- **Max Withdrawal**: Maximum single withdrawal amount (optional)
- **Withdrawal Fee**: Fixed amount or percentage
- **Deposit Enabled**: Toggle to enable/disable deposits
- **Withdrawal Enabled**: Toggle to enable/disable withdrawals

This allows you to:
- Disable expensive chains temporarily
- Set higher minimums for low-liquidity chains
- Implement different fee structures per chain

## Default Chains and Tokens

The migration includes sample data for common chains and tokens:

**Chains:**
- Ethereum (ETH)
- Polygon (MATIC)
- BNB Chain (BSC)
- Arbitrum One (ARB)
- Optimism (OP)
- Base (BASE)
- Avalanche C-Chain (AVAX)
- Fantom (FTM)

**Tokens:**
- ETH, USDT, USDC, BTC, BNB, MATIC, DAI, WBTC, AVAX, FTM

**Pre-configured Token-Chain Mappings:**
- ETH on Ethereum, Arbitrum, Optimism, Base
- USDT on Ethereum, Polygon, BSC, Arbitrum, Optimism, Base
- USDC on Ethereum, Polygon, BSC, Arbitrum, Optimism, Base, Avalanche
- DAI on Ethereum, Polygon, Arbitrum, Optimism, Base
- Native tokens (MATIC on Polygon, BNB on BSC, etc.)

## Security Considerations

1. **Admin Only**: Chain and token management is restricted to admin users through the management API
2. **Validation**: All endpoints validate input data and check for conflicts
3. **Audit Trail**: Consider logging all changes to chains and tokens for compliance
4. **Production Use**: Review and adjust default minimums/maximums before going live

## Future Enhancements

Potential improvements:
- Automatic chain detection and verification
- Integration with on-chain data for fee estimation
- Bulk import/export of configurations
- Chain health monitoring
- Automatic price feeds from CoinGecko
- Gas price tracking per chain
- Historical configuration changes

## API Integration

When implementing deposit/withdrawal logic in your exchange, query the `token_chains` table:

```sql
-- Check if deposits are enabled for a token on a specific chain
SELECT 
  tc.deposit_enabled,
  tc.min_deposit,
  tc.max_deposit,
  tc.contract_address,
  tc.decimals
FROM token_chains tc
JOIN tokens t ON tc.token_id = t.id
JOIN chains c ON tc.chain_id = c.id
WHERE t.symbol = 'USDT' 
  AND c.code = 'ETH'
  AND tc.is_active = true
  AND c.is_active = true;
```

This ensures users can only deposit tokens on chains where you've explicitly enabled support.

## Troubleshooting

### Migration fails with "relation already exists"
The migration uses `CREATE TABLE IF NOT EXISTS` and conflict handling, so it's safe to run multiple times.

### Changes not appearing in Alfred
1. Clear browser cache
2. Check that the management server restarted successfully
3. Verify the frontend is connecting to the correct management API

### Can't delete a chain
Chains with existing token associations may be protected. Remove token-chain mappings first, or keep the chain but mark it as inactive.

## Support

For issues or questions, refer to the main project documentation or contact the development team.
