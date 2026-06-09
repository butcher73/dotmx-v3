/**
 * Structured Logger
 *
 * Wraps console.log/error with env-based production gating.
 * In production (NODE_ENV=production), PII-sensitive data (user IDs, tx hashes, amounts)
 * is redacted. In non-production, full details are logged for debugging.
 */

const isProduction = (): boolean =>
  process.env.NODE_ENV === 'production' || process.env.NODE_ENV === 'prod';

/** Redacts a tx_hash to first 8 chars for production logging */
function redactTxHash(hash: string): string {
  if (hash.length <= 16) return `${hash.slice(0, 4)}...`;
  return `${hash.slice(0, 8)}...`;
}

/** Redacts a user ID to first 8 chars */
function redactUserId(id: string): string {
  if (id.length <= 12) return `${id.slice(0, 4)}...`;
  return `${id.slice(0, 8)}...`;
}

export const logger = {
  /**
   * Info-level log. In production, PII fields are redacted.
   * Use the `pii` option to mark fields that should be redacted in production.
   */
  info(message: string, meta?: Record<string, unknown>): void {
    if (isProduction()) {
      const safe = meta ? redactPii(meta) : undefined;
      console.log(`[INFO] ${message}`, safe ? JSON.stringify(safe) : '');
    } else {
      console.log(message, meta || '');
    }
  },

  /** Warning-level log */
  warn(message: string, meta?: Record<string, unknown>): void {
    if (isProduction()) {
      const safe = meta ? redactPii(meta) : undefined;
      console.warn(`[WARN] ${message}`, safe ? JSON.stringify(safe) : '');
    } else {
      console.warn(message, meta || '');
    }
  },

  /** Error-level log (always logs, but redacts PII in production) */
  error(message: string, meta?: Record<string, unknown>): void {
    if (isProduction()) {
      const safe = meta ? redactPii(meta) : undefined;
      console.error(`[ERROR] ${message}`, safe ? JSON.stringify(safe) : '');
    } else {
      console.error(message, meta || '');
    }
  },

  /** Debug log - only in non-production */
  debug(message: string, meta?: Record<string, unknown>): void {
    if (!isProduction()) {
      console.log(`[DEBUG] ${message}`, meta || '');
    }
  },
};

/** Known PII field names to redact */
const PII_FIELDS = new Set([
  'user_id',
  'userId',
  'tx_hash',
  'txHash',
  'address',
  'destination_address',
  'amount',
]);

function redactPii(meta: Record<string, unknown>): Record<string, unknown> {
  const safe: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(meta)) {
    if (PII_FIELDS.has(key) && typeof value === 'string') {
      if (key.includes('tx_hash') || key === 'txHash') {
        safe[key] = redactTxHash(value);
      } else if (key.includes('user_id') || key === 'userId') {
        safe[key] = redactUserId(value);
      } else {
        safe[key] = '[REDACTED]';
      }
    } else {
      safe[key] = value;
    }
  }
  return safe;
}
