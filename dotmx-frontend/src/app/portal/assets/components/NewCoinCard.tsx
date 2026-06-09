import { type NewListedAsset } from "@/services/ApiClient";
import { AssetIcon } from "./AssetIcon";

interface NewCoinCardProps {
  asset: NewListedAsset;
}

export function NewCoinCard({ asset }: NewCoinCardProps) {
  return (
    <div className="bg-background-card border-border flex items-center justify-between rounded-2xl border p-5">
      <div className="flex flex-col">
        <span className="text-foreground-muted mb-1 text-xs">
          New Coin Listed
        </span>
        <h4 className="text-foreground mb-3 text-xl font-bold">
          {asset.symbol}
        </h4>
        <button className="text-foreground bg-primary hover:bg-primary/90 rounded-full px-5 py-2 text-sm font-semibold transition-colors">
          Buy Now
        </button>
      </div>
      <div className="shrink-0">
        <AssetIcon iconUrl={asset.icon_url} symbol={asset.symbol} size={72} />
      </div>
    </div>
  );
}
