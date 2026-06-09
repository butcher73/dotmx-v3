# Authentication API Reference

Complete API reference for DotMX authentication endpoints.

**Base URL:** `https://api.dotmx.xyz` (Production) | `http://localhost:8080` (Development)

**API Version:** v1

---

## Table of Contents

- [Authentication Overview](#authentication-overview)
- [Authentication Endpoints](#authentication-endpoints)
  - [Register](#register)
  - [Login](#login)
  - [Refresh Token](#refresh-token)
  - [Logout](#logout)
  - [Email Verification](#email-verification)
- [Wallet Authentication](#wallet-authentication)
  - [Get Challenge](#get-wallet-challenge)
  - [Verify Signature](#verify-wallet-signature)
- [User Profile](#user-profile)
  - [Get Current User](#get-current-user)
  - [Update Profile](#update-profile)
- [Wallet Management](#wallet-management)
  - [List Wallets](#list-wallets)
  - [Link Wallet](#link-wallet)
  - [Unlink Wallet](#unlink-wallet)
  - [Set Primary Wallet](#set-primary-wallet)
- [API Key Management](#api-key-management)
  - [List API Keys](#list-api-keys)
  - [Create API Key](#create-api-key)
  - [Delete API Key](#delete-api-key)
- [Session Management](#session-management)
  - [List Sessions](#list-sessions)
  - [Revoke Session](#revoke-session)
- [Password Management](#password-management)
  - [Request Reset](#request-password-reset)
  - [Reset Password](#reset-password)
  - [Change Password](#change-password)
- [Error Codes](#error-codes)

---

## Authentication Overview

DotMX supports three authentication methods:

1. **JWT Bearer Token** - Use access token in Authorization header
2. **API Key** - Use API key in X-API-Key header or query parameter
3. **Wallet Signature** - Web3 wallet authentication

### Authentication Header

```http
Authorization: Bearer <access_token>
```

### API Key Header

```http
X-API-Key: dmx_your_api_key_here
```

Or as query parameter:

```http
GET /api/v1/endpoint?apikey=dmx_your_api_key_here
```

---

## Authentication Endpoints

### Register

Register a new user account with email and password.

**Endpoint:** `POST /auth/register`

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "first_name": "John",
  "last_name": "Doe",
  "username": "johndoe"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | Valid email address |
| `password` | string | Yes | Minimum 8 characters |
| `first_name` | string | No | User's first name |
| `last_name` | string | No | User's last name |
| `username` | string | No | Unique username |

**Password Requirements:**
- Minimum 8 characters
- At least one uppercase letter
- At least one lowercase letter
- At least one number
- At least one special character

**Success Response (201 Created):**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "email_verified": false,
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe",
    "role": "user",
    "status": "active",
    "mfa_enabled": false,
    "created_at": "2026-01-25T10:00:00Z",
    "updated_at": "2026-01-25T10:00:00Z"
  },
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "a3d4b2c1e5f6g7h8i9j0k1l2m3n4o5p6",
    "token_type": "Bearer",
    "expires_in": 900
  },
  "message": "Registration successful. Please verify your email."
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `INVALID_EMAIL` | Email format is invalid |
| 400 | `WEAK_PASSWORD` | Password doesn't meet requirements |
| 409 | `EMAIL_EXISTS` | Email already registered |
| 500 | `SERVER_ERROR` | Internal server error |

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "SecurePass123!",
    "first_name": "Jane",
    "last_name": "Trader"
  }'
```

---

### Login

Authenticate with email and password.

**Endpoint:** `POST /auth/login`

**Request Body:**

```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "device_name": "Chrome on MacOS",
  "device_fingerprint": "unique-device-id"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |
| `password` | string | Yes | User's password |
| `device_name` | string | No | Friendly device name |
| `device_fingerprint` | string | No | Unique device identifier |

**Success Response (200 OK):**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "email_verified": true,
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe",
    "avatar_url": "https://example.com/avatar.jpg",
    "role": "user",
    "status": "active",
    "mfa_enabled": false,
    "last_login_at": "2026-01-25T10:00:00Z",
    "created_at": "2026-01-20T10:00:00Z",
    "updated_at": "2026-01-25T10:00:00Z"
  },
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "a3d4b2c1e5f6g7h8i9j0k1l2m3n4o5p6",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `INVALID_CREDENTIALS` | Email or password is incorrect |
| 403 | `ACCOUNT_LOCKED` | Account locked due to failed attempts |
| 403 | `ACCOUNT_SUSPENDED` | Account has been suspended |
| 500 | `SERVER_ERROR` | Internal server error |

**Rate Limiting:**
- Maximum 5 failed login attempts within 1 hour
- Account locked for 30 minutes after 5 failed attempts

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "trader@example.com",
    "password": "SecurePass123!",
    "device_name": "Chrome on MacOS"
  }'
```

---

### Refresh Token

Refresh an expired access token using a refresh token.

**Endpoint:** `POST /auth/refresh`

**Request Body:**

```json
{
  "refresh_token": "a3d4b2c1e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `refresh_token` | string | Yes | Valid refresh token |

**Success Response (200 OK):**

```json
{
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "b4e5c3d2f6g7h8i9j0k1l2m3n4o5p6q7",
    "token_type": "Bearer",
    "expires_in": 900
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `INVALID_TOKEN` | Refresh token is invalid or expired |
| 401 | `TOKEN_REVOKED` | Token has been revoked |
| 403 | `ACCOUNT_SUSPENDED` | Account has been suspended |

**Notes:**
- Refresh tokens are valid for 7 days by default
- Old refresh token is revoked after successful refresh
- New refresh token is issued with each refresh

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/refresh \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "a3d4b2c1e5f6g7h8i9j0k1l2m3n4o5p6"
  }'
```

---

### Logout

Revoke a session and invalidate the refresh token.

**Endpoint:** `POST /auth/logout`

**Request Body:**

```json
{
  "refresh_token": "a3d4b2c1e5f6g7h8i9j0k1l2m3n4o5p6"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `refresh_token` | string | Yes | Refresh token to revoke |

**Success Response (200 OK):**

```json
{
  "message": "Logged out successfully"
}
```

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/logout \
  -H "Content-Type: application/json" \
  -d '{
    "refresh_token": "a3d4b2c1e5f6g7h8i9j0k1l2m3n4o5p6"
  }'
```

---

### Email Verification

Verify user's email address using verification token.

**Endpoint:** `POST /auth/email/verify`

**Request Body:**

```json
{
  "token": "verification-token-from-email"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | Email verification token |

**Success Response (200 OK):**

```json
{
  "message": "Email verified successfully"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `INVALID_TOKEN` | Token is invalid or expired |
| 404 | `TOKEN_NOT_FOUND` | Token doesn't exist |

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/email/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123def456ghi789"
  }'
```

---

## Wallet Authentication

### Get Wallet Challenge

Get a challenge message to sign with wallet for authentication.

**Endpoint:** `POST /auth/wallet/challenge`

**Request Body:**

```json
{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "chain_code": "ETH"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wallet_address` | string | Yes | Blockchain wallet address |
| `chain_code` | string | Yes | Chain code (ETH, MATIC, BTC, SOL, etc.) |

**Supported Chains:**
- `ETH` - Ethereum
- `MATIC` - Polygon
- `AVAX` - Avalanche
- `BSC` - Binance Smart Chain
- `ARB` - Arbitrum
- `OP` - Optimism
- `BTC` - Bitcoin
- `SOL` - Solana

**Success Response (200 OK):**

```json
{
  "challenge_message": "Sign this message to authenticate with DotMX\n\nWallet: 0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb\nChain: ETH\nNonce: a1b2c3d4e5f6g7h8\nTimestamp: 2026-01-25T10:00:00Z\nExpires: 2026-01-25T10:05:00Z\n\nThis request will not trigger a blockchain transaction or cost any gas fees.",
  "nonce": "a1b2c3d4e5f6g7h8",
  "expires_at": "2026-01-25T10:05:00Z"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `INVALID_ADDRESS` | Wallet address format is invalid |
| 400 | `UNSUPPORTED_CHAIN` | Chain is not supported |

**Notes:**
- Challenge nonce expires in 5 minutes
- Each wallet address can have one active challenge at a time

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/wallet/challenge \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "chain_code": "ETH"
  }'
```

---

### Verify Wallet Signature

Verify the signed challenge and authenticate user.

**Endpoint:** `POST /auth/wallet/verify`

**Request Body:**

```json
{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "chain_code": "ETH",
  "nonce": "a1b2c3d4e5f6g7h8",
  "signature": "0x1234567890abcdef...",
  "device_name": "MetaMask",
  "device_fingerprint": "unique-device-id"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wallet_address` | string | Yes | Blockchain wallet address |
| `chain_code` | string | Yes | Chain code |
| `nonce` | string | Yes | Challenge nonce from /wallet/challenge |
| `signature` | string | Yes | Signed challenge message |
| `device_name` | string | No | Friendly device name |
| `device_fingerprint` | string | No | Unique device identifier |

**Success Response (200 OK for existing user, 201 Created for new user):**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": null,
    "email_verified": false,
    "first_name": null,
    "last_name": null,
    "username": "wallet_0x742d",
    "role": "user",
    "status": "active",
    "mfa_enabled": false,
    "created_at": "2026-01-25T10:00:00Z",
    "updated_at": "2026-01-25T10:00:00Z"
  },
  "tokens": {
    "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "refresh_token": "a3d4b2c1e5f6g7h8i9j0k1l2m3n4o5p6",
    "token_type": "Bearer",
    "expires_in": 900
  },
  "is_new_user": true
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `INVALID_SIGNATURE` | Signature verification failed |
| 400 | `CHALLENGE_EXPIRED` | Challenge nonce has expired |
| 400 | `CHALLENGE_NOT_FOUND` | Challenge not found for this wallet |

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/wallet/verify \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "chain_code": "ETH",
    "nonce": "a1b2c3d4e5f6g7h8",
    "signature": "0x1234567890abcdef...",
    "device_name": "MetaMask"
  }'
```

---

## User Profile

### Get Current User

Get authenticated user's profile information.

**Endpoint:** `GET /auth/me`

**Authentication:** Required (Bearer token)

**Success Response (200 OK):**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "email_verified": true,
    "first_name": "John",
    "last_name": "Doe",
    "username": "johndoe",
    "avatar_url": "https://example.com/avatar.jpg",
    "role": "user",
    "status": "active",
    "mfa_enabled": false,
    "last_login_at": "2026-01-25T10:00:00Z",
    "created_at": "2026-01-20T10:00:00Z",
    "updated_at": "2026-01-25T10:00:00Z"
  },
  "wallets": [
    {
      "id": "wallet-id-1",
      "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "chain_code": "ETH",
      "chain_id": 1,
      "is_primary": true,
      "verified": true,
      "created_at": "2026-01-20T10:00:00Z"
    }
  ],
  "api_keys_count": 2
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | Authentication required |
| 403 | `ACCOUNT_SUSPENDED` | Account has been suspended |

**Example:**

```bash
curl -X GET https://api.dotmx.xyz/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Update Profile

Update authenticated user's profile information.

**Endpoint:** `PATCH /auth/me`

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "first_name": "Jane",
  "last_name": "Smith",
  "username": "janesmith",
  "avatar_url": "https://example.com/new-avatar.jpg"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `first_name` | string | No | User's first name |
| `last_name` | string | No | User's last name |
| `username` | string | No | Unique username |
| `avatar_url` | string | No | Profile avatar URL |

**Success Response (200 OK):**

```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "user@example.com",
    "email_verified": true,
    "first_name": "Jane",
    "last_name": "Smith",
    "username": "janesmith",
    "avatar_url": "https://example.com/new-avatar.jpg",
    "role": "user",
    "status": "active",
    "mfa_enabled": false,
    "last_login_at": "2026-01-25T10:00:00Z",
    "created_at": "2026-01-20T10:00:00Z",
    "updated_at": "2026-01-25T10:05:00Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | Authentication required |
| 409 | `USERNAME_EXISTS` | Username is already taken |
| 400 | `INVALID_URL` | Avatar URL is invalid |

**Example:**

```bash
curl -X PATCH https://api.dotmx.xyz/auth/me \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Jane",
    "username": "janesmith"
  }'
```

---

## Wallet Management

### List Wallets

Get all linked wallets for authenticated user.

**Endpoint:** `GET /auth/wallets`

**Authentication:** Required (Bearer token)

**Success Response (200 OK):**

```json
{
  "wallets": [
    {
      "id": "wallet-id-1",
      "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
      "chain_code": "ETH",
      "chain_id": 1,
      "wallet_type": "metamask",
      "is_primary": true,
      "verified": true,
      "created_at": "2026-01-20T10:00:00Z",
      "last_used_at": "2026-01-25T10:00:00Z"
    },
    {
      "id": "wallet-id-2",
      "wallet_address": "bc1qxy2kgdygjrsqtzq2n0yrf2493p83kkfjhx0wlh",
      "chain_code": "BTC",
      "chain_id": null,
      "wallet_type": "ledger",
      "is_primary": false,
      "verified": true,
      "created_at": "2026-01-22T10:00:00Z",
      "last_used_at": "2026-01-23T10:00:00Z"
    }
  ]
}
```

**Example:**

```bash
curl -X GET https://api.dotmx.xyz/auth/wallets \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Link Wallet

Link a new wallet to authenticated user's account.

**Endpoint:** `POST /auth/wallets/link`

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
  "chain_code": "ETH",
  "chain_id": 1,
  "wallet_type": "metamask",
  "signature": "0x1234567890abcdef...",
  "nonce": "a1b2c3d4e5f6g7h8",
  "is_primary": false
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `wallet_address` | string | Yes | Blockchain wallet address |
| `chain_code` | string | Yes | Chain code |
| `chain_id` | number | No | Chain ID |
| `wallet_type` | string | No | Wallet type (metamask, ledger, etc.) |
| `signature` | string | Yes | Signed challenge message |
| `nonce` | string | Yes | Challenge nonce |
| `is_primary` | boolean | No | Set as primary wallet (default: false) |

**Success Response (201 Created):**

```json
{
  "wallet": {
    "id": "wallet-id-3",
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "chain_code": "ETH",
    "chain_id": 1,
    "wallet_type": "metamask",
    "is_primary": false,
    "verified": true,
    "created_at": "2026-01-25T10:00:00Z"
  }
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | Authentication required |
| 400 | `INVALID_SIGNATURE` | Signature verification failed |
| 409 | `WALLET_ALREADY_LINKED` | Wallet already linked to this or another account |

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/wallets/link \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
    "chain_code": "ETH",
    "signature": "0x1234567890abcdef...",
    "nonce": "a1b2c3d4e5f6g7h8"
  }'
```

---

### Unlink Wallet

Remove a linked wallet from user's account.

**Endpoint:** `DELETE /auth/wallets/:id`

**Authentication:** Required (Bearer token)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Wallet ID to unlink |

**Success Response (200 OK):**

```json
{
  "message": "Wallet unlinked successfully"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | Authentication required |
| 404 | `WALLET_NOT_FOUND` | Wallet not found or doesn't belong to user |
| 400 | `CANNOT_UNLINK_PRIMARY` | Cannot unlink primary wallet |

**Example:**

```bash
curl -X DELETE https://api.dotmx.xyz/auth/wallets/wallet-id-2 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Set Primary Wallet

Set a wallet as the primary wallet for the user.

**Endpoint:** `PUT /auth/wallets/:id/primary`

**Authentication:** Required (Bearer token)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Wallet ID to set as primary |

**Success Response (200 OK):**

```json
{
  "message": "Primary wallet updated"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | Authentication required |
| 404 | `WALLET_NOT_FOUND` | Wallet not found or doesn't belong to user |

**Example:**

```bash
curl -X PUT https://api.dotmx.xyz/auth/wallets/wallet-id-2/primary \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## API Key Management

### List API Keys

Get all API keys for authenticated user.

**Endpoint:** `GET /auth/api-keys`

**Authentication:** Required (Bearer token)

**Success Response (200 OK):**

```json
{
  "api_keys": [
    {
      "id": "key-id-1",
      "key_prefix": "dmx_abc123",
      "name": "Production API Key",
      "scopes": ["trading.read", "trading.write", "market.read"],
      "rate_limit_per_minute": 100,
      "is_active": true,
      "expires_at": "2026-04-25T10:00:00Z",
      "last_used_at": "2026-01-25T09:30:00Z",
      "created_at": "2026-01-20T10:00:00Z"
    },
    {
      "id": "key-id-2",
      "key_prefix": "dmx_def456",
      "name": "Development API Key",
      "scopes": ["market.read", "account.read"],
      "rate_limit_per_minute": 50,
      "is_active": true,
      "expires_at": null,
      "last_used_at": null,
      "created_at": "2026-01-22T10:00:00Z"
    }
  ]
}
```

**Notes:**
- Full API keys are never returned, only the prefix
- Only the user who created the key can see it in the list

**Example:**

```bash
curl -X GET https://api.dotmx.xyz/auth/api-keys \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Create API Key

Create a new API key for programmatic access.

**Endpoint:** `POST /auth/api-keys`

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "name": "Production Trading Bot",
  "scopes": ["trading.read", "trading.write", "account.read"],
  "rate_limit_per_minute": 100,
  "expires_in_days": 90
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `name` | string | Yes | Friendly name for the API key |
| `scopes` | array | Yes | Array of permission scopes |
| `rate_limit_per_minute` | number | No | Rate limit (default: 100) |
| `expires_in_days` | number | No | Expiry in days (null = never) |

**Available Scopes:**
- `trading.read` - Read trading data
- `trading.write` - Place and cancel orders
- `market.read` - Read market data
- `account.read` - Read account information
- `account.write` - Modify account settings
- `withdrawal.write` - Initiate withdrawals (requires 2FA)

**Success Response (201 Created):**

```json
{
  "api_key": "dmx_abc123def456ghi789jkl012mno345pqr678stu",
  "key": {
    "id": "key-id-3",
    "key_prefix": "dmx_abc123",
    "name": "Production Trading Bot",
    "scopes": ["trading.read", "trading.write", "account.read"],
    "rate_limit_per_minute": 100,
    "is_active": true,
    "expires_at": "2026-04-25T10:00:00Z",
    "created_at": "2026-01-25T10:00:00Z"
  },
  "message": "Save this API key. It will not be shown again."
}
```

**Important:**
- The full API key is shown **only once** during creation
- Store it securely - it cannot be retrieved again
- If lost, you must create a new API key

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | Authentication required |
| 400 | `INVALID_SCOPE` | One or more scopes are invalid |
| 429 | `TOO_MANY_KEYS` | Maximum number of API keys reached |

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/api-keys \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Trading Bot",
    "scopes": ["trading.read", "trading.write"],
    "rate_limit_per_minute": 100,
    "expires_in_days": 90
  }'
```

---

### Delete API Key

Delete an API key (revokes access immediately).

**Endpoint:** `DELETE /auth/api-keys/:id`

**Authentication:** Required (Bearer token)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | API key ID to delete |

**Success Response (200 OK):**

```json
{
  "message": "API key deleted"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | Authentication required |
| 404 | `KEY_NOT_FOUND` | API key not found or doesn't belong to user |

**Example:**

```bash
curl -X DELETE https://api.dotmx.xyz/auth/api-keys/key-id-2 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Session Management

### List Sessions

Get all active sessions for authenticated user.

**Endpoint:** `GET /auth/sessions`

**Authentication:** Required (Bearer token)

**Success Response (200 OK):**

```json
{
  "sessions": [
    {
      "id": "session-id-1",
      "device_name": "Chrome on MacOS",
      "device_fingerprint": "fingerprint-1",
      "ip_address": "192.168.1.100",
      "last_activity_at": "2026-01-25T10:00:00Z",
      "expires_at": "2026-02-01T10:00:00Z",
      "revoked": false,
      "created_at": "2026-01-25T09:00:00Z"
    },
    {
      "id": "session-id-2",
      "device_name": "Safari on iPhone",
      "device_fingerprint": "fingerprint-2",
      "ip_address": "192.168.1.101",
      "last_activity_at": "2026-01-24T18:00:00Z",
      "expires_at": "2026-01-31T18:00:00Z",
      "revoked": false,
      "created_at": "2026-01-24T17:00:00Z"
    }
  ]
}
```

**Example:**

```bash
curl -X GET https://api.dotmx.xyz/auth/sessions \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

### Revoke Session

Revoke a specific session (logout from that device).

**Endpoint:** `DELETE /auth/sessions/:id`

**Authentication:** Required (Bearer token)

**URL Parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `id` | string | Session ID to revoke |

**Success Response (200 OK):**

```json
{
  "message": "Session revoked"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | Authentication required |
| 404 | `SESSION_NOT_FOUND` | Session not found or doesn't belong to user |

**Notes:**
- Revoking a session immediately invalidates its refresh token
- The user will need to log in again on that device
- You can revoke your current session (logs yourself out)

**Example:**

```bash
curl -X DELETE https://api.dotmx.xyz/auth/sessions/session-id-2 \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
```

---

## Password Management

### Request Password Reset

Request a password reset token (sent via email).

**Endpoint:** `POST /auth/password/reset/request`

**Request Body:**

```json
{
  "email": "user@example.com"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `email` | string | Yes | User's email address |

**Success Response (200 OK):**

```json
{
  "message": "If the email exists, a password reset link has been sent."
}
```

**Notes:**
- Response is the same whether email exists or not (security)
- Reset token expires in 1 hour
- Previous reset tokens are invalidated when a new one is requested

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/password/reset/request \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com"
  }'
```

---

### Reset Password

Reset password using the token from email.

**Endpoint:** `POST /auth/password/reset/verify`

**Request Body:**

```json
{
  "token": "reset-token-from-email",
  "new_password": "NewSecurePass123!"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `token` | string | Yes | Password reset token from email |
| `new_password` | string | Yes | New password (must meet requirements) |

**Success Response (200 OK):**

```json
{
  "message": "Password reset successful"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 400 | `INVALID_TOKEN` | Token is invalid or expired |
| 400 | `WEAK_PASSWORD` | Password doesn't meet requirements |
| 404 | `TOKEN_NOT_FOUND` | Token doesn't exist |

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/password/reset/verify \
  -H "Content-Type: application/json" \
  -d '{
    "token": "abc123def456",
    "new_password": "NewSecurePass123!"
  }'
```

---

### Change Password

Change password for authenticated user.

**Endpoint:** `POST /auth/password/change`

**Authentication:** Required (Bearer token)

**Request Body:**

```json
{
  "old_password": "CurrentPassword123!",
  "new_password": "NewSecurePass123!"
}
```

**Parameters:**

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `old_password` | string | Yes | Current password |
| `new_password` | string | Yes | New password (must meet requirements) |

**Success Response (200 OK):**

```json
{
  "message": "Password changed successfully"
}
```

**Error Responses:**

| Status | Error | Description |
|--------|-------|-------------|
| 401 | `UNAUTHORIZED` | Authentication required |
| 401 | `INVALID_PASSWORD` | Current password is incorrect |
| 400 | `WEAK_PASSWORD` | New password doesn't meet requirements |
| 400 | `PASSWORD_REUSED` | New password was used recently |

**Notes:**
- All active sessions except the current one are revoked
- Password cannot be the same as the last 5 passwords
- User is notified via email about the password change

**Example:**

```bash
curl -X POST https://api.dotmx.xyz/auth/password/change \
  -H "Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..." \
  -H "Content-Type: application/json" \
  -d '{
    "old_password": "CurrentPassword123!",
    "new_password": "NewSecurePass123!"
  }'
```

---

## Error Codes

### Standard HTTP Status Codes

| Code | Status | Description |
|------|--------|-------------|
| 200 | OK | Request successful |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request parameters |
| 401 | Unauthorized | Authentication required or failed |
| 403 | Forbidden | Authenticated but not authorized |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource already exists |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Error Response Format

All errors follow this format:

```json
{
  "error": "ERROR_CODE",
  "message": "Human-readable error message",
  "details": {
    "field": "Additional context"
  }
}
```

### Authentication Error Codes

| Error Code | Description |
|------------|-------------|
| `INVALID_CREDENTIALS` | Email or password is incorrect |
| `INVALID_TOKEN` | Token is invalid or expired |
| `TOKEN_REVOKED` | Token has been revoked |
| `ACCOUNT_LOCKED` | Account locked due to failed attempts |
| `ACCOUNT_SUSPENDED` | Account has been suspended |
| `ACCOUNT_DELETED` | Account has been deleted |
| `EMAIL_EXISTS` | Email already registered |
| `USERNAME_EXISTS` | Username already taken |
| `WEAK_PASSWORD` | Password doesn't meet requirements |
| `PASSWORD_REUSED` | Password was used recently |
| `INVALID_EMAIL` | Email format is invalid |
| `EMAIL_NOT_VERIFIED` | Email verification required |
| `INVALID_SIGNATURE` | Wallet signature verification failed |
| `CHALLENGE_EXPIRED` | Challenge nonce has expired |
| `WALLET_ALREADY_LINKED` | Wallet already linked to an account |
| `INVALID_SCOPE` | One or more API scopes are invalid |
| `RATE_LIMIT_EXCEEDED` | Too many requests |

### Validation Error Example

```json
{
  "error": "WEAK_PASSWORD",
  "message": "Password does not meet requirements",
  "details": {
    "requirements": {
      "min_length": 8,
      "require_uppercase": true,
      "require_lowercase": true,
      "require_number": true,
      "require_special": true
    },
    "missing": ["uppercase", "special_char"]
  }
}
```

---

## Rate Limiting

All API endpoints are rate limited to prevent abuse.

### Default Limits

| Endpoint Type | Limit | Window |
|---------------|-------|--------|
| Authentication | 10 requests | 1 minute |
| API Key Creation | 5 requests | 1 hour |
| Password Reset | 3 requests | 1 hour |
| Other Endpoints | 100 requests | 1 minute |

### Rate Limit Headers

Response headers include rate limit information:

```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1706180460
```

### Rate Limit Exceeded Response

```json
{
  "error": "RATE_LIMIT_EXCEEDED",
  "message": "Too many requests. Please try again later.",
  "details": {
    "limit": 100,
    "window_seconds": 60,
    "retry_after_seconds": 45
  }
}
```

---

## Webhooks

Configure webhooks to receive notifications for authentication events.

### Available Events

- `user.registered` - New user registration
- `user.login` - User logged in
- `user.logout` - User logged out
- `user.password_changed` - Password changed
- `user.email_verified` - Email verified
- `wallet.linked` - Wallet linked to account
- `wallet.unlinked` - Wallet unlinked
- `api_key.created` - API key created
- `api_key.deleted` - API key deleted
- `session.revoked` - Session revoked
- `security.suspicious_login` - Suspicious login detected

### Webhook Payload

```json
{
  "event": "user.login",
  "timestamp": "2026-01-25T10:00:00Z",
  "user_id": "550e8400-e29b-41d4-a716-446655440000",
  "data": {
    "ip_address": "192.168.1.100",
    "user_agent": "Mozilla/5.0...",
    "device_name": "Chrome on MacOS",
    "location": {
      "country": "US",
      "city": "San Francisco"
    }
  }
}
```

---

## Best Practices

### Security

1. **Store tokens securely** - Never store tokens in localStorage (use httpOnly cookies or secure storage)
2. **Use HTTPS only** - Always use HTTPS in production
3. **Implement CORS properly** - Restrict origins to your frontend domains
4. **Rotate API keys regularly** - Set expiration dates on API keys
5. **Monitor rate limits** - Implement exponential backoff for rate-limited requests
6. **Validate inputs** - Always validate user inputs on client side
7. **Handle errors gracefully** - Don't expose sensitive error details to users

### Token Management

1. **Refresh tokens before expiry** - Refresh access tokens before they expire (within last 5 minutes)
2. **Handle token refresh failures** - Redirect to login on refresh token expiry
3. **Store refresh tokens securely** - Use secure storage mechanisms
4. **Implement token rotation** - Rotate refresh tokens on each refresh

### API Keys

1. **Use scopes appropriately** - Request only the scopes you need
2. **Rotate keys regularly** - Set expiration and rotate before expiry
3. **Monitor key usage** - Track last_used_at to detect unauthorized usage
4. **Store keys securely** - Use environment variables or secret managers
5. **Delete unused keys** - Clean up old or unused API keys

### Wallet Authentication

1. **Verify signatures properly** - Always verify wallet signatures on backend
2. **Use nonces correctly** - Each nonce should be used only once
3. **Handle challenge expiry** - Request new challenge if expired
4. **Support multiple chains** - Allow users to link wallets from different chains
5. **Set primary wallet** - Let users choose their preferred wallet

---

## SDKs and Libraries

### Official SDKs

- **JavaScript/TypeScript** - `@dotmx/sdk-js` (Coming soon)
- **Python** - `dotmx-python` (Coming soon)
- **Go** - `dotmx-go` (Coming soon)

### Community Libraries

Check our [GitHub](https://github.com/dotmx) for community-contributed SDKs and examples.

---

## Support

- **Documentation:** https://docs.dotmx.xyz
- **API Status:** https://status.dotmx.xyz
- **Discord:** https://discord.gg/dotmx
- **Email:** support@dotmx.xyz

---

## Changelog

### v1.0.0 (2026-01-25)
- Initial release
- Email/password authentication
- Wallet authentication (8 chains)
- JWT token management
- API key management
- Session management
- Password reset flow
- User profile management
- Wallet linking

---

**Last Updated:** January 25, 2026
