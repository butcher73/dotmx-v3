"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  apiClient,
  type SupportedAsset,
  type DepositAddress,
  type NetworkInfo,
} from "@/services/ApiClient";
import { Loader2, AlertCircle } from "lucide-react";
import { PortalPageLayout, PortalPageHeader } from "@/components/ui";
import {
  TokenSelector,
  NetworkSelector,
  DepositAddressCard,
  RecentDeposits,
  DepositSidebar,
  type Deposit,
} from "@/components/deposit";

export default function DepositPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  // State
  const [assets, setAssets] = useState<SupportedAsset[]>([]);
  const [selectedToken, setSelectedToken] = useState<string>("");
  const [selectedNetwork, setSelectedNetwork] = useState<string>("");
  const [depositAddress, setDepositAddress] = useState<DepositAddress | null>(
    null
  );
  const [existingAddresses, setExistingAddresses] = useState<DepositAddress[]>(
    []
  );
  const [deposits, setDeposits] = useState<Deposit[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Auth redirect
  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Fetch initial data from API
  const fetchInitialData = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Fetch tokens from API (uses admin panel data: tokens + token_chains + chains)
      const assetsRes = await apiClient.getDepositTokens();

      // Filter to only show ACTIVE tokens with at least one deposit-enabled network
      // Backend should already filter, but adding safety check
      const depositableAssets = (assetsRes.assets || []).filter(
        (asset: SupportedAsset) =>
          // Token must be active (if field exists, default to true for backwards compat)
          asset.is_active !== false &&
          // Must have networks array
          asset.networks &&
          asset.networks.length > 0 &&
          // Must have at least one deposit-enabled network
          asset.networks.some((n: NetworkInfo) => n.deposit_enabled)
      );

      if (depositableAssets.length === 0) {
        setError(
          "No deposit-enabled assets available. Please enable deposits for at least one network in the admin panel."
        );
        setIsLoading(false);
        return;
      }

      setAssets(depositableAssets);

      // Fetch existing deposit addresses (optional - don't fail if unavailable)
      try {
        const addressesRes = await apiClient.getAllDepositAddresses();
        setExistingAddresses(addressesRes.addresses || []);
      } catch {
        console.warn("Deposit addresses not available");
      }

      // Fetch deposit history (optional - don't fail if unavailable)
      try {
        const res = await apiClient.getWalletDeposits({ limit: 10 });
        if (res.deposits && Array.isArray(res.deposits)) {
          const depositTxs = res.deposits.map((d) => ({
            id: d.id,
            network_code: d.network_code || "",
            asset_symbol: d.asset_symbol || "",
            amount: d.amount,
            tx_hash: d.tx_hash || "",
            status: d.status || "pending",
            confirmations: d.confirmations || 0,
            detected_at: d.detected_at || d.created_at,
            confirmed_at: d.confirmed_at || null,
            credited_at: d.swept_at || d.confirmed_at || null,
            created_at: d.created_at,
          }));
          setDeposits(depositTxs);
        }
      } catch {
        console.warn("Deposit history not available");
      }
    } catch (err: unknown) {
      console.error("Failed to load assets:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      setError(`Failed to load deposit options: ${errorMessage}`);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (isAuthenticated) {
      fetchInitialData();
    }
  }, [isAuthenticated, fetchInitialData]);

  // Get available networks for selected token
  const availableNetworks = useMemo(() => {
    if (!selectedToken) return [];
    const asset = assets.find((a) => a.symbol === selectedToken);
    return asset?.networks.filter((n) => n.deposit_enabled) || [];
  }, [selectedToken, assets]);

  // Auto-select first network when token is selected
  useEffect(() => {
    if (selectedToken && availableNetworks.length > 0 && !selectedNetwork) {
      setSelectedNetwork(availableNetworks[0]?.network_code || "");
    }
  }, [selectedToken, availableNetworks, selectedNetwork]);

  // Handle token selection
  const handleSelectToken = (symbol: string) => {
    setSelectedToken(symbol);
    setSelectedNetwork("");
    setDepositAddress(null);
    setError(null);
  };

  // Handle network selection and generate address
  const handleSelectNetwork = async (networkCode: string) => {
    setSelectedNetwork(networkCode);
    setError(null);

    // Check if address already exists for this network
    const existingAddr = existingAddresses.find(
      (a) => a.network_code === networkCode && a.asset_symbol === selectedToken
    );
    if (existingAddr) {
      setDepositAddress(existingAddr);
      return;
    }

    // Generate new address
    await requestDepositAddress(selectedToken, networkCode);
  };

  // Request deposit address
  const requestDepositAddress = async (
    assetSymbol: string,
    networkCode: string
  ) => {
    setIsGenerating(true);
    setError(null);

    try {
      const result = await apiClient.getDepositAddress(
        assetSymbol,
        networkCode
      );
      setDepositAddress(result.address);

      setExistingAddresses((prev) => {
        const exists = prev.some(
          (a) =>
            a.network_code === result.address.network_code &&
            a.asset_symbol === result.address.asset_symbol
        );
        if (exists) return prev;
        return [...prev, result.address];
      });
    } catch (err) {
      console.error("Failed to generate address:", err);
      const errorMessage =
        err instanceof Error
          ? err.message
          : "Failed to generate deposit address. Please try again.";
      setError(errorMessage);
    } finally {
      setIsGenerating(false);
    }
  };

  // Refresh deposits
  const refreshDeposits = async () => {
    setIsRefreshing(true);
    try {
      const res = await apiClient.getWalletDeposits({ limit: 10 });

      if (res.deposits && Array.isArray(res.deposits)) {
        const depositTxs = res.deposits.map((d) => ({
          id: d.id,
          network_code: d.network_code || "",
          asset_symbol: d.asset_symbol || "",
          amount: d.amount,
          tx_hash: d.tx_hash || "",
          status: d.status || "pending",
          confirmations: d.confirmations || 0,
          detected_at: d.detected_at || d.created_at,
          confirmed_at: d.confirmed_at || null,
          credited_at: d.swept_at || d.confirmed_at || null,
          created_at: d.created_at,
        }));
        setDeposits(depositTxs);
      } else {
        setDeposits([]);
      }
    } catch (err) {
      console.error("Failed to refresh deposits:", err);
      setDeposits([]);
    } finally {
      setIsRefreshing(false);
    }
  };

  // Get minimum deposit amount for selected network
  const minDeposit = useMemo(() => {
    if (!selectedNetwork) return undefined;
    return availableNetworks.find((n) => n.network_code === selectedNetwork)
      ?.min_deposit;
  }, [selectedNetwork, availableNetworks]);

  if (authLoading || isLoading) {
    return (
      <PortalPageLayout>
        <div className="flex h-[60vh] items-center justify-center">
          <div className="text-center">
            <Loader2 className="text-primary mx-auto h-10 w-10 animate-spin" />
            <p className="text-foreground-muted mt-4 text-sm">
              Loading deposit options...
            </p>
          </div>
        </div>
      </PortalPageLayout>
    );
  }

  return (
    <PortalPageLayout>
      <PortalPageHeader
        title="Deposit"
        description="Add funds to your account by sending crypto to your deposit address"
      />

      {error && (
        <div className="border-negative/30 bg-negative-muted mb-6 flex items-center gap-3 rounded-lg border p-4">
          <AlertCircle className="text-negative h-5 w-5" />
          <p className="text-foreground text-sm">{error}</p>
        </div>
      )}

      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex-1 space-y-6">
          {/* Step 1: Select Token */}
          <TokenSelector
            assets={assets}
            existingAddresses={existingAddresses}
            selectedToken={selectedToken}
            onSelectToken={handleSelectToken}
          />

          {/* Step 2: Select Network */}
          {selectedToken && (
            <NetworkSelector
              networks={availableNetworks}
              selectedToken={selectedToken}
              selectedNetwork={selectedNetwork}
              existingAddresses={existingAddresses}
              isGenerating={isGenerating}
              onSelectNetwork={handleSelectNetwork}
            />
          )}

          {/* Deposit Address Display */}
          {selectedToken && selectedNetwork && depositAddress && (
            <DepositAddressCard
              depositAddress={depositAddress}
              selectedToken={selectedToken}
              {...(minDeposit && { minDeposit })}
            />
          )}

          {/* Recent Deposits */}
          <RecentDeposits
            deposits={deposits}
            isRefreshing={isRefreshing}
            onRefresh={refreshDeposits}
          />
        </div>

        {/* Sidebar - Instructions */}
        <DepositSidebar
          selectedToken={selectedToken}
          selectedNetwork={selectedNetwork}
          networks={availableNetworks}
        />
      </div>
    </PortalPageLayout>
  );
}
