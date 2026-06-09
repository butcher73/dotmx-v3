// @ts-nocheck
/**
 * Command Bus (NATS JetStream)
 *
 * Durable command delivery from API gateways to engine shards.
 * Uses NATS JetStream for at-least-once delivery guarantees.
 */

import type { Command, CreateOrderCommand, CancelOrderCommand } from "@dotmx/shared";
import { generateId, nowMs } from "@dotmx/shared";

export interface CommandBus {
  publish(command: Command): Promise<void>;
  subscribe(
    subject: string,
    handler: (cmd: Command, ack: () => void) => Promise<void>
  ): Promise<{ unsubscribe: () => Promise<void> }>;
  close(): Promise<void>;
}

export interface CommandBusConfig {
  natsUrl: string;
  streamName: string;
  consumerName: string;
}

export const defaultCommandBusConfig: CommandBusConfig = {
  natsUrl: "nats://localhost:4222",
  streamName: "COMMANDS",
  consumerName: "engine",
};

/**
 * Create a NATS-based command bus
 * NOTE: Requires 'nats' npm package to be installed
 */
export async function createCommandBus(
  config: CommandBusConfig = defaultCommandBusConfig
): Promise<CommandBus> {
  // Dynamic import to avoid bundling issues
  const nats = await import("nats");
  
  const nc = await nats.connect({ servers: config.natsUrl });
  const js = nc.jetstream();
  const jsm = await nc.jetstreamManager();

  // Ensure stream exists
  try {
    await jsm.streams.info(config.streamName);
  } catch {
    await jsm.streams.add({
      name: config.streamName,
      subjects: ["commands.>"],
      retention: nats.RetentionPolicy.Limits,
      max_age: 7 * 24 * 60 * 60 * 1_000_000_000, // 7 days in nanoseconds
      storage: nats.StorageType.File,
    });
  }

  return {
    async publish(command: Command) {
      const subject = `commands.${command.symbol}`;
      await js.publish(subject, nats.StringCodec().encode(JSON.stringify(command)));
    },

    async subscribe(subject: string, handler) {
      // Create durable consumer
      const consumerName = `${config.consumerName}-${subject.replace(/\./g, "-")}`;
      
      try {
        await jsm.consumers.info(config.streamName, consumerName);
      } catch {
        await jsm.consumers.add(config.streamName, {
          durable_name: consumerName,
          filter_subject: subject,
          ack_policy: nats.AckPolicy.Explicit,
          deliver_policy: nats.DeliverPolicy.All,
        });
      }

      const consumer = await js.consumers.get(config.streamName, consumerName);
      const messages = await consumer.consume();

      // Process messages in background
      (async () => {
        for await (const m of messages) {
          const cmd = JSON.parse(m.string()) as Command;
          await handler(cmd, () => m.ack());
        }
      })();

      return {
        async unsubscribe() {
          await messages.close();
        },
      };
    },

    async close() {
      await nc.drain();
    },
  };
}

/**
 * Create a memory-based command bus (for testing/development)
 */
export function createMemoryCommandBus(): CommandBus {
  const handlers = new Map<string, Set<(cmd: Command, ack: () => void) => Promise<void>>>();
  const pending = new Map<string, Command[]>();

  return {
    async publish(command: Command) {
      const subject = `commands.${command.symbol}`;
      const subjectHandlers = handlers.get(subject);
      
      if (subjectHandlers && subjectHandlers.size > 0) {
        for (const handler of subjectHandlers) {
          await handler(command, () => {});
        }
      } else {
        // Queue for later
        const queue = pending.get(subject) ?? [];
        queue.push(command);
        pending.set(subject, queue);
      }
    },

    async subscribe(subject, handler) {
      const subs = handlers.get(subject) ?? new Set();
      subs.add(handler);
      handlers.set(subject, subs);

      // Deliver pending messages
      const queue = pending.get(subject) ?? [];
      for (const cmd of queue) {
        await handler(cmd, () => {});
      }
      pending.delete(subject);

      return {
        async unsubscribe() {
          subs.delete(handler);
        },
      };
    },

    async close() {
      handlers.clear();
      pending.clear();
    },
  };
}

/**
 * Helper to create command objects
 */
export function createOrderCommand(
  params: Omit<CreateOrderCommand, "requestId" | "timestamp"> & { timestamp?: number }
): CreateOrderCommand {
  return {
    requestId: generateId(),
    userId: params.userId,
    symbol: params.symbol,
    side: params.side,
    type: params.type,
    price: params.price,
    quantity: params.quantity,
    timeInForce: params.timeInForce ?? "GTC",
    stopPrice: params.stopPrice,
    clientOrderId: params.clientOrderId,
    takeProfit: params.takeProfit,
    stopLoss: params.stopLoss,
    timestamp: params.timestamp ?? nowMs(),
  };
}

export function createCancelCommand(
  symbol: string,
  orderId: string,
  userId: string
): CancelOrderCommand {
  return {
    requestId: generateId(),
    timestamp: nowMs(),
    symbol,
    orderId,
    userId,
  };
}
