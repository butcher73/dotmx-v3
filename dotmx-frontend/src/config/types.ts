// Common types used across the trading application

export type AssetCategory =
  | "major"
  | "altcoin"
  | "defi"
  | "meme"
  | "layer1"
  | "layer2";

// Hook types (moved from hooks/types.ts)
export interface MarketDataItem {
  symbol: string;
  name: string;
  price: string;
  change: string;
  changePercent: number;
  volume: string;
  logo: string;
  rank: number;
  lastPrice: number;
  volume24h: number;
}

export interface KLineData {
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface Position {
  market: string;
  size: bigint;
  margin: bigint;
  leverage: number;
  isLong: boolean;
  price: bigint;
  funding: bigint;
  upl: bigint;
  user: string;
  timestamp: number;
}

export interface AssetInfo {
  symbol: string;
  name: string;
  category: AssetCategory;
  decimals: number;
  isStablecoin?: boolean;
  logoUrl?: string;
  description?: string;
}

export interface PerpConfig {
  symbol: string;
  displaySymbol: string;
  asset: string;
  collateral: string;
  displayCollateral: string;
  category?: AssetCategory;
  minPriceStep?: number;
  tickSize?: number;
  isActive?: boolean;
  bitgetSymbol?: string;
}

export interface CollateralAssetConfig {
  symbol: string;
  name: string;
  isStablecoin: boolean;
  priority: number;
}

export interface Symbol {
  symbol: string;
  displayName: string;
  asset: string;
  collateral: string;
  bitgetSymbol: string;
}

export interface TradingData {
  currentPrice: number;
  priceChange: number;
  priceChangePercent: number;
  asset: string;
  collateral: string;
  symbol: string;
  high24h: number;
  low24h: number;
  volume24h: string;
  total24h: string;
}

// Trading order types
export interface Order {
  id: string;
  time: string;
  symbol: string;
  side: "buy" | "sell" | "long" | "short";
  type: "limit" | "market" | "stop" | "stop_limit" | "stop_market";
  amount: number;
  price: number;
  status: "active" | "cancelled" | "executed" | "liquidated";
  leverage?: number | undefined;
  fee?: number | undefined;
  // Perps-specific fields
  fundingFee?: number | undefined;
  positionMargin?: number | undefined;
  isReduceOnly?: boolean | undefined;
  sizeUSD?: number | undefined;
  entryPrice?: number | undefined;
  marketPrice?: number | undefined;
  unrealizedPnl?: number | undefined;
  realizedPnl?: number | undefined;
}

export interface OrderRowProps {
  order: Order;
  onCancelled?: () => void;
  className?: string;
}

export interface OrderActionsProps {
  order: Order;
  onCancelled?: () => void;
}

export interface ActiveOrdersTableProps {
  className?: string;
}

export interface TableStateProps<T = Order> {
  orders: T[];
  error: string | null;
  isLoading: boolean;
  children: React.ReactNode;
  className?: string;
}
