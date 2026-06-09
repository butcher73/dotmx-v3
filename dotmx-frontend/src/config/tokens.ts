// Token contract addresses for all supported chains
// Addresses are organized by token symbol, then by chain ID
export const TOKEN_ADDRESSES = {
  USDT: {
    // BSC
    56: "0x55d398326f99059fF775485246999027B3197955", // BSC
    97: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd", // BSC Testnet
    // Optimism
    10: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", // Optimism Mainnet
    11155420: "0x5fd84259d9c077d8ae2e9e79b9e4a8b43bb0fa81", // Optimism Sepolia
    // Arbitrum
    42161: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", // Arbitrum Mainnet
    421614: "0xf25D8C66E4FEE3d3526ba8ef1C30D6B25A65D25e", // Arbitrum Sepolia Testnet
    // Base
    8453: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", // Base
    84532: "0x5fd84259d9c077d8ae2e9e79b9e4a8b43bb0fa81", // Base Sepolia
    // Worldchain
    480: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1", // Worldchain (placeholder - needs verification)
  },
  USDC: {
    // BSC
    56: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", // BSC
    97: "0x64544969ed7EBf5f083679233325356EbE738930", // BSC Testnet
    // Optimism
    10: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", // Optimism
    11155420: "0x5fd84259d9c077d8ae2e9e79b9e4a8b43bb0fa81", // Optimism Sepolia
    // Arbitrum
    42161: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", // Arbitrum Mainnet
    421614: "0x75faf114eafb1BDbe2F0316DF893fd58CE46AA4d", // Arbitrum Sepolia Testnet
    // Base
    8453: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", // Base
    84532: "0x036CbD53842c5426634e7929541eC2318f3dCF7e", // Base Sepolia
    // Worldchain
    480: "0x79A02482A880bCE3F13e09Da970dC34db4CD24d1", // Worldchain (placeholder - needs verification)
  },
  WETH: {
    // BSC (Wrapped ETH)
    56: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", // BSC
    97: "0xd66c6B4F0be8CE5b39D52E0Fd1344c389929B378", // BSC Testnet
    // Optimism (Native ETH)
    10: "0x4200000000000000000000000000000000000006", // Optimism
    11155420: "0x4200000000000000000000000000000000000006", // Optimism Sepolia
    // Arbitrum (Native ETH)
    42161: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", // Arbitrum Mainnet
    421614: "0xe39Ab88f8A4777030A534146A9Ca3B52bd5D43A3", // Arbitrum Sepolia Testnet
    // Base (Native ETH)
    8453: "0x4200000000000000000000000000000000000006", // Base
    84532: "0x4200000000000000000000000000000000000006", // Base Sepolia
    // Worldchain (Native ETH)
    480: "0x4200000000000000000000000000000000000006", // Worldchain (WETH - needs verification)
  },
  WBTC: {
    // BSC (Wrapped BTC)
    56: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", // BSC
    97: "0x6ce8dA28E2f864420840cF74474eFf5fD80E65B8", // BSC Testnet
    // Optimism
    10: "0x68f180fcCe6836688e9084f035309E29Bf0A2095", // Optimism
    11155420: "0x5fd84259d9c077d8ae2e9e79b9e4a8b43bb0fa81", // Optimism Sepolia (placeholder)
    // Arbitrum
    42161: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", // Arbitrum Mainnet
    421614: "0xf25D8C66E4FEE3d3526ba8ef1C30D6B25A65D25e", // Arbitrum Sepolia Testnet (placeholder)
    // Base
    8453: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c", // Base
    84532: "0x5fd84259d9c077d8ae2e9e79b9e4a8b43bb0fa81", // Base Sepolia (placeholder)
    // Worldchain
    480: "0x03C7054BCB39f7b2e5B2c7AcB37583e32D70Cfa3", // Worldchain (placeholder - needs verification)
  },
  BNB: {
    // BSC (Native BNB)
    56: "0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c", // BSC
    97: "0xae13d989daC2f0dEbFf460aC112a837C89BAa7cd", // BSC Testnet (WBNB)
    // Other chains don't have native BNB, would need wrapped versions
  },
  SOL: {
    // BSC (Wrapped SOL)
    56: "0x570A5D26f7765Ecb712C0924E4De545B89fD43dF", // BSC
    97: "0xfA54fF1a158B5189Ebba6ae130CEd6bbd3aEA76e", // BSC Testnet
    // Note: SOL is primarily on Solana network, these are wrapped versions
  },
  XRP: {
    // BSC (Wrapped XRP)
    56: "0x1D2F0da169ceB9fC7B3144628dB156f3F6c60dBE", // BSC
    97: "0xa83575490D7df4E2F47b7D38ef351a2722cA787b", // BSC Testnet
    // Note: XRP is primarily on XRP Ledger, these are wrapped versions
  },
} as const;

// Helper function to get token address for any supported chain
export const getTokenAddress = (
  token: keyof typeof TOKEN_ADDRESSES,
  chainId: number,
  fallbackChainId: number = 42161 // Default to Arbitrum since it's the only enabled chain
): string => {
  const tokenAddresses = TOKEN_ADDRESSES[token];
  return (
    tokenAddresses[chainId as keyof typeof tokenAddresses] ||
    tokenAddresses[fallbackChainId as keyof typeof tokenAddresses] ||
    ""
  );
};

// Chain names mapping
export const CHAIN_NAMES: Record<number, string> = {
  56: "BSC",
  97: "BSC Testnet",
  10: "Optimism",
  11155420: "Optimism Sepolia",
  42161: "Arbitrum One",
  421614: "Arbitrum Sepolia",
  8453: "Base",
  84532: "Base Sepolia",
  480: "Worldchain",
};

// Supported chains list
const SUPPORTED_CHAIN_IDS = [42161]; // Only Arbitrum One is supported

// Check if a chain is supported
export const isSupportedChain = (chainId: number): boolean => {
  return SUPPORTED_CHAIN_IDS.includes(chainId);
};
