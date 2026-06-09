"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";
import {
  PortalPageLayout,
  PortalCard,
  PortalCardContent,
} from "@/components/ui";
import {
  BalanceCard,
  InfoCard,
  AssetTable,
  AssetsChart,
  PortfolioValueChart,
  NewCoinCard,
  AnnouncementsSection,
  QuickActionsCard,
  AllocationSection,
} from "./components";
import { useAssetsData } from "./hooks/useAssetsData";

export default function AssetsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();
  const { isLoading, balances, assets, newListings, totalBalance, fetchData } =
    useAssetsData();

  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "all" | "funding" | "trading" | "earn"
  >("all");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
      return;
    }

    if (isAuthenticated) {
      fetchData();
    }
  }, [authLoading, isAuthenticated, router, fetchData]);

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

  return (
    <PortalPageLayout>
      <div className="flex gap-6">
        {/* Main Content */}
        <div className="flex flex-1 flex-col gap-6">
          {/* Balance Section - Two separate cards side by side */}
          <div className="flex gap-5">
            <BalanceCard
              user={user}
              totalBalance={totalBalance}
              copied={copied}
              onCopy={copyToClipboard}
            />
            <InfoCard user={user} />
          </div>

          {/* My Assets Section */}
          <PortalCard>
            <PortalCardContent>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-foreground text-2xl font-semibold">
                  My Assets
                </h3>
                <div className="flex gap-6 text-sm">
                  {(["all", "funding", "trading", "earn"] as const).map(
                    (tab) => (
                      <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`font-medium transition-colors ${
                          activeTab === tab
                            ? "text-primary"
                            : "text-foreground-muted hover:text-foreground"
                        }`}
                      >
                        {tab.charAt(0).toUpperCase() + tab.slice(1)}
                      </button>
                    )
                  )}
                </div>
              </div>

              <AssetTable
                balances={balances}
                assets={assets}
                activeTab={activeTab}
              />
            </PortalCardContent>
          </PortalCard>

          {/* Asset Distribution Chart */}
          {balances.some((b) => parseFloat(b.total || "0") > 0) && (
            <PortalCard>
              <PortalCardContent>
                <h3 className="text-foreground mb-6 text-2xl font-semibold">
                  Asset Distribution
                </h3>
                <AssetsChart balances={balances} assets={assets} />
              </PortalCardContent>
            </PortalCard>
          )}

          {/* Estimated Total Value with Chart */}
          <PortalCard>
            <PortalCardContent>
              <div className="mb-6 flex items-center justify-between">
                <h3 className="text-foreground text-2xl font-semibold">
                  Estimated total value
                </h3>
                <div className="flex gap-3">
                  <button className="text-foreground bg-background border-border hover:border-primary rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors">
                    Deposit
                  </button>
                  <button className="text-foreground bg-background border-border hover:border-primary rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors">
                    Withdraw
                  </button>
                  <button className="text-foreground bg-background border-border hover:border-primary rounded-lg border px-4 py-1.5 text-xs font-medium transition-colors">
                    Transfer
                  </button>
                </div>
              </div>
              <div className="mb-6">
                <p className="text-foreground text-4xl font-bold">
                  $
                  {totalBalance.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <div className="mt-2 flex items-center gap-3">
                  <p className="text-foreground-muted text-sm">USD</p>
                  <span className="text-foreground-muted text-xs">
                    {
                      balances.filter((b) => parseFloat(b.total || "0") > 0)
                        .length
                    }{" "}
                    assets with balance
                  </span>
                </div>
              </div>

              {/* Assets Analysis Chart */}
              <div className="mb-6">
                <h4 className="text-foreground mb-4 text-sm font-semibold">
                  Assets Analysis
                </h4>
                <PortfolioValueChart totalBalance={totalBalance} />
              </div>
            </PortalCardContent>
          </PortalCard>

          {/* Allocation Section */}
          <AllocationSection
            balances={balances}
            assets={assets}
            totalBalance={totalBalance}
          />
        </div>

        {/* Right Sidebar */}
        <div className="flex w-[300px] shrink-0 flex-col gap-6">
          {/* Quick Actions */}
          <QuickActionsCard />

          {/* New Coin Listed Section */}
          <div className="space-y-4">
            {newListings.map((asset, index) => (
              <NewCoinCard key={`${asset.symbol}-${index}`} asset={asset} />
            ))}
          </div>

          {/* Announcements Section */}
          <AnnouncementsSection />
        </div>
      </div>
    </PortalPageLayout>
  );
}
