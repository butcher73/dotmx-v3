import { BASE_ASSETS, QUOTE_ASSETS } from "./assets";
import { type AssetCategory, type PerpConfig } from "./types";

// Generate perp configs dynamically
function generatePerpConfig(
  assetSymbol: string,
  collateralSymbol: string
): PerpConfig {
  const asset = BASE_ASSETS[assetSymbol];

  // Map to Bitget futures symbol format
  // Internal format: BTCUSDC -> Bitget format: BTCUSDT (without _UMCBL suffix)
  const bitgetSymbol = `${assetSymbol}USDT`;

  return {
    symbol: `${assetSymbol}${collateralSymbol}`,
    displaySymbol: `${assetSymbol}-${collateralSymbol}`, // Use hyphen format for contracts
    asset: assetSymbol,
    collateral: collateralSymbol,
    displayCollateral: collateralSymbol,
    category: asset?.category || "altcoin",
    isActive: true,
    bitgetSymbol, // Bitget futures format (plain USDT symbol for v1 API)
  };
}

// Configuration for perpetuals - Limited to 5 assets only
export const PERP_CONFIGS: { [key: string]: PerpConfig } = {
  // Major pairs - Perpetuals market only (all with USDT collateral)
  BTCUSDT: generatePerpConfig("BTC", "USDT"),
  ETHUSDT: generatePerpConfig("ETH", "USDT"),
  BNBUSDT: generatePerpConfig("BNB", "USDT"),
  SOLUSDT: generatePerpConfig("SOL", "USDT"),
  XRPUSDT: generatePerpConfig("XRP", "USDT"),
  ARBUSDT: generatePerpConfig("ARB", "USDT"),
};

// Parse a trading symbol into asset and collateral assets
function parseSymbol(symbol: string): {
  asset: string;
  collateral: string;
} {
  // Handle slash-separated symbols like "BTC/USD" first
  if (symbol.includes("/")) {
    const parts = symbol.split("/");
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { asset: parts[0], collateral: parts[1] };
    }
  }

  // Handle hyphen-separated symbols like "BTC-USD"
  if (symbol.includes("-")) {
    const parts = symbol.split("-");
    if (parts.length === 2 && parts[0] && parts[1]) {
      return { asset: parts[0], collateral: parts[1] };
    }
  }

  // Try to find a matching quote asset by checking suffixes (original logic)
  for (const quoteAsset of QUOTE_ASSETS) {
    if (symbol.endsWith(quoteAsset)) {
      const asset = symbol.slice(0, -quoteAsset.length);
      if (asset.length > 0) {
        return { asset, collateral: quoteAsset };
      }
    }
  }

  // Fallback: assume it's a base asset with USDT
  return { asset: symbol, collateral: "USDT" };
}

// Main function to get perp config
export function getPerpConfig(symbol: string): PerpConfig {
  // Handle undefined or null symbol
  if (!symbol) {
    return PERP_CONFIGS["BTCUSDC"] as PerpConfig;
  }

  // Check if we have an exact match first
  if (PERP_CONFIGS[symbol]) {
    return PERP_CONFIGS[symbol] as PerpConfig;
  }

  // Try with USDT suffix for flat lookups
  const withUsdt = symbol.replace(/USDC$|USD$/, "USDT");
  if (PERP_CONFIGS[withUsdt]) {
    return PERP_CONFIGS[withUsdt] as PerpConfig;
  }

  // Parse the symbol to extract asset and collateral assets
  const { asset, collateral } = parseSymbol(symbol);
  const displaySymbol = `${asset}-${collateral}`; // Use hyphen format for contracts

  // Map to Bitget futures symbol format (plain USDT symbol for V2 API)
  const bitgetSymbol = `${asset}USDT`;

  return {
    symbol,
    displaySymbol,
    asset,
    collateral,
    displayCollateral: collateral,
    category: BASE_ASSETS[asset]?.category || "altcoin",
    isActive: true,
    bitgetSymbol, // Bitget futures format
  };
}

// Utility functions
export function formatSymbolForDisplay(symbol: string): string {
  const config = getPerpConfig(symbol);
  return config.displaySymbol;
}

export function getAsset(symbol: string): string {
  const config = getPerpConfig(symbol);
  return config.asset;
}

export function getCollateral(symbol: string): string {
  const config = getPerpConfig(symbol);
  return config.collateral;
}

export function getPerpsByCategory(category: AssetCategory): PerpConfig[] {
  return Object.values(PERP_CONFIGS).filter(
    (config) => config.category === category
  );
}

export function getActivePerps(): PerpConfig[] {
  return Object.values(PERP_CONFIGS).filter(
    (config) => config.isActive !== false
  );
}

export function addPerp(assetSymbol: string, collateralSymbol: string): void {
  const symbol = `${assetSymbol}${collateralSymbol}`;
  if (!PERP_CONFIGS[symbol]) {
    PERP_CONFIGS[symbol] = generatePerpConfig(assetSymbol, collateralSymbol);
  }
}

export function formatPriceByAsset(price: number, asset: string): string {
  const assetInfo = BASE_ASSETS[asset];
  const decimals = assetInfo?.decimals || 8;

  if (price >= 100000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    });
  } else if (price >= 10000) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    });
  } else if (price >= 1) {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    });
  } else {
    return price.toLocaleString("en-US", {
      minimumFractionDigits: 4,
      maximumFractionDigits: Math.min(decimals, 8),
    });
  }
}
