/**
 * Trading Volume Hook
 * Returns mock volume metrics - data will come from backend API
 */

import { useState, useEffect } from "react";

export interface MarketVolume {
  symbol: string;
  market: string;
  volume: number;
  percentage: number;
  trades: number;
}

export interface HourlyVolume {
  hour: number;
  volume: number;
}

export interface VolumeMetrics {
  total24h: number;
  total7d: number;
  total30d: number;
  totalVolume24h: number;
  totalVolumeAll: number;
  tradeCount24h: number;
  avgTradeSize: number;
  hourlyData: HourlyVolume[];
  dailyData: { date: string; volume: number }[];
  volumeByHour: HourlyVolume[];
  volumeByMarket: MarketVolume[];
  topVolumeMarkets: MarketVolume[];
}

interface UseTradingVolumeResult {
  volumeMetrics: VolumeMetrics | null;
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook to get trading volume metrics
 * Returns mock data - real implementation will call backend API
 */
export function useTradingVolume(): UseTradingVolumeResult {
  const [volumeMetrics, setVolumeMetrics] = useState<VolumeMetrics | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [error] = useState<Error | null>(null);

  useEffect(() => {
    const hourlyData = Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      volume: Math.random() * 100000,
    }));

    const marketData: MarketVolume[] = [
      {
        symbol: "BTC-USDC",
        market: "BTC-USDC",
        volume: 500000,
        percentage: 40,
        trades: 512,
      },
      {
        symbol: "ETH-USDC",
        market: "ETH-USDC",
        volume: 350000,
        percentage: 28,
        trades: 384,
      },
      {
        symbol: "SOL-USDC",
        market: "SOL-USDC",
        volume: 200000,
        percentage: 16,
        trades: 216,
      },
      {
        symbol: "AVAX-USDC",
        market: "AVAX-USDC",
        volume: 100000,
        percentage: 8,
        trades: 98,
      },
      {
        symbol: "MATIC-USDC",
        market: "MATIC-USDC",
        volume: 100000,
        percentage: 8,
        trades: 24,
      },
    ];

    // Mock data for now
    const mockData: VolumeMetrics = {
      total24h: 1250000,
      total7d: 8750000,
      total30d: 35000000,
      totalVolume24h: 1250000,
      totalVolumeAll: 35000000,
      tradeCount24h: 1234,
      avgTradeSize: 1013.23,
      hourlyData,
      volumeByHour: hourlyData,
      dailyData: Array.from({ length: 7 }, (_, i) => ({
        date:
          new Date(Date.now() - i * 24 * 60 * 60 * 1000)
            .toISOString()
            .split("T")[0] ?? "",
        volume: Math.random() * 1000000,
      })),
      volumeByMarket: marketData,
      topVolumeMarkets: marketData.slice(0, 3),
    };

    setTimeout(() => {
      setVolumeMetrics(mockData);
      setIsLoading(false);
    }, 500);
  }, []);

  return {
    volumeMetrics,
    isLoading,
    error,
  };
}
