# User Authentication System

Complete user authentication system for DotMX with email/password and wallet-based authentication.

## Features

### ✅ Email/Password Authentication
- User registration with email and password
- Secure password hashing using bcrypt (via Bun.password)
- Email verification tokens
- Password reset functionality
- Password change for authenticated users
- Password strength requirements (configurable)
- Account lockout after failed login attempts

### ✅ Wallet Authentication
- Sign-in with Web3 wallet (MetaMask, WalletConnect, etc.)
- Challenge-response authentication using wallet signatures
- Support for multiple blockchain networks:
  - Ethereum (ETH)
  - Polygon (MATIC)
  - Avalanche (AVAX)
  - Binance Smart Chain (BSC)
  - Arbitrum (ARB)
  - Optimism (OP)
  - Bitcoin (BTC)
  - Solana (SOL)
- Link multiple wallets to one account
- Primary wallet designation
- Wallet-only accounts (no email required)

### ✅ VerexBase Integration
- Integration with VerexBase wallet management platform
- Automatic detection of VerexBase vaults
- Support for VerexBase API key authentication
- Wallet address validation via VerexBase
- Transaction creation through VerexBase vaults

### ✅ JWT Token Management
- Access tokens (15 minutes expiry by default)
- Refresh tokens (7 days expiry by default)
- Session management with device tracking
- Token revocation
- Multi-device support

### ✅ API Key Authentication
- Create API keys for programmatic access
- Scope-based permissions
- Rate limiting per API key
- API key expiration
- Usage tracking (last used timestamp, IP address)

### ✅ Security Features
- Account lockout after 5 failed login attempts (30 minutes)
- Password strength validation
- Email verification
- Audit logging for all authentication events
- IP address and user agent tracking
- Session fingerprinting
- CORS configuration
- Rate limiting middleware
- SQL injection protection (parameterized queries)

### ✅ Authorization
- Role-based access control (user, admin, super_admin)
- Permission checking
- Protected routes middleware
- API key scope validation

## Database Schema

The system uses PostgreSQL with the following tables:

- **users** - User accounts with email/password
- **wallet_links** - Links between users and blockchain wallets
- **sessions** - JWT refresh token storage and session management
- **api_keys** - API keys for programmatic access
- **email_verification_tokens** - Email verification tokens
- **password_reset_tokens** - Password reset tokens
- **wallet_auth_challenges** - Wallet signature challenges
- **auth_audit_logs** - Comprehensive audit trail

See [`packages/shared/src/db/schema.sql`](../packages/shared/src/db/schema.sql) for complete schema.

## API Endpoints

### Authentication

#### Register with Email
```http
POST /auth/register
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "username": "johndoe"
}
```

#### Login with Email
```http
POST /auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "device_name": "Chrome on MacOS",
  "device_fingerprint": "unique-device-id"
}
```

Response:
```json
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "role": "user",
    "email_verified": false
  },
  "tokens": {
    "access_token": "eyJhbGc...",
    "refresh_token": "random-token",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

#### Refresh Token
```http
POST /auth/refresh
Content-Type: application/json

{
  "refresh_token": "your-refresh-token"
}
```

#### Logout
```http
POST /auth/logout
Content-Type: application/json

{
  "refresh_token": "your-refresh-token"
}
```

### Wallet Authentication

#### Get Wallet Challenge
```http
POST /auth/wallet/challenge
Content-Type: application/json

{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "chain_code": "ETH"
}
```

Response:
```json
{
  "challenge_message": "Sign this message to authenticate with DotMX\n\nWallet: 0x742d...\nNonce: abc123...\n...",
  "nonce": "abc123...",
  "expires_at": "2024-01-20T12:00:00Z"
}
```

#### Verify Wallet Signature
```http
POST /auth/wallet/verify
Content-Type: application/json

{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "chain_code": "ETH",
  "nonce": "abc123...",
  "signature": "0x1234...",
  "device_name": "MetaMask"
}
```

### User Profile

#### Get Current User
```http
GET /auth/me
Authorization: Bearer <access_token>
```

#### Update Profile
```http
PATCH /auth/me
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "first_name": "Jane",
  "avatar_url": "https://example.com/avatar.jpg"
}
```

### Wallet Management

#### List Wallets
```http
GET /auth/wallets
Authorization: Bearer <access_token>
```

#### Link Wallet
```http
POST /auth/wallets/link
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "chain_code": "ETH",
  "signature": "0x1234...",
  "nonce": "abc123...",
  "is_primary": true
}
```

#### Unlink Wallet
```http
DELETE /auth/wallets/:id
Authorization: Bearer <access_token>
```

### API Keys

#### List API Keys
```http
GET /auth/api-keys
Authorization: Bearer <access_token>
```

#### Create API Key
```http
POST /auth/api-keys
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "name": "Production API Key",
  "scopes": ["trading.read", "trading.write", "market.read"],
  "rate_limit_per_minute": 100,
  "expires_in_days": 90
}
```

Response:
```json
{
  "api_key": "dmx_abc123...",
  "key": {
    "id": "uuid",
    "key_prefix": "dmx_abc123...",
    "name": "Production API Key",
    "scopes": ["trading.read", "trading.write", "market.read"]
  },
  "message": "Save this API key. It will not be shown again."
}
```

#### Use API Key
```http
GET /api/v1/orders
X-API-Key: dmx_abc123...
```

Or as query parameter:
```http
GET /api/v1/orders?apikey=dmx_abc123...
```

### Password Management

#### Request Password Reset
```http
POST /auth/password/reset/request
Content-Type: application/json

{
  "email": "user@example.com"
}
```

#### Reset Password
```http
POST /auth/password/reset/verify
Content-Type: application/json

{
  "token": "reset-token-from-email",
  "new_password": "NewSecurePass123!"
}
```

#### Change Password (Authenticated)
```http
POST /auth/password/change
Authorization: Bearer <access_token>
Content-Type: application/json

{
  "old_password": "OldPassword123!",
  "new_password": "NewPassword123!"
}
```

## Environment Variables

Add these to your `.env` file:

```env
# Authentication & Security
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_ACCESS_EXPIRY=900 # 15 minutes in seconds
JWT_REFRESH_EXPIRY=604800 # 7 days in seconds
PASSWORD_MIN_LENGTH=8
PASSWORD_REQUIRE_UPPERCASE=true
PASSWORD_REQUIRE_LOWERCASE=true
PASSWORD_REQUIRE_NUMBER=true
PASSWORD_REQUIRE_SPECIAL=true
MAX_FAILED_LOGIN_ATTEMPTS=5
ACCOUNT_LOCK_DURATION=1800 # 30 minutes in seconds

# VerexBase Integration
VEREXBASE_API_URL=https://api.verexbase.com
VEREXBASE_API_KEY=your-verexbase-api-key-here
VEREXBASE_TIMEOUT=30000 # milliseconds

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:8080
CORS_CREDENTIALS=true

# Rate Limiting
RATE_LIMIT_MAX=100 # requests per window
RATE_LIMIT_WINDOW=60 # seconds
```

## Setup

### 1. Install Dependencies

```bash
cd dotmx-backend
pnpm install
```

### 2. Create Database

```bash
createdb dotmx
```

### 3. Run Migrations

```bash
psql -d dotmx -f packages/shared/src/db/schema.sql
```

### 4. Configure Environment

Copy `.env.example` to `.env` and update the values:

```bash
cp .env.example .env
# Edit .env and set JWT_SECRET and other values
```

### 5. Start Services

```bash
# Start PostgreSQL, Redis, NATS (via Docker Compose)
docker-compose up -d postgres redis nats

# Start API server
pnpm dev:api
```

## Usage Example

### TypeScript/JavaScript

```typescript
import { 
  DatabaseService, 
  AuthService, 
  WalletAuthService,
  VerexBaseService 
} from '@dotmx/shared/auth';

// Initialize services
const db = new DatabaseService({
  connection_string: process.env.DATABASE_URL!,
});

const authService = new AuthService(db, {
  jwt_secret: process.env.JWT_SECRET!,
  jwt_access_expiry: 900, // 15 minutes
  jwt_refresh_expiry: 604800, // 7 days
});

const verexbaseService = new VerexBaseService({
  api_url: process.env.VEREXBASE_API_URL!,
  api_key: process.env.VEREXBASE_API_KEY!,
});

const walletAuthService = new WalletAuthService(
  db,
  authService,
  verexbaseService
);

// Register user
const { user, tokens } = await authService.register({
  email: 'user@example.com',
  password: 'SecurePass123!',
  first_name: 'John',
  last_name: 'Doe',
});

// Login
const result = await authService.login({
  email: 'user@example.com',
  password: 'SecurePass123!',
});

// Wallet authentication
const challenge = await walletAuthService.createChallenge({
  wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  chain_code: 'ETH',
});

// User signs the challenge with their wallet...

const walletResult = await walletAuthService.verifyAndAuthenticate({
  wallet_address: '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb',
  chain_code: 'ETH',
  nonce: challenge.nonce,
  signature: '0x1234...',
});
```

### Protected Routes

```typescript
import { Elysia } from 'elysia';
import { authPlugin, getUser } from '@dotmx/shared/auth';

const app = new Elysia()
  .use(authPlugin(db, authService))
  .get('/protected', ({ user }) => {
    const currentUser = getUser({ user });
    return { message: `Hello ${currentUser.email}!` };
  }, {
    beforeHandle: ({ user, set }) => {
      if (!user) {
        set.status = 401;
        throw new Error('Authentication required');
      }
    }
  });
```

## Security Best Practices

1. **Always use HTTPS in production** - JWT tokens should never be sent over HTTP
2. **Rotate JWT secrets regularly** - Update JWT_SECRET periodically
3. **Use strong passwords** - Enforce password requirements
4. **Enable email verification** - Verify user email addresses
5. **Implement 2FA** - Add two-factor authentication for sensitive operations
6. **Monitor audit logs** - Review auth_audit_logs regularly
7. **Set up rate limiting** - Protect against brute force attacks
8. **Use Kong API Gateway** - Add additional security layer
9. **Sanitize inputs** - Validate all user inputs
10. **Keep dependencies updated** - Regularly update packages

## VerexBase Integration

The system integrates with [VerexBase](https://verexbase.com) for enterprise-grade wallet management:

- **Automatic Vault Detection** - Detects if a wallet is managed by VerexBase
- **Transaction Creation** - Create transactions through VerexBase vaults
- **Multi-chain Support** - Supports all chains available in VerexBase
- **API Key Authentication** - Uses VerexBase API keys for secure access

To enable VerexBase integration:

1. Sign up at [VerexBase](https://verexbase.com)
2. Create an API key in the VerexBase dashboard
3. Add the API key to your `.env`:
   ```env
   VEREXBASE_API_KEY=your-api-key-here
   ```

## Testing

```bash
# Run auth tests
bun test packages/shared/src/services/*.test.ts

# Test registration
curl -X POST http://localhost:8080/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'

# Test login
curl -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"Test123!"}'
```

## Troubleshooting

### Database Connection Issues
- Ensure PostgreSQL is running: `docker-compose ps postgres`
- Check DATABASE_URL in `.env`
- Verify database exists: `psql -l`

### JWT Token Errors
- Verify JWT_SECRET is set in `.env`
- Check token expiry times
- Ensure clocks are synchronized (for distributed systems)

### Wallet Signature Verification Fails
- Ensure the challenge message matches exactly
- Verify the wallet address is correct
- Check that the signature is valid hex string
- Ensure the nonce hasn't expired

### API Key Not Working
- Verify the API key is active
- Check that the API key hasn't expired
- Ensure the API key has the required scopes
- Verify the header name is `X-API-Key`

## License

Proprietary - DotMX Exchange
