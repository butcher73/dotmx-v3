/**
 * CLI Tools
 *
 * Command-line utilities for DotMX.
 */

import { runMatchingEngineBenchmark, runThroughputTest } from "../harness";
import { createOrderGenerator } from "../generator";
import { createMetricsRegistry, createEngineMetrics } from "../metrics";

export interface CliCommand {
  name: string;
  description: string;
  options?: CliOption[];
  action: (args: Record<string, unknown>) => Promise<void>;
}

export interface CliOption {
  name: string;
  short?: string;
  description: string;
  type: "string" | "number" | "boolean";
  default?: unknown;
  required?: boolean;
}

export interface Cli {
  register(command: CliCommand): void;
  run(args: string[]): Promise<void>;
  showHelp(): void;
}

export function createCli(name: string, version: string): Cli {
  const commands = new Map<string, CliCommand>();

  function parseArgs(args: string[], options: CliOption[] = []): Record<string, unknown> {
    const result: Record<string, unknown> = {};

    // Set defaults
    for (const opt of options) {
      if (opt.default !== undefined) {
        result[opt.name] = opt.default;
      }
    }

    // Parse arguments
    for (let i = 0; i < args.length; i++) {
      const arg = args[i];

      if (arg.startsWith("--")) {
        const key = arg.slice(2);
        const opt = options.find((o) => o.name === key);

        if (opt?.type === "boolean") {
          result[key] = true;
        } else if (i + 1 < args.length) {
          const value = args[++i];
          if (opt?.type === "number") {
            result[key] = parseFloat(value);
          } else {
            result[key] = value;
          }
        }
      } else if (arg.startsWith("-")) {
        const short = arg.slice(1);
        const opt = options.find((o) => o.short === short);

        if (opt) {
          if (opt.type === "boolean") {
            result[opt.name] = true;
          } else if (i + 1 < args.length) {
            const value = args[++i];
            if (opt.type === "number") {
              result[opt.name] = parseFloat(value);
            } else {
              result[opt.name] = value;
            }
          }
        }
      }
    }

    return result;
  }

  return {
    register(command: CliCommand): void {
      commands.set(command.name, command);
    },

    async run(args: string[]): Promise<void> {
      const commandName = args[0];

      if (!commandName || commandName === "help" || commandName === "--help") {
        this.showHelp();
        return;
      }

      const command = commands.get(commandName);
      if (!command) {
        console.error(`Unknown command: ${commandName}`);
        this.showHelp();
        process.exit(1);
      }

      const parsedArgs = parseArgs(args.slice(1), command.options);
      await command.action(parsedArgs);
    },

    showHelp(): void {
      console.log(`\n${name} v${version}\n`);
      console.log("Commands:");

      for (const [cmdName, cmd] of commands) {
        console.log(`  ${cmdName.padEnd(20)} ${cmd.description}`);
      }

      console.log("\nRun '<command> --help' for more information on a command.\n");
    },
  };
}

/**
 * Pre-built CLI commands
 */
export function registerDefaultCommands(cli: Cli): void {
  cli.register({
    name: "bench",
    description: "Run matching engine benchmarks",
    options: [
      { name: "iterations", short: "n", type: "number", default: 5000, description: "Number of iterations" },
      { name: "warmup", short: "w", type: "number", default: 500, description: "Warmup iterations" },
    ],
    async action(args) {
      console.log("Running matching engine benchmarks...\n");
      await runMatchingEngineBenchmark();
    },
  });

  cli.register({
    name: "throughput",
    description: "Run throughput test",
    options: [
      { name: "duration", short: "d", type: "number", default: 10, description: "Test duration in seconds" },
    ],
    async action(args) {
      console.log("Running throughput test...\n");
      await runThroughputTest(args.duration as number);
    },
  });

  cli.register({
    name: "generate",
    description: "Generate sample orders",
    options: [
      { name: "count", short: "n", type: "number", default: 10, description: "Number of orders" },
      { name: "symbol", short: "s", type: "string", default: "BTC-USD", description: "Trading symbol" },
    ],
    async action(args) {
      const generator = createOrderGenerator({
        symbol: args.symbol as string,
        basePrice: 50000,
        priceVolatility: 0.001,
        orderRatePerSecond: 100,
        buyProbability: 0.5,
        limitProbability: 0.8,
        cancelProbability: 0.1,
        meanOrderSize: 0.1,
        sizeVolatility: 0.5,
        userCount: 100,
        tickSize: 0.01,
        lotSize: 0.001,
      });

      const orders = generator.generateBatch(args.count as number);

      console.log("Generated orders:\n");
      for (const order of orders) {
        console.log(JSON.stringify(order, null, 2));
      }

      const stats = generator.getStats();
      console.log("\nStats:", stats);
    },
  });

  cli.register({
    name: "metrics",
    description: "Show sample metrics output",
    async action() {
      const registry = createMetricsRegistry();
      const metrics = createEngineMetrics(registry);

      // Simulate some activity
      for (let i = 0; i < 100; i++) {
        metrics.ordersReceived.inc({ symbol: "BTC-USD" });
        if (Math.random() > 0.3) {
          metrics.ordersMatched.inc({ symbol: "BTC-USD" });
          metrics.tradesExecuted.inc({ symbol: "BTC-USD" });
        }
        metrics.matchLatency.observe(Math.random() * 0.001, { symbol: "BTC-USD" });
      }

      metrics.orderbookDepth.set(50, { symbol: "BTC-USD", side: "bid" });
      metrics.orderbookDepth.set(48, { symbol: "BTC-USD", side: "ask" });
      metrics.activeConnections.set(125);

      console.log("Prometheus Metrics:\n");
      console.log(registry.exportPrometheus());
    },
  });
}

/**
 * Main CLI entry point
 */
export async function main(): Promise<void> {
  const cli = createCli("dotmx-tools", "1.0.0");
  registerDefaultCommands(cli);
  await cli.run(process.argv.slice(2));
}
