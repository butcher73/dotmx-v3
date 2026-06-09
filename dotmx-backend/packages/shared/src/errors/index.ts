/**
 * Standardized Error Codes & Error Utilities
 *
 * Provides a consistent error code system across all API endpoints.
 * Each error has a unique code, HTTP status, and user-friendly message.
 */

// ─── Error Code Enum ────────────────────────────────────────────────────────

export const ErrorCode = {
  // ── Authentication (1xxx) ──
  AUTH_REQUIRED: "AUTH_1001",
  AUTH_INVALID_TOKEN: "AUTH_1002",
  AUTH_TOKEN_EXPIRED: "AUTH_1003",
  AUTH_INSUFFICIENT_PERMISSIONS: "AUTH_1004",
  AUTH_ACCOUNT_DISABLED: "AUTH_1005",
  AUTH_INVALID_CREDENTIALS: "AUTH_1006",
  AUTH_2FA_REQUIRED: "AUTH_1007",
  AUTH_2FA_INVALID: "AUTH_1008",
  AUTH_API_KEY_INVALID: "AUTH_1009",
  AUTH_API_KEY_EXPIRED: "AUTH_1010",
  AUTH_IP_NOT_WHITELISTED: "AUTH_1011",

  // ── Validation (2xxx) ──
  VALIDATION_FAILED: "VAL_2001",
  VALIDATION_INVALID_MARKET: "VAL_2002",
  VALIDATION_INVALID_SIDE: "VAL_2003",
  VALIDATION_INVALID_ORDER_TYPE: "VAL_2004",
  VALIDATION_INVALID_QUANTITY: "VAL_2005",
  VALIDATION_INVALID_PRICE: "VAL_2006",
  VALIDATION_INVALID_LEVERAGE: "VAL_2007",
  VALIDATION_INVALID_ADDRESS: "VAL_2008",
  VALIDATION_INVALID_AMOUNT: "VAL_2009",
  VALIDATION_INVALID_ASSET: "VAL_2010",

  // ── Order (3xxx) ──
  ORDER_NOT_FOUND: "ORD_3001",
  ORDER_ALREADY_CANCELLED: "ORD_3002",
  ORDER_ALREADY_FILLED: "ORD_3003",
  ORDER_INSUFFICIENT_BALANCE: "ORD_3004",
  ORDER_PRICE_OUT_OF_RANGE: "ORD_3005",
  ORDER_SIZE_TOO_SMALL: "ORD_3006",
  ORDER_SIZE_TOO_LARGE: "ORD_3007",
  ORDER_SELF_TRADE_PREVENTED: "ORD_3008",
  ORDER_RATE_LIMITED: "ORD_3009",
  ORDER_MARKET_CLOSED: "ORD_3010",
  ORDER_REJECTED: "ORD_3011",

  // ── Position (4xxx) ──
  POSITION_NOT_FOUND: "POS_4001",
  POSITION_INSUFFICIENT_MARGIN: "POS_4002",
  POSITION_MAX_LEVERAGE_EXCEEDED: "POS_4003",
  POSITION_LIQUIDATION_PRICE_HIT: "POS_4004",
  POSITION_MAX_SIZE_EXCEEDED: "POS_4005",
  POSITION_ALREADY_CLOSED: "POS_4006",

  // ── Withdrawal (5xxx) ──
  WITHDRAWAL_DAILY_LIMIT_EXCEEDED: "WDR_5001",
  WITHDRAWAL_MONTHLY_LIMIT_EXCEEDED: "WDR_5002",
  WITHDRAWAL_INSUFFICIENT_BALANCE: "WDR_5003",
  WITHDRAWAL_ADDRESS_NOT_WHITELISTED: "WDR_5004",
  WITHDRAWAL_REQUIRES_2FA: "WDR_5005",
  WITHDRAWAL_COOLING_PERIOD: "WDR_5006",
  WITHDRAWAL_ASSET_NOT_SUPPORTED: "WDR_5007",
  WITHDRAWAL_NETWORK_NOT_SUPPORTED: "WDR_5008",
  WITHDRAWAL_AMOUNT_BELOW_MINIMUM: "WDR_5009",
  WITHDRAWAL_SUSPENDED: "WDR_5010",
  WITHDRAWAL_LARGE_AMOUNT_REVIEW: "WDR_5011",

  // ── Deposit (6xxx) ──
  DEPOSIT_ADDRESS_NOT_FOUND: "DEP_6001",
  DEPOSIT_ASSET_NOT_SUPPORTED: "DEP_6002",
  DEPOSIT_NETWORK_NOT_SUPPORTED: "DEP_6003",
  DEPOSIT_PENDING_CONFIRMATION: "DEP_6004",

  // ── Market Data (7xxx) ──
  MARKET_NOT_FOUND: "MKT_7001",
  MARKET_DATA_UNAVAILABLE: "MKT_7002",
  MARKET_CIRCUIT_BREAKER_ACTIVE: "MKT_7003",
  MARKET_HALTED: "MKT_7004",

  // ── System (8xxx) ──
  INTERNAL_ERROR: "SYS_8001",
  SERVICE_UNAVAILABLE: "SYS_8002",
  DATABASE_ERROR: "SYS_8003",
  RATE_LIMITED: "SYS_8004",
  MAINTENANCE_MODE: "SYS_8005",
  FEATURE_DISABLED: "SYS_8006",

  // ── Webhook (9xxx) ──
  WEBHOOK_NOT_FOUND: "WHK_9001",
  WEBHOOK_LIMIT_EXCEEDED: "WHK_9002",
  WEBHOOK_INVALID_URL: "WHK_9003",
  WEBHOOK_INVALID_EVENT: "WHK_9004",
  WEBHOOK_DELIVERY_FAILED: "WHK_9005",
} as const;

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ─── Error Metadata ─────────────────────────────────────────────────────────

interface ErrorMeta {
  httpStatus: number;
  message: string;
}

const ERROR_META: Record<ErrorCodeType, ErrorMeta> = {
  // Auth
  [ErrorCode.AUTH_REQUIRED]: { httpStatus: 401, message: "Authentication required" },
  [ErrorCode.AUTH_INVALID_TOKEN]: { httpStatus: 401, message: "Invalid authentication token" },
  [ErrorCode.AUTH_TOKEN_EXPIRED]: { httpStatus: 401, message: "Authentication token has expired" },
  [ErrorCode.AUTH_INSUFFICIENT_PERMISSIONS]: { httpStatus: 403, message: "Insufficient permissions" },
  [ErrorCode.AUTH_ACCOUNT_DISABLED]: { httpStatus: 403, message: "Account is disabled" },
  [ErrorCode.AUTH_INVALID_CREDENTIALS]: { httpStatus: 401, message: "Invalid credentials" },
  [ErrorCode.AUTH_2FA_REQUIRED]: { httpStatus: 403, message: "Two-factor authentication required" },
  [ErrorCode.AUTH_2FA_INVALID]: { httpStatus: 401, message: "Invalid 2FA code" },
  [ErrorCode.AUTH_API_KEY_INVALID]: { httpStatus: 401, message: "Invalid API key" },
  [ErrorCode.AUTH_API_KEY_EXPIRED]: { httpStatus: 401, message: "API key has expired" },
  [ErrorCode.AUTH_IP_NOT_WHITELISTED]: { httpStatus: 403, message: "IP address not whitelisted for this API key" },

  // Validation
  [ErrorCode.VALIDATION_FAILED]: { httpStatus: 422, message: "Validation failed" },
  [ErrorCode.VALIDATION_INVALID_MARKET]: { httpStatus: 422, message: "Invalid market pair" },
  [ErrorCode.VALIDATION_INVALID_SIDE]: { httpStatus: 422, message: "Invalid order side (must be buy or sell)" },
  [ErrorCode.VALIDATION_INVALID_ORDER_TYPE]: { httpStatus: 422, message: "Invalid order type" },
  [ErrorCode.VALIDATION_INVALID_QUANTITY]: { httpStatus: 422, message: "Invalid quantity" },
  [ErrorCode.VALIDATION_INVALID_PRICE]: { httpStatus: 422, message: "Invalid price" },
  [ErrorCode.VALIDATION_INVALID_LEVERAGE]: { httpStatus: 422, message: "Invalid leverage value" },
  [ErrorCode.VALIDATION_INVALID_ADDRESS]: { httpStatus: 422, message: "Invalid wallet address" },
  [ErrorCode.VALIDATION_INVALID_AMOUNT]: { httpStatus: 422, message: "Invalid amount" },
  [ErrorCode.VALIDATION_INVALID_ASSET]: { httpStatus: 422, message: "Invalid or unsupported asset" },

  // Orders
  [ErrorCode.ORDER_NOT_FOUND]: { httpStatus: 404, message: "Order not found" },
  [ErrorCode.ORDER_ALREADY_CANCELLED]: { httpStatus: 409, message: "Order is already cancelled" },
  [ErrorCode.ORDER_ALREADY_FILLED]: { httpStatus: 409, message: "Order is already filled" },
  [ErrorCode.ORDER_INSUFFICIENT_BALANCE]: { httpStatus: 422, message: "Insufficient balance to place order" },
  [ErrorCode.ORDER_PRICE_OUT_OF_RANGE]: { httpStatus: 422, message: "Order price is outside acceptable range" },
  [ErrorCode.ORDER_SIZE_TOO_SMALL]: { httpStatus: 422, message: "Order size is below minimum" },
  [ErrorCode.ORDER_SIZE_TOO_LARGE]: { httpStatus: 422, message: "Order size exceeds maximum" },
  [ErrorCode.ORDER_SELF_TRADE_PREVENTED]: { httpStatus: 422, message: "Order rejected: self-trade prevention" },
  [ErrorCode.ORDER_RATE_LIMITED]: { httpStatus: 429, message: "Order rate limit exceeded" },
  [ErrorCode.ORDER_MARKET_CLOSED]: { httpStatus: 422, message: "Market is currently closed" },
  [ErrorCode.ORDER_REJECTED]: { httpStatus: 422, message: "Order rejected" },

  // Positions
  [ErrorCode.POSITION_NOT_FOUND]: { httpStatus: 404, message: "Position not found" },
  [ErrorCode.POSITION_INSUFFICIENT_MARGIN]: { httpStatus: 422, message: "Insufficient margin" },
  [ErrorCode.POSITION_MAX_LEVERAGE_EXCEEDED]: { httpStatus: 422, message: "Maximum leverage exceeded" },
  [ErrorCode.POSITION_LIQUIDATION_PRICE_HIT]: { httpStatus: 422, message: "Position liquidated: liquidation price reached" },
  [ErrorCode.POSITION_MAX_SIZE_EXCEEDED]: { httpStatus: 422, message: "Maximum position size exceeded" },
  [ErrorCode.POSITION_ALREADY_CLOSED]: { httpStatus: 409, message: "Position is already closed" },

  // Withdrawals
  [ErrorCode.WITHDRAWAL_DAILY_LIMIT_EXCEEDED]: { httpStatus: 422, message: "Daily withdrawal limit exceeded" },
  [ErrorCode.WITHDRAWAL_MONTHLY_LIMIT_EXCEEDED]: { httpStatus: 422, message: "Monthly withdrawal limit exceeded" },
  [ErrorCode.WITHDRAWAL_INSUFFICIENT_BALANCE]: { httpStatus: 422, message: "Insufficient balance for withdrawal" },
  [ErrorCode.WITHDRAWAL_ADDRESS_NOT_WHITELISTED]: { httpStatus: 422, message: "Withdrawal address is not whitelisted" },
  [ErrorCode.WITHDRAWAL_REQUIRES_2FA]: { httpStatus: 403, message: "Withdrawal requires 2FA verification" },
  [ErrorCode.WITHDRAWAL_COOLING_PERIOD]: { httpStatus: 422, message: "Withdrawal address is in cooling-off period" },
  [ErrorCode.WITHDRAWAL_ASSET_NOT_SUPPORTED]: { httpStatus: 422, message: "Asset not supported for withdrawal" },
  [ErrorCode.WITHDRAWAL_NETWORK_NOT_SUPPORTED]: { httpStatus: 422, message: "Network not supported for this asset" },
  [ErrorCode.WITHDRAWAL_AMOUNT_BELOW_MINIMUM]: { httpStatus: 422, message: "Withdrawal amount is below minimum" },
  [ErrorCode.WITHDRAWAL_SUSPENDED]: { httpStatus: 503, message: "Withdrawals are temporarily suspended" },
  [ErrorCode.WITHDRAWAL_LARGE_AMOUNT_REVIEW]: { httpStatus: 202, message: "Large withdrawal submitted for manual review" },

  // Deposits
  [ErrorCode.DEPOSIT_ADDRESS_NOT_FOUND]: { httpStatus: 404, message: "Deposit address not found" },
  [ErrorCode.DEPOSIT_ASSET_NOT_SUPPORTED]: { httpStatus: 422, message: "Asset not supported for deposit" },
  [ErrorCode.DEPOSIT_NETWORK_NOT_SUPPORTED]: { httpStatus: 422, message: "Network not supported for this asset" },
  [ErrorCode.DEPOSIT_PENDING_CONFIRMATION]: { httpStatus: 202, message: "Deposit is pending confirmation" },

  // Market Data
  [ErrorCode.MARKET_NOT_FOUND]: { httpStatus: 404, message: "Market not found" },
  [ErrorCode.MARKET_DATA_UNAVAILABLE]: { httpStatus: 503, message: "Market data temporarily unavailable" },
  [ErrorCode.MARKET_CIRCUIT_BREAKER_ACTIVE]: { httpStatus: 503, message: "Trading halted: circuit breaker active" },
  [ErrorCode.MARKET_HALTED]: { httpStatus: 503, message: "Market is halted" },

  // System
  [ErrorCode.INTERNAL_ERROR]: { httpStatus: 500, message: "Internal server error" },
  [ErrorCode.SERVICE_UNAVAILABLE]: { httpStatus: 503, message: "Service temporarily unavailable" },
  [ErrorCode.DATABASE_ERROR]: { httpStatus: 500, message: "Database error" },
  [ErrorCode.RATE_LIMITED]: { httpStatus: 429, message: "Rate limit exceeded. Please try again later." },
  [ErrorCode.MAINTENANCE_MODE]: { httpStatus: 503, message: "System is under maintenance" },
  [ErrorCode.FEATURE_DISABLED]: { httpStatus: 503, message: "This feature is currently disabled" },

  // Webhook
  [ErrorCode.WEBHOOK_NOT_FOUND]: { httpStatus: 404, message: "Webhook subscription not found" },
  [ErrorCode.WEBHOOK_LIMIT_EXCEEDED]: { httpStatus: 422, message: "Maximum webhook subscriptions exceeded" },
  [ErrorCode.WEBHOOK_INVALID_URL]: { httpStatus: 422, message: "Invalid webhook URL" },
  [ErrorCode.WEBHOOK_INVALID_EVENT]: { httpStatus: 422, message: "Invalid or unsupported event type" },
  [ErrorCode.WEBHOOK_DELIVERY_FAILED]: { httpStatus: 502, message: "Webhook delivery failed" },
};

// ─── Error Response Type ────────────────────────────────────────────────────

export interface ApiErrorResponse {
  error: {
    code: ErrorCodeType;
    message: string;
    details?: string;
    timestamp: string;
    requestId?: string;
  };
}

// ─── ApiError Class ─────────────────────────────────────────────────────────

export class ApiError extends Error {
  public readonly code: ErrorCodeType;
  public readonly httpStatus: number;
  public readonly details?: string;

  constructor(code: ErrorCodeType, details?: string) {
    const meta = ERROR_META[code];
    super(meta.message);
    this.name = "ApiError";
    this.code = code;
    this.httpStatus = meta.httpStatus;
    this.details = details;
  }

  toResponse(requestId?: string): ApiErrorResponse {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        timestamp: new Date().toISOString(),
        requestId,
      },
    };
  }
}

// ─── Factory Functions ──────────────────────────────────────────────────────

/**
 * Create an API error response object without throwing.
 * Useful for returning error responses directly from route handlers.
 */
export function apiError(
  code: ErrorCodeType,
  details?: string,
  requestId?: string
): { status: number; body: ApiErrorResponse } {
  const meta = ERROR_META[code];
  return {
    status: meta.httpStatus,
    body: {
      error: {
        code,
        message: meta.message,
        details,
        timestamp: new Date().toISOString(),
        requestId,
      },
    },
  };
}

/**
 * Get the HTTP status for an error code.
 */
export function getHttpStatus(code: ErrorCodeType): number {
  return ERROR_META[code].httpStatus;
}

/**
 * Get the default message for an error code.
 */
export function getErrorMessage(code: ErrorCodeType): string {
  return ERROR_META[code].message;
}

/**
 * Check if an error code is a client error (4xx).
 */
export function isClientError(code: ErrorCodeType): boolean {
  const status = ERROR_META[code].httpStatus;
  return status >= 400 && status < 500;
}

/**
 * Check if an error code is a server error (5xx).
 */
export function isServerError(code: ErrorCodeType): boolean {
  const status = ERROR_META[code].httpStatus;
  return status >= 500;
}
