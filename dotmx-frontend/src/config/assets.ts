import {
  type AssetCategory,
  type AssetInfo,
  type CollateralAssetConfig,
} from "./types";

// Collateral asset configurations for perpetuals trading - these are settlement currencies
export const QUOTE_ASSETS_CONFIG: Record<string, CollateralAssetConfig> = {
  USDC: { symbol: "USDC", name: "USD Coin", isStablecoin: true, priority: 1 },
  USDT: { symbol: "USDT", name: "Tether", isStablecoin: true, priority: 2 },
  USD: { symbol: "USD", name: "US Dollar", isStablecoin: true, priority: 3 },
} as const;

// Extract collateral assets ordered by priority (for perpetuals settlement)
export const QUOTE_ASSETS = Object.values(QUOTE_ASSETS_CONFIG)
  .sort((a, b) => a.priority - b.priority)
  .map((asset) => asset.symbol);

// Underlying asset information - Assets available for perpetual futures trading
export const BASE_ASSETS: Record<string, AssetInfo> = {
  BTC: {
    symbol: "BTC",
    name: "Bitcoin",
    category: "major",
    decimals: 8,
    description: "The world's first cryptocurrency",
  },
  ETH: {
    symbol: "ETH",
    name: "Ethereum",
    category: "major",
    decimals: 18,
    description: "Smart contract platform",
  },
  BNB: {
    symbol: "BNB",
    name: "BNB",
    category: "major",
    decimals: 18,
    description: "Binance Coin for DeFi",
  },
  SOL: {
    symbol: "SOL",
    name: "Solana",
    category: "layer1",
    decimals: 9,
    description: "High-performance blockchain",
  },
  XRP: {
    symbol: "XRP",
    name: "XRP",
    category: "altcoin",
    decimals: 6,
    description: "Digital payment protocol",
  },
  ARB: {
    symbol: "ARB",
    name: "Arbitrum",
    category: "layer2",
    decimals: 18,
    description: "Ethereum Layer 2 scaling solution",
  },
};

// Utility functions for assets
export function getAssetInfo(symbol: string): AssetInfo | undefined {
  return BASE_ASSETS[symbol];
}

export function isStablecoin(symbol: string): boolean {
  const quoteConfig =
    QUOTE_ASSETS_CONFIG[symbol as keyof typeof QUOTE_ASSETS_CONFIG];
  return quoteConfig?.isStablecoin || false;
}

export function getAssetsByCategory(category: AssetCategory): AssetInfo[] {
  return Object.values(BASE_ASSETS).filter(
    (asset) => asset.category === category
  );
}

export function getSupportedCollateralAssets(): string[] {
  return QUOTE_ASSETS;
}
