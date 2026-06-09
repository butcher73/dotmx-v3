/**
 * Alchemy Webhook Types
 * 
 * Types for Alchemy's Address Activity Webhook API
 * @see https://docs.alchemy.com/reference/address-activity-webhook
 */

// =============================================================================
// WEBHOOK PAYLOAD TYPES
// =============================================================================

export type AlchemyNetwork = 
  | 'ETH_MAINNET' 
  | 'ETH_SEPOLIA'
  | 'MATIC_MAINNET' 
  | 'MATIC_AMOY'
  | 'ARB_MAINNET' 
  | 'ARB_SEPOLIA'
  | 'OPT_MAINNET'
  | 'OPT_SEPOLIA'
  | 'BASE_MAINNET'
  | 'BASE_SEPOLIA'
  | 'BNB_MAINNET'
  | 'SOLANA_MAINNET'
  | 'ZKSYNC_MAINNET'
  | 'ZKSYNC_SEPOLIA';

export type AlchemyCategory = 
  | 'external'   // Native token transfers
  | 'internal'   // Internal transactions (contract calls)
  | 'erc20'      // ERC-20 token transfers
  | 'erc721'     // ERC-721 NFT transfers
  | 'erc1155';   // ERC-1155 multi-token transfers

export interface AlchemyRawContract {
  rawValue: string;          // Hex value (e.g., "0x100")
  address: string | null;    // Token contract address (null for native)
  decimals: number;          // Token decimals (18 for ETH)
}

export interface AlchemyActivity {
  fromAddress: string;       // Sender address
  toAddress: string;         // Recipient address
  blockNum: string;          // Hex block number (e.g., "0x1234")
  hash: string;              // Transaction hash
  value: number;             // Parsed value (may lose precision for large numbers)
  asset: string;             // Asset symbol (e.g., "ETH", "USDT")
  category: AlchemyCategory; // Transaction category
  rawContract: AlchemyRawContract;
  log?: {                    // Present for token transfers
    address: string;         // Token contract address
    topics: string[];        // Event topics
    data: string;            // Event data
    blockNumber: string;     // Hex block number
    transactionHash: string; // Transaction hash
    transactionIndex: string;
    blockHash: string;
    logIndex: string;
    removed: boolean;
  };
}

export interface AlchemyWebhookEvent {
  network: AlchemyNetwork;
  activity: AlchemyActivity[];
}

export interface AlchemyWebhookPayload {
  webhookId: string;         // Alchemy webhook ID
  id: string;                // Event ID
  createdAt: string;         // ISO timestamp
  type: 'ADDRESS_ACTIVITY' | 'MINED_TRANSACTION' | 'DROPPED_TRANSACTION';
  event: AlchemyWebhookEvent;
}

// =============================================================================
// API TYPES
// =============================================================================

export interface AlchemyWebhookConfig {
  id: string;
  network: AlchemyNetwork;
  webhook_type: string;
  webhook_url: string;
  is_active: boolean;
  time_created: number;
  signing_key: string;
  version: string;
  addresses: string[];
}

export interface AlchemyCreateWebhookRequest {
  network: AlchemyNetwork;
  webhook_type: 'ADDRESS_ACTIVITY';
  webhook_url: string;
  addresses?: string[];
}

export interface AlchemyAddAddressesRequest {
  webhook_id: string;
  addresses_to_add: string[];
}

export interface AlchemyRemoveAddressesRequest {
  webhook_id: string;
  addresses_to_remove: string[];
}

export interface AlchemyWebhookResponse {
  data: AlchemyWebhookConfig;
}

export interface AlchemyWebhooksListResponse {
  data: AlchemyWebhookConfig[];
}

export interface AlchemyAddressesResponse {
  data: {
    addresses: string[];
    totalCount: number;
  };
}

// =============================================================================
// CHAIN CODE MAPPING
// =============================================================================

export const ALCHEMY_NETWORK_TO_CHAIN_CODE: Record<string, string> = {
  ETH_MAINNET: 'ETH',
  ETH_SEPOLIA: 'SEP',
  MATIC_MAINNET: 'MATIC',
  MATIC_AMOY: 'POLYGON_AMOY',
  ARB_MAINNET: 'ARB',
  ARB_SEPOLIA: 'ARBITRUM_SEPOLIA',
  OPT_MAINNET: 'OP',
  OPT_SEPOLIA: 'OPTIMISM_SEPOLIA',
  BASE_MAINNET: 'BASE',
  BASE_SEPOLIA: 'BASE_SEPOLIA',
  BNB_MAINNET: 'BNB',
  SOLANA_MAINNET: 'SOL',
  ZKSYNC_MAINNET: 'ZKSYNC',
  ZKSYNC_SEPOLIA: 'ZKSYNC_SEPOLIA',
};

export const CHAIN_CODE_TO_ALCHEMY_NETWORK: Record<string, AlchemyNetwork> = {
  ETH: 'ETH_MAINNET',
  SEP: 'ETH_SEPOLIA',
  ETH_SEPOLIA: 'ETH_SEPOLIA',
  POLYGON: 'MATIC_MAINNET',
  MATIC: 'MATIC_MAINNET',
  POLYGON_AMOY: 'MATIC_AMOY',
  ARBITRUM: 'ARB_MAINNET',
  ARB: 'ARB_MAINNET',
  ARBITRUM_SEPOLIA: 'ARB_SEPOLIA',
  OPTIMISM: 'OPT_MAINNET',
  OP: 'OPT_MAINNET',
  OPTIMISM_SEPOLIA: 'OPT_SEPOLIA',
  BASE: 'BASE_MAINNET',
  BASE_SEPOLIA: 'BASE_SEPOLIA',
  BSC: 'BNB_MAINNET',
  BNB: 'BNB_MAINNET',
  SOL: 'SOLANA_MAINNET',
  ZKSYNC: 'ZKSYNC_MAINNET',
  ZKSYNC_SEPOLIA: 'ZKSYNC_SEPOLIA',
};

export const NATIVE_SYMBOLS: Record<string, string> = {
  ETH: 'ETH',
  SEP: 'ETH',
  ETH_SEPOLIA: 'ETH',
  POLYGON: 'MATIC',
  MATIC: 'MATIC',
  POLYGON_AMOY: 'MATIC',
  ARB: 'ETH',
  ARBITRUM: 'ETH',
  ARBITRUM_SEPOLIA: 'ETH',
  OP: 'ETH',
  OPTIMISM: 'ETH',
  OPTIMISM_SEPOLIA: 'ETH',
  BASE: 'ETH',
  BASE_SEPOLIA: 'ETH',
  BSC: 'BNB',
  BNB: 'BNB',
  SOL: 'SOL',
  ZKSYNC: 'ETH',
  ZKSYNC_SEPOLIA: 'ETH',
};
