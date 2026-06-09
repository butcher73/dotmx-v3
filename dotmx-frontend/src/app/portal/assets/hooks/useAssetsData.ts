import { useState, useCallback, useMemo } from "react";
import {
  apiClient,
  type UserBalance,
  type SupportedAsset,
  type NewListedAsset,
} from "@/services/ApiClient";

export function useAssetsData() {
  const [isLoading, setIsLoading] = useState(true);
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [assets, setAssets] = useState<SupportedAsset[]>([]);
  const [newListings, setNewListings] = useState<NewListedAsset[]>([]);

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true);

      // Fetch core data
      const [balancesResponse, assetsResponse] = await Promise.all([
        apiClient.getAssetBalances(),
        apiClient.getSupportedAssets(),
      ]);

      // Normalize balance field names (backend may return `symbol`/`name` or `asset_symbol`/`asset_name`)
      const normalizedBalances = (balancesResponse.balances || []).map((b) => ({
        ...(b as unknown as Record<string, unknown>),
        asset_symbol:
          (b.asset_symbol as string) ||
          ((b as unknown as Record<string, unknown>).symbol as string) ||
          "",
        asset_name:
          (b.asset_name as string) ||
          ((b as unknown as Record<string, unknown>).name as string) ||
          "",
      })) as UserBalance[];

      setBalances(normalizedBalances);
      setAssets(assetsResponse.assets || []);

      // Fetch new listings separately (fail gracefully if endpoint not available)
      try {
        const newListingsResponse = await apiClient.getNewListings(3);
        setNewListings(newListingsResponse.assets || []);
      } catch {
        // Fallback: use the first 3 assets sorted by symbol
        const fallbackListings = (assetsResponse.assets || [])
          .filter((a: SupportedAsset) => a.is_active)
          .slice(0, 3)
          .map((a: SupportedAsset) => ({
            id: a.symbol,
            symbol: a.symbol,
            name: a.name,
            asset_type: a.asset_type,
            icon_url: a.icon_url,
            listed_at: new Date().toISOString(),
            networks: [],
          }));
        setNewListings(fallbackListings);
      }
    } catch (err) {
      console.error("Failed to fetch data:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const totalBalance = useMemo(() => {
    return balances.reduce((sum, b) => sum + parseFloat(b.total || "0"), 0);
  }, [balances]);

  return {
    isLoading,
    balances,
    assets,
    newListings,
    totalBalance,
    fetchData,
  };
}
