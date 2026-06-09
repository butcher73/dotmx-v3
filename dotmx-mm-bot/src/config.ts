/**
 * MM Bot Configuration
 *
 * Central configuration for all market-making accounts and strategies.
 * Each MM account specializes in specific markets to avoid self-trading.
 *
 * Accounts use realistic human identities so they appear as organic users
 * on the platform. Only this config file and .mm-credentials.json link
 * them to market-making activity.
 */

// ─── Market Making Account Definitions ─────────────────────────────────

export interface MmAccountConfig {
  /** Internal identifier (never exposed to UI/DB) */
  id: string;
  /** Realistic email */
  email: string;
  /** Human first name */
  firstName: string;
  /** Human last name */
  lastName: string;
  /** Username (natural-looking) */
  username: string;
  /** Markets this account provides liquidity for */
  markets: string[];
  /** Initial USDT balance to seed */
  seedBalanceUsd: number;
  /** Strategy to use */
  strategy: "symmetric" | "skewed" | "passive";
  /** Spread in basis points */
  spreadBps: number;
  /** Number of order levels on each side */
  levels: number;
  /** Order size per level (USD) */
  orderSizeUsd: number;
  /** Max position exposure (USD) */
  maxPositionUsd: number;
}

export const MM_ACCOUNTS: MmAccountConfig[] = [
  {
    id: "mm-01",
    email: "marcus.tanaka@proton.me",
    firstName: "Marcus",
    lastName: "Tanaka",
    username: "mtanaka",
    markets: ["BTC-USDT"],
    seedBalanceUsd: 1_000_000,
    strategy: "symmetric",
    spreadBps: 30,
    levels: 10,
    orderSizeUsd: 5000,
    maxPositionUsd: 100_000,
  },
  {
    id: "mm-02",
    email: "elena.ivanova@gmail.com",
    firstName: "Elena",
    lastName: "Ivanova",
    username: "eivanova92",
    markets: ["BTC-USDT", "BTC-USDC"],
    seedBalanceUsd: 1_000_000,
    strategy: "skewed",
    spreadBps: 40,
    levels: 8,
    orderSizeUsd: 3000,
    maxPositionUsd: 80_000,
  },
  {
    id: "mm-03",
    email: "james.oconnor@outlook.com",
    firstName: "James",
    lastName: "O'Connor",
    username: "joconnor",
    markets: ["ETH-USDT"],
    seedBalanceUsd: 1_000_000,
    strategy: "symmetric",
    spreadBps: 30,
    levels: 10,
    orderSizeUsd: 3000,
    maxPositionUsd: 80_000,
  },
  {
    id: "mm-04",
    email: "priya.sharma@yahoo.com",
    firstName: "Priya",
    lastName: "Sharma",
    username: "priya_s",
    markets: ["ETH-USDC", "ETH-BTC"],
    seedBalanceUsd: 1_000_000,
    strategy: "symmetric",
    spreadBps: 50,
    levels: 6,
    orderSizeUsd: 2000,
    maxPositionUsd: 60_000,
  },
  {
    id: "mm-05",
    email: "lukas.weber@gmx.de",
    firstName: "Lukas",
    lastName: "Weber",
    username: "lweber88",
    markets: ["SOL-USDT", "BNB-USDT"],
    seedBalanceUsd: 1_000_000,
    strategy: "symmetric",
    spreadBps: 50,
    levels: 8,
    orderSizeUsd: 2000,
    maxPositionUsd: 60_000,
  },
  {
    id: "mm-06",
    email: "sofia.chen@icloud.com",
    firstName: "Sofia",
    lastName: "Chen",
    username: "sofiac",
    markets: ["ARB-USDT", "OP-USDT"],
    seedBalanceUsd: 1_000_000,
    strategy: "symmetric",
    spreadBps: 80,
    levels: 6,
    orderSizeUsd: 1500,
    maxPositionUsd: 40_000,
  },
  {
    id: "mm-07",
    email: "daniel.kim@protonmail.com",
    firstName: "Daniel",
    lastName: "Kim",
    username: "dkim_trader",
    markets: ["DMX-USDT"],
    seedBalanceUsd: 1_000_000,
    strategy: "skewed",
    spreadBps: 100,
    levels: 8,
    orderSizeUsd: 1000,
    maxPositionUsd: 30_000,
  },
  {
    id: "mm-08",
    email: "anna.mueller@web.de",
    firstName: "Anna",
    lastName: "Mueller",
    username: "amueller",
    markets: ["DAI-USDT", "WBTC-USDT"],
    seedBalanceUsd: 1_000_000,
    strategy: "passive",
    spreadBps: 20,
    levels: 5,
    orderSizeUsd: 5000,
    maxPositionUsd: 50_000,
  },
  {
    id: "mm-09",
    email: "carlos.reyes@hotmail.com",
    firstName: "Carlos",
    lastName: "Reyes",
    username: "creyes",
    markets: ["DOGE-USDT"],
    seedBalanceUsd: 1_000_000,
    strategy: "symmetric",
    spreadBps: 80,
    levels: 6,
    orderSizeUsd: 1500,
    maxPositionUsd: 40_000,
  },
  {
    id: "mm-10",
    email: "yuki.nakamura@pm.me",
    firstName: "Yuki",
    lastName: "Nakamura",
    username: "ynakamura",
    markets: ["BTC-USDT", "ETH-USDT"],
    seedBalanceUsd: 1_000_000,
    strategy: "passive",
    spreadBps: 60,
    levels: 5,
    orderSizeUsd: 2000,
    maxPositionUsd: 50_000,
  },
];

// ─── Global Configuration ──────────────────────────────────────────────

export const CONFIG = {
  /** Password for all MM accounts (required — set via MM_PASSWORD env var) */
  mmPassword: process.env.MM_PASSWORD || "",

  /** Database */
  databaseUrl:
    process.env.DATABASE_URL ||
    "postgresql://dotmx:dotmx_dev@localhost:5432/dotmx",

  /** Exchange API */
  apiBaseUrl: process.env.API_BASE_URL || "http://localhost:8080/api",
  wsMarketUrl:
    process.env.WS_MARKET_URL || "ws://localhost:8080/api/ws/market",

  /** Binance reference price feed */
  priceSource: (process.env.PRICE_SOURCE || "binance") as
    | "binance"
    | "internal",
  binanceWsUrl:
    process.env.BINANCE_WS_URL || "wss://stream.binance.com:9443/ws",

  /** Refresh interval (ms) */
  refreshIntervalMs: Number(process.env.REFRESH_INTERVAL_MS) || 5000,

  /** Risk management */
  inventorySkew: Number(process.env.INVENTORY_SKEW) || 0.3,
  maxLossUsd: Number(process.env.MAX_LOSS_USD) || 10_000,

  /** DotMX symbol → Binance symbol mapping */
  symbolMap: {
    "BTC-USDT": "btcusdt",
    "ETH-USDT": "ethusdt",
    "BNB-USDT": "bnbusdt",
    "SOL-USDT": "solusdt",
    "ARB-USDT": "arbusdt",
    "OP-USDT": "opusdt",
    "DMX-USDT": null, // No Binance equivalent
    "ETH-BTC": "ethbtc",
    "BTC-USDC": "btcusdc",
    "ETH-USDC": "ethusdc",
    "DAI-USDT": "daiusdt",
    "WBTC-USDT": "wbtcusdt",
    "DOGE-USDT": "dogeusdt",
  } as Record<string, string | null>,
} as const;
