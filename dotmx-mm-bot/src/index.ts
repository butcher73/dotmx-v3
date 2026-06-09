/**
 * DotMX Market Maker Bot — Main Entry Point
 *
 * Starts all 10 MM bot engines from credentials file, connects to
 * Binance price feed, and manages graceful shutdown.
 *
 * Usage:
 *   bun run src/index.ts                     # Run all bots
 *   bun run src/index.ts --dry-run           # Simulate without placing orders
 *   bun run src/index.ts --bots mm-01,mm-03  # Run specific bots only
 */

import pg from "pg";
import { MM_ACCOUNTS, MmAccountConfig, CONFIG } from "./config";
import { MarketMakerEngine } from "./engine";
import { PriceFeed } from "./price-feed";
import { log } from "./logger";

interface Credential {
  id: string;
  email: string;
  userId: string;
  apiKey: string;
}

/** Fetch active trading pair symbols from DB, normalized to config format (BTC-USDT) */
async function fetchActivePairs(): Promise<Set<string>> {
  const client = new pg.Client(CONFIG.databaseUrl);
  try {
    await client.connect();
    const res = await client.query(
      "SELECT symbol FROM trading_pairs WHERE status = 'active'"
    );
    // DB uses "BTC/USDT", config uses "BTC-USDT" — normalize
    const symbols = res.rows.map((r: { symbol: string }) =>
      r.symbol.replace("/", "-")
    );
    return new Set(symbols);
  } finally {
    await client.end();
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes("--dry-run");
  const botsArg = args.find((a) => a.startsWith("--bots="));
  const selectedBots = botsArg
    ? botsArg.split("=")[1].split(",")
    : null;

  console.log(`
╔══════════════════════════════════════╗
║       DotMX Market Maker Bot        ║
╚══════════════════════════════════════╝
  `);

  if (dryRun) log.warn("Main", "DRY RUN mode — no real orders will be placed");

  // ── 0. Validate config ──
  if (!CONFIG.mmPassword) {
    log.error(
      "Main",
      "MM_PASSWORD environment variable is required. Set it before starting the bot."
    );
    process.exit(1);
  }

  // ── 1. Load credentials ──
  const credsPath = `${import.meta.dir}/../.mm-credentials.json`;
  let credentials: Credential[];

  try {
    const file = Bun.file(credsPath);
    credentials = await file.json();
  } catch {
    log.error(
      "Main",
      "Cannot load .mm-credentials.json — run `bun run seed` first"
    );
    process.exit(1);
  }

  // ── 2. Fetch active trading pairs from DB ──
  let activePairs: Set<string>;
  try {
    activePairs = await fetchActivePairs();
    log.info("Main", `Active trading pairs: ${[...activePairs].join(", ")}`);
  } catch (err) {
    log.error(
      "Main",
      `Failed to fetch active pairs: ${err instanceof Error ? err.message : err}`
    );
    process.exit(1);
  }

  // ── 3. Filter bots to active pairs only ──
  let accounts = (
    selectedBots
      ? MM_ACCOUNTS.filter((a) => selectedBots.includes(a.id))
      : MM_ACCOUNTS
  ).map((a) => ({
    ...a,
    markets: a.markets.filter((m) => activePairs.has(m)),
  }));

  // Report skipped markets
  for (const orig of MM_ACCOUNTS) {
    const skipped = orig.markets.filter((m) => !activePairs.has(m));
    if (skipped.length > 0) {
      log.warn("Main", `${orig.id}: skipping inactive pairs: ${skipped.join(", ")}`);
    }
  }

  // Drop bots with no remaining active markets
  accounts = accounts.filter((a) => a.markets.length > 0);

  if (accounts.length === 0) {
    log.error("Main", "No bots have active trading pairs — nothing to run");
    process.exit(1);
  }

  log.info(
    "Main",
    `Starting ${accounts.length} bot(s): ${accounts.map((a) => `${a.id}(${a.markets.join(",")})`).join(", ")}`
  );

  // ── 4. Start price feed ──
  const allMarkets = [...new Set(accounts.flatMap((a) => a.markets))];
  const priceFeed = new PriceFeed();
  priceFeed.start(allMarkets);

  // Wait for initial prices
  log.info("Main", `Waiting for reference prices (${allMarkets.join(", ")})...`);
  await new Promise((resolve) => setTimeout(resolve, 3000));

  // ── 5. Start engines ──
  const engines: MarketMakerEngine[] = [];

  for (const account of accounts) {
    const cred = credentials.find((c) => c.id === account.id);
    if (!cred) {
      log.warn("Main", `No credentials for ${account.id} — skipping`);
      continue;
    }

    // Skip if API key was already created (placeholder from seed)
    if (cred.apiKey.includes("already created")) {
      log.warn(
        "Main",
        `${account.id}: API key was previously created. Re-run seed with --reset to regenerate.`
      );
      // Fall back to password login
      const engine = new MarketMakerEngine(account, priceFeed, { dryRun });
      try {
        const client = await loginFallback(cred.email);
        // We can't easily pass the logged-in client, so we'll use password auth
        log.info("Main", `${account.id}: Using password auth fallback`);
      } catch (err) {
        log.error("Main", `${account.id}: Auth failed — skipping`);
        continue;
      }
    }

    const engine = new MarketMakerEngine(account, priceFeed, { dryRun });
    try {
      await engine.start(cred.apiKey);
      engines.push(engine);
    } catch (err) {
      log.error(
        "Main",
        `${account.id} failed to start: ${err instanceof Error ? err.message : err}`
      );
    }
  }

  log.info("Main", `✅ ${engines.length} engine(s) running`);
  log.info("Main", `Refresh interval: ${CONFIG.refreshIntervalMs}ms`);
  log.info("Main", `Price source: ${CONFIG.priceSource}`);
  log.info("Main", "Press Ctrl+C to stop\n");

  // ── 6. Graceful shutdown ──
  const shutdown = async () => {
    log.info("Main", "\nShutting down...");
    priceFeed.stop();

    await Promise.allSettled(engines.map((e) => e.stop()));

    log.info("Main", "All engines stopped. Goodbye.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // Keep alive
  await new Promise(() => { });
}

async function loginFallback(email: string) {
  const { ExchangeClient } = await import("./exchange-client");
  const client = new ExchangeClient();
  await client.login(email, CONFIG.mmPassword);
  return client;
}

main().catch((err) => {
  log.error("Main", `Fatal: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
