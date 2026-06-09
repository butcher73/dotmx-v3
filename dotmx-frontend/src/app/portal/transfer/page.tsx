"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  apiClient,
  type SupportedAsset,
  type UserBalance,
} from "@/services/ApiClient";
import { Loader2, AlertCircle, Repeat, ArrowRight } from "lucide-react";
import {
  PortalPageLayout,
  PortalPageHeader,
  PortalCard,
  PortalCardContent,
  PortalCardHeader,
  PortalCardTitle,
} from "@/components/ui";

export default function TransferPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [assets, setAssets] = useState<SupportedAsset[]>([]);
  const [balances, setBalances] = useState<UserBalance[]>([]);
  const [selectedAsset, setSelectedAsset] = useState<string>("");
  const [fromWallet, setFromWallet] = useState<string>("trading");
  const [toWallet, setToWallet] = useState<string>("funding");
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

  const handleTransfer = async () => {
    // TODO: Implement transfer API call
    // console.log("Transfer:", { selectedAsset, amount, fromWallet, toWallet });
  };

  const swapWallets = () => {
    const temp = fromWallet;
    setFromWallet(toWallet);
    setToWallet(temp);
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

  const walletOptions = [
    {
      value: "funding",
      label: "Funding Wallet",
      description: "For deposits & withdrawals",
    },
    {
      value: "trading",
      label: "Trading Wallet",
      description: "For spot trading",
    },
    {
      value: "earn",
      label: "Earn Wallet",
      description: "For staking & savings",
    },
  ];

  return (
    <PortalPageLayout>
      <PortalPageHeader
        title="Transfer"
        description="Move funds between your wallets"
      />

      <div className="flex gap-6">
        <div className="flex-1">
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle>Transfer Details</PortalCardTitle>
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
              </div>

              {/* Wallet Transfer Section */}
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex-1">
                    <label className="text-foreground mb-2 block text-sm font-semibold">
                      From
                    </label>
                    <select
                      value={fromWallet}
                      onChange={(e) => setFromWallet(e.target.value)}
                      className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-4 py-3 text-sm font-medium transition-all focus:ring-1 focus:outline-none"
                    >
                      {walletOptions
                        .filter((w) => w.value !== toWallet)
                        .map((wallet) => (
                          <option key={wallet.value} value={wallet.value}>
                            {wallet.label}
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

                  <button
                    onClick={swapWallets}
                    className="border-border bg-background-elevated text-foreground-muted hover:border-primary hover:text-primary mt-6 flex h-10 w-10 items-center justify-center rounded-full border transition-all"
                  >
                    <Repeat className="h-5 w-5" />
                  </button>

                  <div className="flex-1">
                    <label className="text-foreground mb-2 block text-sm font-semibold">
                      To
                    </label>
                    <select
                      value={toWallet}
                      onChange={(e) => setToWallet(e.target.value)}
                      className="border-border bg-background text-foreground focus:border-primary focus:ring-primary/20 w-full rounded-lg border px-4 py-3 text-sm font-medium transition-all focus:ring-1 focus:outline-none"
                    >
                      {walletOptions
                        .filter((w) => w.value !== fromWallet)
                        .map((wallet) => (
                          <option key={wallet.value} value={wallet.value}>
                            {wallet.label}
                          </option>
                        ))}
                    </select>
                  </div>
                </div>
              </div>

              {/* Amount */}
              <div>
                <label className="text-foreground mb-2 flex items-center justify-between text-sm font-semibold">
                  Amount
                  <button
                    onClick={() => setAmount(availableBalance.toString())}
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

              {/* Transfer Preview */}
              <div className="border-border bg-background-elevated rounded-lg border p-6">
                <div className="flex items-center justify-between">
                  <div className="text-center">
                    <p className="text-foreground-muted mb-1 text-xs font-medium tracking-wide uppercase">
                      {walletOptions.find((w) => w.value === fromWallet)?.label}
                    </p>
                    <p className="text-foreground text-2xl font-bold">
                      {availableBalance.toFixed(4)}
                    </p>
                    <p className="text-foreground-muted mt-1 text-xs">
                      {selectedAsset}
                    </p>
                  </div>

                  <ArrowRight className="text-primary h-6 w-6" />

                  <div className="text-center">
                    <p className="text-foreground-muted mb-1 text-xs font-medium tracking-wide uppercase">
                      {walletOptions.find((w) => w.value === toWallet)?.label}
                    </p>
                    <p className="text-primary text-2xl font-bold">
                      +{amount || "0.00"}
                    </p>
                    <p className="text-foreground-muted mt-1 text-xs">
                      {selectedAsset}
                    </p>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <button
                onClick={handleTransfer}
                disabled={
                  !amount ||
                  parseFloat(amount) <= 0 ||
                  parseFloat(amount) > availableBalance
                }
                className="bg-primary text-foreground hover:bg-primary/90 w-full rounded-lg px-6 py-3.5 font-semibold transition-all disabled:cursor-not-allowed disabled:opacity-50"
              >
                Transfer {selectedAsset}
              </button>
            </PortalCardContent>
          </PortalCard>
        </div>

        {/* Information Sidebar */}
        <div className="w-96">
          <PortalCard>
            <PortalCardHeader>
              <PortalCardTitle>Wallet Information</PortalCardTitle>
            </PortalCardHeader>
            <PortalCardContent className="space-y-4">
              {walletOptions.map((wallet) => (
                <div
                  key={wallet.value}
                  className="border-border bg-background-elevated rounded-lg border p-4"
                >
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="text-foreground font-semibold">
                      {wallet.label}
                    </h4>
                    {(wallet.value === fromWallet ||
                      wallet.value === toWallet) && (
                      <span className="bg-primary text-foreground rounded-full px-2 py-0.5 text-xs font-semibold">
                        {wallet.value === fromWallet ? "From" : "To"}
                      </span>
                    )}
                  </div>
                  <p className="text-foreground-muted text-xs">
                    {wallet.description}
                  </p>
                </div>
              ))}
            </PortalCardContent>
          </PortalCard>

          <PortalCard className="mt-6">
            <PortalCardHeader>
              <PortalCardTitle>Transfer Info</PortalCardTitle>
            </PortalCardHeader>
            <PortalCardContent className="space-y-4">
              <div className="border-primary/30 bg-primary/10 flex gap-3 rounded-lg border p-4">
                <AlertCircle className="text-primary h-5 w-5 shrink-0" />
                <div className="text-foreground-muted text-sm">
                  <ul className="space-y-2 text-xs">
                    <li>• Transfers are instant and free</li>
                    <li>• No fees for internal transfers</li>
                    <li>• Available 24/7</li>
                  </ul>
                </div>
              </div>
            </PortalCardContent>
          </PortalCard>
        </div>
      </div>
    </PortalPageLayout>
  );
}
