"use client";

import { useState } from "react";
import Image from "next/image";
import { Search, X } from "lucide-react";
import {
  PortalCard,
  PortalCardContent,
  PortalCardHeader,
  PortalCardTitle,
  Input,
} from "@/components/ui";
import { SupportedAsset, DepositAddress } from "@/services/ApiClient";

interface TokenSelectorProps {
  assets: SupportedAsset[];
  existingAddresses: DepositAddress[];
  selectedToken: string;
  onSelectToken: (symbol: string) => void;
}

export const TokenSelector = ({
  assets,
  existingAddresses,
  selectedToken,
  onSelectToken,
}: TokenSelectorProps) => {
  const [searchToken, setSearchToken] = useState<string>("");

  const filteredAssets = searchToken.trim()
    ? assets.filter(
        (asset) =>
          asset.symbol.toLowerCase().includes(searchToken.toLowerCase()) ||
          asset.name.toLowerCase().includes(searchToken.toLowerCase())
      )
    : assets;

  return (
    <PortalCard>
      <PortalCardHeader>
        <PortalCardTitle>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-400">
              1
            </div>
            Select Token
          </div>
        </PortalCardTitle>
      </PortalCardHeader>
      <PortalCardContent>
        {/* Search Input */}
        <div className="mb-4">
          <div className="relative">
            <Input
              placeholder="Search tokens..."
              value={searchToken}
              onChange={(e) => setSearchToken(e.target.value)}
              icon={Search}
              iconPosition="left"
              className="pr-10"
            />
            {searchToken && (
              <button
                onClick={() => setSearchToken("")}
                className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Token Grid */}
        <div className="grid max-h-[400px] grid-cols-2 gap-2 overflow-y-auto pr-2 sm:grid-cols-3 md:grid-cols-4">
          {filteredAssets.map((asset) => {
            const isSelected = selectedToken === asset.symbol;
            const hasAddress = existingAddresses.some((addr) =>
              asset.networks.some((n) => n.network_code === addr.network_code)
            );

            return (
              <button
                key={asset.symbol}
                onClick={() => onSelectToken(asset.symbol)}
                className={`group relative flex flex-col items-center gap-2 rounded-lg border p-3 transition-all ${
                  isSelected
                    ? "border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20"
                    : "border-zinc-800/50 bg-[#050505] hover:border-zinc-700 hover:bg-zinc-900/50"
                }`}
              >
                {/* Token Icon */}
                {asset.icon_url ? (
                  <Image
                    src={asset.icon_url}
                    alt={asset.symbol}
                    width={32}
                    height={32}
                    className="h-8 w-8 rounded-full"
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = "none";
                    }}
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-white">
                    {asset.symbol.slice(0, 2)}
                  </div>
                )}

                {/* Token Symbol */}
                <div className="text-center">
                  <div className="text-sm font-semibold text-white">
                    {asset.symbol}
                  </div>
                  <div className="text-xs text-zinc-500">
                    {asset.networks.filter((n) => n.deposit_enabled).length}{" "}
                    networks
                  </div>
                </div>

                {/* Has Address Badge */}
                {hasAddress && (
                  <div className="absolute top-1 right-1">
                    <div className="h-2 w-2 rounded-full bg-emerald-400"></div>
                  </div>
                )}
              </button>
            );
          })}
        </div>

        {filteredAssets.length === 0 && (
          <div className="py-12 text-center">
            <p className="text-sm text-zinc-500">
              No tokens found matching &quot;{searchToken}&quot;
            </p>
          </div>
        )}
      </PortalCardContent>
    </PortalCard>
  );
};
