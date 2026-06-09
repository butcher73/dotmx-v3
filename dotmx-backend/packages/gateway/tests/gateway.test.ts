/**
 * Gateway Package Tests
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  createMemoryCommandBus,
  createOrderCommand,
} from "../src";
import type { Command } from "@dotmx/shared";

describe("Memory Command Bus", () => {
  let bus: ReturnType<typeof createMemoryCommandBus>;

  beforeEach(() => {
    bus = createMemoryCommandBus();
  });

  it("should publish and subscribe to commands", async () => {
    const received: Command[] = [];

    await bus.subscribe("commands.BTC-USD", async (cmd, ack) => {
      received.push(cmd);
      ack();
    });

    const command = createOrderCommand({
      userId: "user1",
      symbol: "BTC-USD",
      side: "BUY",
      type: "LIMIT",
      price: 50000,
      quantity: 1,
      timeInForce: "GTC",
    });

    await bus.publish(command);

    expect(received.length).toBe(1);
    expect(received[0].symbol).toBe("BTC-USD");
  });

  it("should queue messages for later subscribers", async () => {
    const command = createOrderCommand({
      userId: "user1",
      symbol: "ETH-USD",
      side: "SELL",
      type: "MARKET",
      price: 0, // Market orders can have price 0 or undefined
      quantity: 10,
      timeInForce: "IOC",
    });

    // Publish before subscriber
    await bus.publish(command);

    const received: Command[] = [];
    await bus.subscribe("commands.ETH-USD", async (cmd, ack) => {
      received.push(cmd);
      ack();
    });

    // Should receive queued message
    expect(received.length).toBe(1);
  });

  it("should unsubscribe correctly", async () => {
    let count = 0;

    const sub = await bus.subscribe("commands.SOL-USD", async (cmd, ack) => {
      count++;
      ack();
    });

    const command = createOrderCommand({
      userId: "user1",
      symbol: "SOL-USD",
      side: "BUY",
      type: "LIMIT",
      price: 100,
      quantity: 1,
      timeInForce: "GTC",
    });

    await bus.publish(command);
    expect(count).toBe(1);

    await sub.unsubscribe();

    await bus.publish(command);
    expect(count).toBe(1); // Should not increase
  });

  it("should support multiple subscribers on the same subject", async () => {
    const received1: Command[] = [];
    const received2: Command[] = [];

    await bus.subscribe("commands.MATIC-USD", async (cmd, ack) => {
      received1.push(cmd);
      ack();
    });

    await bus.subscribe("commands.MATIC-USD", async (cmd, ack) => {
      received2.push(cmd);
      ack();
    });

    const command = createOrderCommand({
      userId: "user1",
      symbol: "MATIC-USD",
      side: "BUY",
      type: "LIMIT",
      price: 1.5,
      quantity: 100,
      timeInForce: "GTC",
    });

    await bus.publish(command);

    expect(received1.length).toBe(1);
    expect(received2.length).toBe(1);
  });

  it("should close bus and clean up", async () => {
    await bus.close();
    // After close, bus should be in closed state
    // In memory bus, this clears all handlers and pending messages
  });

  it("should handle market orders without price", async () => {
    const received: Command[] = [];

    await bus.subscribe("commands.AVAX-USD", async (cmd, ack) => {
      received.push(cmd);
      ack();
    });

    const command = createOrderCommand({
      userId: "user1",
      symbol: "AVAX-USD",
      side: "SELL",
      type: "MARKET",
      quantity: 5,
      timeInForce: "IOC",
    });

    await bus.publish(command);

    expect(received.length).toBe(1);
    expect(received[0].type).toBe("MARKET");
    expect(received[0].price).toBeUndefined();
  });

  it("should handle cancel order commands", async () => {
    const received: Command[] = [];

    await bus.subscribe("commands.DOT-USD", async (cmd, ack) => {
      received.push(cmd);
      ack();
    });

    const command = {
      requestId: "req-123",
      userId: "user1",
      orderId: "order-456",
      symbol: "DOT-USD",
      timestamp: Date.now(),
    };

    await bus.publish(command as any);

    expect(received.length).toBe(1);
    expect(received[0].orderId).toBe("order-456");
  });

  it("should deliver messages in order", async () => {
    const received: Command[] = [];

    await bus.subscribe("commands.LINK-USD", async (cmd, ack) => {
      received.push(cmd);
      ack();
    });

    // Publish multiple commands
    for (let i = 0; i < 3; i++) {
      const command = createOrderCommand({
        userId: `user${i}`,
        symbol: "LINK-USD",
        side: "BUY",
        type: "LIMIT",
        price: 10 + i,
        quantity: 1,
        timeInForce: "GTC",
      });
      await bus.publish(command);
    }

    expect(received.length).toBe(3);
    expect(received[0].userId).toBe("user0");
    expect(received[1].userId).toBe("user1");
    expect(received[2].userId).toBe("user2");
  });

  it("should handle IOC time-in-force", async () => {
    const received: Command[] = [];

    await bus.subscribe("commands.UNI-USD", async (cmd, ack) => {
      received.push(cmd);
      ack();
    });

    const command = createOrderCommand({
      userId: "user1",
      symbol: "UNI-USD",
      side: "BUY",
      type: "LIMIT",
      price: 8,
      quantity: 10,
      timeInForce: "IOC",
    });

    await bus.publish(command);

    expect(received.length).toBe(1);
    expect(received[0].timeInForce).toBe("IOC");
  });
});
