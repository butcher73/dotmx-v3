/**
 * Shared utility functions
 */

export * from './security.utils';
export * from './symbol';

export function generateId(): string {
  return crypto.randomUUID();
}

export function nowMs(): number {
  return Date.now();
}

export function nowMicro(): bigint {
  return BigInt(Date.now()) * 1000n;
}
