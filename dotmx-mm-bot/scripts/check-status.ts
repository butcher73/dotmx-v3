/**
 * Check MM Bot Status
 *
 * Queries balances and open orders for all MM bot accounts.
 *
 * Usage:
 *   bun run scripts/check-status.ts
 */

import { MM_ACCOUNTS, CONFIG } from "../src/config";
import { ExchangeClient } from "../src/exchange-client";

interface Credential {
  id: string;
  email: string;
  userId: string;
  apiKey: string;
}

async function main() {
  const credsPath = `${import.meta.dir}/../.mm-credentials.json`;
  let credentials: Credential[];

  try {
    const file = Bun.file(credsPath);
    credentials = await file.json();
  } catch {
    console.error("❌ Cannot load .mm-credentials.json — run `bun run seed` first");
    process.exit(1);
  }

  console.log("\n═══════════════════════════════════════════════════════════════");
  console.log("  DotMX MM Bot Status");
  console.log("═══════════════════════════════════════════════════════════════\n");

  for (const account of MM_ACCOUNTS) {
    const cred = credentials.find((c) => c.id === account.id);
    if (!cred) {
      console.log(`${account.id}: ⚠️  No credentials found`);
      continue;
    }

    const client = new ExchangeClient();

    try {
      // Try API key first, fall back to login
      if (!cred.apiKey.includes("already created")) {
        client.setApiKey(cred.apiKey);
      } else {
        await client.login(cred.email, CONFIG.mmPassword);
      }

      // Get balances
      const { balances } = await client.getBalances();
      const usdtBal = balances.find((b) => b.symbol === "USDT");
      const btcBal = balances.find((b) => b.symbol === "BTC");
      const ethBal = balances.find((b) => b.symbol === "ETH");

      // Get open orders count
      let openOrdersCount = 0;
      for (const market of account.markets) {
        try {
          const orders = await client.getOpenOrders(market);
          openOrdersCount += orders.length;
        } catch {
          // Market might not have orders
        }
      }

      console.log(`${account.id} (${account.firstName} ${account.lastName})`);
      console.log(`  Markets: ${account.markets.join(", ")}`);
      console.log(`  Strategy: ${account.strategy} | Spread: ${account.spreadBps}bps`);
      console.log(
        `  USDT: $${Number(usdtBal?.available || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} available / $${Number(usdtBal?.locked || 0).toLocaleString()} locked`
      );
      if (btcBal && Number(btcBal.available) > 0) {
        console.log(`  BTC:  ${Number(btcBal.available).toFixed(8)} available`);
      }
      if (ethBal && Number(ethBal.available) > 0) {
        console.log(`  ETH:  ${Number(ethBal.available).toFixed(8)} available`);
      }
      console.log(`  Open Orders: ${openOrdersCount}`);
      console.log("");
    } catch (err) {
      console.log(`${account.id}: ❌ ${err instanceof Error ? err.message : err}\n`);
    }
  }
}

main().catch(console.error);
