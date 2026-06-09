"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  apiClient,
  type SupportedAsset,
  type UserBalance,
} from "@/services/ApiClient";
import { Loader2, AlertCircle, Shield } from "lucide-react";
import {
  PortalPageLayout,
  PortalPageHeader,
  PortalCard,
  PortalCardContent,
  PortalCardHeader,
  PortalCardTitle,
} from "@/components/ui";

export default function WithdrawPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [assets, setAssets] = useState<SupportedAsset[]>([]);
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [selectedNetwork, setSelectedNetwork] = useState<string>("");
  const [withdrawAddress, setWithdrawAddress] = useState<string>("");
  const [amount, setAmount] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    } else if (isAuthenticated) {
      fetchData();
    }
  }, [authLoading, isAuthenticated, router]);

  const fetchData = async () => {
    try {
      const [assetsData, balancesData] = await Promise.all([
        apiClient.getSupportedAssets(),
        apiClient.getBalance(),
      ]);
      setAssets(assetsData.assets || []);
      setBalances(Array.isArray(balancesData) ? balancesData : []);
      if (
        assetsData.assets &&
        assetsData.assets.length > 0 &&
        assetsData.assets[0]
      ) {
        setSelectedAsset(assetsData.assets[0].symbol);
      }
    } catch (error) {
      console.error("Failed to fetch data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleWithdraw = async () => {
    // TODO: Implement withdrawal API call
    // console.log("Withdraw:", { selectedAsset, amount, withdrawAddress, selectedNetwork });
  };

  if (authLoading || isLoading) {
    return (
      <PortalPageLayout>
        <div className="flex h-screen items-center justify-center">
          <Loader2 className="text-primary h-8 w-8 animate-spin" />
        </div>
      </PortalPageLayout>
    );
  }

  const selectedBalance = balances.find(
    (b) => b.asset_symbol === selectedAsset
  );
  const availableBalance = parseFloat(selectedBalance?.available || "0");
  const withdrawalFee = 0.001; // Mock fee

  return (
    <PortalPageLayout>
      <PortalPageHeader
        title="Withdraw"
        description="Send funds from your account"
      />

      <div className="flex gap-6">
        <div className="flex-1">
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle>Withdrawal Details</PortalCardTitle>
            </PortalCardHeader>
            <PortalCardContent className="space-y-6">
              {/* Asset Selection */}
              <div>
                <label className="text-foreground mb-2 block text-sm font-semibold">
                  Asset
                </label>
                <select
                  value={selectedAsset}
                  onChange={(e) => setSelectedAsset(e.target.value)}
                  className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-4 py-3 text-sm font-medium transition-all focus:ring-1 focus:outline-none"
                >
                  {assets.map((asset) => (
                    <option key={asset.symbol} value={asset.symbol}>
                      {asset.name} ({asset.symbol})
                    </option>
                  ))}
                </select>
                <p className="text-foreground-muted mt-1.5 text-xs">
                  Available:{" "}
                  <span className="text-foreground font-semibold">
                    {availableBalance.toFixed(8)} {selectedAsset}
                  </span>
                </p>
              </div>

              {/* Network Selection */}
              <div>
                <label className="text-foreground mb-2 block text-sm font-semibold">
                  Network
                </label>
                <select
                  value={selectedNetwork}
                  onChange={(e) => setSelectedNetwork(e.target.value)}
                  className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-4 py-3 text-sm font-medium transition-all focus:ring-1 focus:outline-none"
                >
                  <option value="">Select network</option>
                  <option value="ethereum">Ethereum (ERC-20)</option>
                  <option value="bsc">BNB Smart Chain (BEP-20)</option>
                  <option value="polygon">Polygon</option>
                  <option value="arbitrum">Arbitrum</option>
                </select>
              </div>

              {/* Withdrawal Address */}
              <div>
                <label className="text-foreground mb-2 block text-sm font-semibold">
                  Withdrawal Address
                </label>
                <input
                  type="text"
                  value={withdrawAddress}
                  onChange={(e) => setWithdrawAddress(e.target.value)}
                  placeholder="Enter destination address"
                  className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-4 py-3 font-mono text-sm transition-all focus:ring-1 focus:outline-none"
                />
              </div>

              {/* Amount */}
              <div>
                <label className="text-foreground mb-2 flex items-center justify-between text-sm font-semibold">
                  Amount
                  <button
                    onClick={() =>
                      setAmount((availableBalance - withdrawalFee).toString())
                    }
                    className="text-primary text-xs font-semibold hover:underline"
                  >
                    Max
                  </button>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    placeholder="0.00"
                    className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-4 py-3 text-sm font-medium transition-all focus:ring-1 focus:outline-none"
                  />
                  <span className="text-foreground-muted absolute top-1/2 right-4 -translate-y-1/2 text-sm font-semibold">
                    {selectedAsset}
                  </span>
                </div>
              </div>

              {/* Summary */}
              <div className="border-border bg-background-elevated space-y-3 rounded-lg border p-4 text-sm">
                <div className="flex justify-between">
                  <span className="text-foreground-muted">
                    Withdrawal amount
                  </span>
                  <span className="text-foreground font-semibold">
                    {amount || "0.00"} {selectedAsset}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Network fee</span>
                  <span className="text-foreground font-semibold">
                    {withdrawalFee} {selectedAsset}
                  </span>
                </div>
                <div className="bg-border h-px"></div>
                <div className="flex justify-between">
                  <span className="text-foreground font-semibold">
                    You will receive
                  </span>
                  <span className="text-foreground font-bold">
                    {amount
                      ? (parseFloat(amount) - withdrawalFee).toFixed(8)
                      : "0.00"}{" "}
                    {selectedAsset}
                  </span>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleWithdraw}
                disabled={
                  !selectedNetwork ||
                  !withdrawAddress ||
                  !amount ||
                  parseFloat(amount) <= 0
                }
                className="bg-primary text-foreground hover:bg-primary/90 w-full rounded-lg px-6 py-3.5 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                Withdraw {selectedAsset}
              </button>
            </PortalCardContent>
          </PortalCard>
        </div>

        {/* Information Sidebar */}
        <div className="w-96">
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle>Security Notice</PortalCardTitle>
            </PortalCardHeader>
            <PortalCardContent className="space-y-4">
              <div className="border-negative/30 bg-negative-muted flex gap-3 rounded-lg border p-4">
                <AlertCircle className="text-negative h-5 w-5 shrink-0" />
                <div className="text-foreground-muted text-sm">
                  <p className="text-foreground mb-2 font-semibold">
                    Important Warning
                  </p>
                  <ul className="space-y-2 text-xs">
                    <li>• Double-check the withdrawal address</li>
                    <li>• Ensure you select the correct network</li>
                    <li>• Withdrawals are irreversible</li>
                    <li>• Wrong address = permanent loss of funds</li>
                  </ul>
                </div>
              </div>

              <div className="space-y-3 text-sm">
                <div className="border-border flex justify-between border-b pb-2">
                  <span className="text-foreground-muted">
                    Minimum withdrawal
                  </span>
                  <span className="text-foreground font-semibold">
                    0.01 {selectedAsset}
                  </span>
                </div>
                <div className="border-border flex justify-between border-b pb-2">
                  <span className="text-foreground-muted">Processing time</span>
                  <span className="text-foreground font-semibold">
                    ~15-30 minutes
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-foreground-muted">Daily limit</span>
                  <span className="text-foreground font-semibold">
                    100 {selectedAsset}
                  </span>
                </div>
              </div>
            </PortalCardContent>
          </PortalCard>

          <PortalCard className="mt-6">
            <PortalCardHeader>
              <div className="flex items-center gap-2">
                <Shield className="text-primary h-5 w-5" />
                <PortalCardTitle>2FA Verification</PortalCardTitle>
              </div>
            </PortalCardHeader>
            <PortalCardContent>
              <p className="text-foreground-muted text-sm">
                For your security, withdrawals require 2FA verification.
                You&apos;ll be prompted to enter your code after clicking
                withdraw.
              </p>
            </PortalCardContent>
          </PortalCard>
        </div>
      </div>
    </PortalPageLayout>
  );
}
