/**
 * Seed Market-Making Accounts
 *
 * Creates 10 accounts in the database, seeds each with $1,000,000 USDT,
 * and generates API keys for bot authentication.
 *
 * Accounts use realistic human identities — nothing in the DB reveals
 * that these are market-making bots.
 *
 * Usage:
 *   bun run scripts/seed-mm-accounts.ts
 *   bun run scripts/seed-mm-accounts.ts --reset   # Drop and recreate
 *
 * This script is idempotent — safe to run multiple times.
 */

import pg from "pg";
import { MM_ACCOUNTS, CONFIG } from "../src/config";

const { Pool } = pg;

const RESET = process.argv.includes("--reset");

// Stagger account creation dates to look organic
function randomCreatedAt(): Date {
  const now = Date.now();
  const daysAgo = Math.floor(Math.random() * 180) + 30; // 30–210 days ago
  const jitter = Math.floor(Math.random() * 86400000); // random time within the day
  return new Date(now - daysAgo * 86400000 - jitter);
}

async function main() {
  const pool = new Pool({ connectionString: CONFIG.databaseUrl });

  try {
    console.log("🔄 Connecting to database...");
    await pool.query("SELECT 1");
    console.log("✅ Connected\n");

    // Get USDT asset ID
    const assetResult = await pool.query(
      `SELECT id FROM assets WHERE symbol = 'USDT'`
    );
    if (assetResult.rows.length === 0) {
      throw new Error("USDT asset not found. Run seed.sql first.");
    }
    const usdtAssetId = assetResult.rows[0].id;
    console.log(`📦 USDT asset ID: ${usdtAssetId}\n`);

    // Also get BTC, ETH asset IDs for cross-pair bots that need base asset
    const btcResult = await pool.query(
      `SELECT id FROM assets WHERE symbol = 'BTC'`
    );
    const ethResult = await pool.query(
      `SELECT id FROM assets WHERE symbol = 'ETH'`
    );
    const btcAssetId = btcResult.rows[0]?.id;
    const ethAssetId = ethResult.rows[0]?.id;

    const results: {
      id: string;
      email: string;
      userId: string;
      apiKey: string;
    }[] = [];

    for (const account of MM_ACCOUNTS) {
      console.log(`━━━ ${account.id}: ${account.firstName} ${account.lastName} ━━━`);

      // ── 1. Create or find user ──
      let userId: string;

      if (RESET) {
        // Delete existing user and let it be recreated
        await pool.query(`DELETE FROM users WHERE email = $1`, [account.email]);
        console.log(`  🗑️  Deleted existing user (--reset)`);
      }

      const existingUser = await pool.query(
        `SELECT id FROM users WHERE email = $1`,
        [account.email]
      );

      if (existingUser.rows.length > 0) {
        userId = existingUser.rows[0].id;
        console.log(`  ✓ User exists: ${userId}`);
      } else {
        // Hash password with argon2id (same as auth service)
        const passwordHash = await Bun.password.hash(CONFIG.mmPassword, {
          algorithm: "argon2id",
          memoryCost: 65536,
          timeCost: 3,
        });

        // Randomize KYC level (most real users are level 1–2)
        const kycLevel = Math.random() < 0.6 ? 2 : Math.random() < 0.5 ? 1 : 3;
        const createdAt = randomCreatedAt();

        const insertResult = await pool.query(
          `INSERT INTO users (
            email, password_hash, first_name, last_name, username,
            role, status, email_verified, kyc_verified, kyc_level,
            is_market_maker, api_enabled, account_type,
            created_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            'user', 'active', true, true, $6,
            false, false, 'retail',
            $7
          ) RETURNING id`,
          [
            account.email,
            passwordHash,
            account.firstName,
            account.lastName,
            account.username,
            kycLevel,
            createdAt,
          ]
        );
        userId = insertResult.rows[0].id;
        console.log(`  ✅ Created user: ${userId} (joined ${createdAt.toISOString().split("T")[0]})`);
      }

      // ── 2. Seed USDT balance ──
      const balanceResult = await pool.query(
        `SELECT available FROM user_balances WHERE user_id = $1 AND asset_id = $2`,
        [userId, usdtAssetId]
      );

      if (balanceResult.rows.length > 0) {
        const current = Number(balanceResult.rows[0].available);
        if (current >= account.seedBalanceUsd) {
          console.log(
            `  ✓ USDT balance already seeded: $${current.toLocaleString()}`
          );
        } else {
          const topUp = account.seedBalanceUsd - current;
          await creditBalance(
            pool,
            userId,
            usdtAssetId,
            topUp,
            "Wire transfer deposit"
          );
          console.log(
            `  💰 Topped up USDT: +$${topUp.toLocaleString()} (total: $${account.seedBalanceUsd.toLocaleString()})`
          );
        }
      } else {
        await creditBalance(
          pool,
          userId,
          usdtAssetId,
          account.seedBalanceUsd,
          "Initial deposit"
        );
        console.log(
          `  💰 Seeded USDT: $${account.seedBalanceUsd.toLocaleString()}`
        );
      }

      // ── 3. Seed base asset balances for cross pairs ──
      for (const market of account.markets) {
        const [base] = market.split("-");
        if (base === "BTC" && btcAssetId) {
          await ensureBaseAsset(
            pool,
            userId,
            btcAssetId,
            10,
            "BTC"
          );
        } else if (base === "ETH" && ethAssetId) {
          await ensureBaseAsset(
            pool,
            userId,
            ethAssetId,
            100,
            "ETH"
          );
        }
      }

      // ── 4. Generate API key ──
      const apiKey = await ensureApiKey(pool, userId, account.username);
      console.log(`  🔑 API Key: ${apiKey.substring(0, 20)}...`);

      results.push({ id: account.id, email: account.email, userId, apiKey });
      console.log("");
    }

    // ── Summary ──
    console.log("\n═══════════════════════════════════════");
    console.log("  Accounts Summary");
    console.log("═══════════════════════════════════════\n");
    console.log(
      `Total accounts: ${results.length}`,
      `| Total seeded: $${(MM_ACCOUNTS.reduce((s, a) => s + a.seedBalanceUsd, 0)).toLocaleString()}`
    );
    console.log("");

    // Write credentials to file
    const credsPath = `${import.meta.dir}/../.mm-credentials.json`;
    const creds = results.map((r) => ({
      id: r.id,
      email: r.email,
      userId: r.userId,
      apiKey: r.apiKey,
    }));
    await Bun.write(credsPath, JSON.stringify(creds, null, 2));
    console.log(`📝 Credentials saved to .mm-credentials.json`);
    console.log(`⚠️  Keep this file secure — do NOT commit to git.\n`);
  } finally {
    await pool.end();
  }
}

// ─── Helpers ───────────────────────────────────────────────────────────

async function creditBalance(
  pool: pg.Pool,
  userId: string,
  assetId: string,
  amount: number,
  description: string
) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");

    // Get current balance (for audit trail)
    const current = await client.query(
      `SELECT available FROM user_balances WHERE user_id = $1 AND asset_id = $2`,
      [userId, assetId]
    );
    const balanceBefore = current.rows.length > 0
      ? Number(current.rows[0].available)
      : 0;

    // Upsert balance
    await client.query(
      `INSERT INTO user_balances (user_id, asset_id, available, total_deposited)
       VALUES ($1, $2, $3, $3)
       ON CONFLICT (user_id, asset_id)
       DO UPDATE SET
         available = user_balances.available + $3,
         total_deposited = user_balances.total_deposited + $3,
         last_updated_at = NOW()`,
      [userId, assetId, amount]
    );

    // Audit trail
    await client.query(
      `INSERT INTO balance_transactions
        (user_id, asset_id, tx_type, amount, balance_before, balance_after, status, description)
       VALUES ($1, $2, 'deposit', $3, $4, $5, 'completed', $6)`,
      [userId, assetId, amount, balanceBefore, balanceBefore + amount, description]
    );

    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}

async function ensureBaseAsset(
  pool: pg.Pool,
  userId: string,
  assetId: string,
  amount: number,
  symbol: string
) {
  const existing = await pool.query(
    `SELECT available FROM user_balances WHERE user_id = $1 AND asset_id = $2`,
    [userId, assetId]
  );
  if (existing.rows.length === 0 || Number(existing.rows[0].available) < amount) {
    const current = existing.rows.length > 0
      ? Number(existing.rows[0].available)
      : 0;
    const needed = amount - current;
    if (needed > 0) {
      await creditBalance(
        pool,
        userId,
        assetId,
        needed,
        `${symbol} deposit confirmed`
      );
      console.log(`  💰 Seeded ${symbol}: ${amount}`);
    }
  }
}

async function ensureApiKey(
  pool: pg.Pool,
  userId: string,
  username: string
): Promise<string> {
  // Use a generic, human-looking key name
  const keyName = "Trading API";

  // Check for existing key — delete it so we can regenerate with correct HMAC
  const existing = await pool.query(
    `SELECT id, key_prefix FROM api_keys WHERE user_id = $1 AND name = $2 AND is_active = true`,
    [userId, keyName]
  );

  if (existing.rows.length > 0) {
    // Delete old key(s) so we regenerate with the correct HMAC secret
    await pool.query(
      `DELETE FROM api_keys WHERE user_id = $1 AND name = $2`,
      [userId, keyName]
    );
    console.log(`  🔄 Rotated old API key for ${username}`);
  }

  // Generate a normal-looking API key (same format as real users get)
  const rawKey = `dmx_${crypto.randomUUID().replace(/-/g, "")}`;
  const keyPrefix = rawKey.substring(0, 12);

  // Hash with HMAC-SHA256 (matching auth service behavior)
  // Must use the same secret as the backend: API_KEY_HMAC_SECRET || JWT_SECRET || 'api-key-secret'
  const hmacSecret =
    process.env.API_KEY_HMAC_SECRET ||
    process.env.JWT_SECRET ||
    "";
  if (!hmacSecret) {
    console.error("❌ API_KEY_HMAC_SECRET or JWT_SECRET must be set");
    process.exit(1);
  }
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(hmacSecret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    "HMAC",
    keyMaterial,
    encoder.encode(rawKey)
  );
  const keyHash = Buffer.from(signature).toString("hex");

  await pool.query(
    `INSERT INTO api_keys (user_id, key_hash, key_prefix, name, scopes, rate_limit_per_minute)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [
      userId,
      keyHash,
      keyPrefix,
      keyName,
      ["trading", "read"],
      300, // Standard rate limit (don't stand out)
    ]
  );

  return rawKey;
}

main().catch((err) => {
  console.error("❌ Seed failed:", err);
  process.exit(1);
});
