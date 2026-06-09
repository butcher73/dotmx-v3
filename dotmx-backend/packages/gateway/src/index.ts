/**
 * @dotmx/gateway
 *
 * Command routing from API to engine shards.
 * - NATS JetStream command bus
 * - Consistent hash shard router
 * - Gateway adapter for API integration
 */

export * from "./bus";
export * from "./router";
export * from "./adapter";
