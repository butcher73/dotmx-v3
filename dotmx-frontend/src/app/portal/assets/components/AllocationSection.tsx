import { useMemo } from "react";
import { PortalCard, PortalCardContent } from "@/components/ui";
import { type UserBalance, type SupportedAsset } from "@/services/ApiClient";

interface AllocationSectionProps {
  balances: UserBalance[];
  assets: SupportedAsset[];
  totalBalance: number;
}

const ALLOCATION_CONFIG = [
  {
    label: "Crypto",
    check: (assetType: string, isStablecoin: boolean) => !isStablecoin,
    color: "bg-primary",
    barColor: "#fa5f1a",
  },
  {
    label: "Stablecoins",
    check: (_assetType: string, isStablecoin: boolean) => isStablecoin,
    color: "bg-blue-500",
    barColor: "#3b82f6",
  },
] as const;

export function AllocationSection({
  balances,
  assets,
  totalBalance,
}: AllocationSectionProps) {
  const allocations = useMemo(() => {
    if (totalBalance === 0) return [];

    // Build asset info map
    const assetInfoMap = new Map(
      assets.map((a) => [
        a.symbol,
        { asset_type: a.asset_type, is_stablecoin: a.is_stablecoin ?? false },
      ])
    );

    return ALLOCATION_CONFIG.map((config) => {
      const value = balances.reduce((sum, b) => {
        const info = assetInfoMap.get(b.asset_symbol) || {
          asset_type: "native",
          is_stablecoin: false,
        };
        if (config.check(info.asset_type, info.is_stablecoin)) {
          return sum + parseFloat(b.total || "0");
        }
        return sum;
      }, 0);

      const percentage = totalBalance > 0 ? (value / totalBalance) * 100 : 0;

      return {
        ...config,
        value,
        percentage,
        flex: `flex-[${Math.max(Math.round(percentage), 1)}]`,
      };
    }).filter((a) => a.value > 0);
  }, [balances, assets, totalBalance]);

  if (allocations.length === 0) {
    return (
      <PortalCard>
        <PortalCardContent>
          <h3 className="text-foreground mb-6 text-2xl font-semibold">
            Allocation
          </h3>
          <p className="text-foreground-muted text-sm">
            No assets to display allocation for.
          </p>
        </PortalCardContent>
      </PortalCard>
    );
  }

  return (
    <PortalCard>
      <PortalCardContent>
        <h3 className="text-foreground mb-6 text-2xl font-semibold">
          Allocation
        </h3>

        {/* Allocation Bar */}
        <div className="mb-6 flex h-3 gap-0.5 overflow-hidden rounded-full">
          {allocations.map((allocation) => (
            <div
              key={allocation.label}
              className="h-full rounded-full transition-all duration-300"
              style={{
                backgroundColor: allocation.barColor,
                width: `${allocation.percentage}%`,
                minWidth: "4px",
              }}
            />
          ))}
        </div>

        {/* Allocation List */}
        <div className="space-y-5">
          {allocations.map((allocation) => (
            <div
              key={allocation.label}
              className="flex items-center justify-between"
            >
              <div className="flex items-center gap-4">
                <div
                  className="h-2 w-2 rounded-full"
                  style={{ backgroundColor: allocation.barColor }}
                />
                <span className="text-foreground text-sm font-medium">
                  {allocation.label}
                </span>
              </div>
              <div className="text-right">
                <p className="text-foreground text-sm font-semibold">
                  $
                  {allocation.value.toLocaleString("en-US", {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2,
                  })}
                </p>
                <p className="text-foreground-muted text-xs">
                  {allocation.percentage.toFixed(1)}%
                </p>
              </div>
            </div>
          ))}
        </div>
      </PortalCardContent>
    </PortalCard>
  );
}
