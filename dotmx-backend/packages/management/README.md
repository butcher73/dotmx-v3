# DotMX Management API

Internal management API for the Alfred Admin Panel. This API is protected and only accessible from authorized origins.

## Features

- **Origin Protection**: Only accepts requests from `alfred.dotmx.xyz` in production
- **Development Mode**: All origins allowed when `NODE_ENV=development`
- **Admin Authentication**: JWT-based authentication with role-based access control
- **API Key Support**: Service-to-service authentication via `X-Management-API-Key` header

## Endpoints

### Dashboard
- `GET /api/management/dashboard/stats` - Get dashboard statistics
- `GET /api/management/dashboard/volume-chart` - Get trading volume chart data
- `GET /api/management/dashboard/recent-transactions` - Get recent transactions

### Users
- `GET /api/management/users` - List users (paginated)
- `GET /api/management/users/:userId` - Get user details
- `PATCH /api/management/users/:userId/status` - Update user status
- `PATCH /api/management/users/:userId/role` - Update user role

### Transactions
- `GET /api/management/transactions` - List transactions (paginated)
- `GET /api/management/transactions/:transactionId` - Get transaction details
- `PATCH /api/management/transactions/:transactionId/status` - Update transaction status

### KYC
- `GET /api/management/kyc` - List KYC applications (paginated)
- `GET /api/management/kyc/:applicationId` - Get KYC application details
- `PATCH /api/management/kyc/:applicationId/review` - Review KYC application

### Trading Pairs
- `GET /api/management/trading-pairs` - List trading pairs
- `POST /api/management/trading-pairs` - Create trading pair
- `PATCH /api/management/trading-pairs/:pairId` - Update trading pair
- `DELETE /api/management/trading-pairs/:pairId` - Delete trading pair

### Audit Logs
- `GET /api/management/audit-logs` - List audit logs (paginated)
- `GET /api/management/audit-logs/actions` - Get available action types
- `GET /api/management/audit-logs/resources` - Get available resource types

### Settings
- `GET /api/management/settings` - Get all settings
- `GET /api/management/settings/categories` - Get setting categories
- `GET /api/management/settings/:key` - Get specific setting
- `PUT /api/management/settings/:key` - Update setting
- `DELETE /api/management/settings/:key` - Delete setting

### Health
- `GET /api/management/health` - Health check endpoint

## Running

```bash
# Development
bun run dev:management

# Or with environment file
source .env.management && bun run apps/management-server.ts
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `MANAGEMENT_API_PORT` | Server port | `3002` |
| `HOST` | Server host | `0.0.0.0` |
| `NODE_ENV` | Environment mode | `development` |
| `JWT_SECRET` | JWT signing secret | Required |
| `MANAGEMENT_ALLOWED_ORIGINS` | Comma-separated allowed origins | `https://alfred.dotmx.xyz` |
| `MANAGEMENT_API_KEY` | Internal API key (optional) | - |

## Security

### Origin Protection

In production (`NODE_ENV=production`), the API only accepts requests from origins listed in `MANAGEMENT_ALLOWED_ORIGINS`. Requests from other origins receive a `403 Forbidden` response.

In development (`NODE_ENV=development`), all origins are allowed to simplify local development.

### API Key Authentication

For service-to-service communication without browser cookies, use the `X-Management-API-Key` header:

```bash
curl -H "X-Management-API-Key: your-api-key" http://localhost:8080/api/management/dashboard/stats
```

### Admin Authentication

Admin users authenticate via JWT tokens in the `Authorization` header:

```bash
curl -H "Authorization: Bearer <token>" http://localhost:8080/api/management/users
```

## API Documentation

Swagger documentation is available at: `http://localhost:8080/api/management/docs`
