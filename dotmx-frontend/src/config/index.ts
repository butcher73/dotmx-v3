// Centralized configuration exports
export * from "./types";
export * from "./tokens";
export * from "./assets";
export * from "./perps";
export * from "./env";
export * from "./constants";

// Re-export commonly used items with shorter names
export {
  PERP_CONFIGS as perpConfigs,
  getPerpConfig,
  formatSymbolForDisplay,
  getAsset,
  getCollateral,
} from "./perps";

export {
  BASE_ASSETS as assets,
  QUOTE_ASSETS as collaterals,
  getAssetInfo,
  isStablecoin,
} from "./assets";

export {
  TOKEN_ADDRESSES as tokenAddresses,
  getTokenAddress,
  CHAIN_NAMES as chainNames,
  isSupportedChain,
} from "./tokens";

// Environment configuration utilities
export {
  env,
  getEnvConfig,
  validateEnvironment,
  logEnvironmentStatus,
} from "./env";
