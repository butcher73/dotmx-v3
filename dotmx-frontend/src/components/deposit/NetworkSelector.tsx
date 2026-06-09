"use client";

import { Loader2, ChevronRight, Zap } from "lucide-react";
import {
  PortalCard,
  PortalCardContent,
  PortalCardHeader,
  PortalCardTitle,
} from "@/components/ui";
import { NetworkInfo, DepositAddress } from "@/services/ApiClient";
import { formatCryptoAmount } from "@/utils/formatting";

interface NetworkSelectorProps {
  networks: NetworkInfo[];
  selectedToken: string;
  selectedNetwork: string;
  existingAddresses: DepositAddress[];
  isGenerating: boolean;
  onSelectNetwork: (networkCode: string) => void;
}

export const NetworkSelector = ({
  networks,
  selectedToken,
  selectedNetwork,
  existingAddresses,
  isGenerating,
  onSelectNetwork,
}: NetworkSelectorProps) => {
  return (
    <PortalCard>
      <PortalCardHeader>
        <PortalCardTitle>
          <div className="flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-500/20 text-sm font-bold text-blue-400">
              2
            </div>
            Select Network
          </div>
        </PortalCardTitle>
      </PortalCardHeader>
      <PortalCardContent>
        <div className="grid gap-3 sm:grid-cols-2">
          {networks.map((network) => {
            const isSelected = selectedNetwork === network.network_code;
            const hasAddress = existingAddresses.some(
              (a) =>
                a.network_code === network.network_code &&
                a.asset_symbol === selectedToken
            );

            return (
              <button
                key={network.network_code}
                onClick={() => onSelectNetwork(network.network_code)}
                disabled={isGenerating}
                className={`flex items-center justify-between rounded-lg border p-4 text-left transition-all disabled:cursor-not-allowed disabled:opacity-50 ${
                  isSelected
                    ? "border-blue-500 bg-blue-500/10"
                    : "border-zinc-800/50 bg-[#050505] hover:border-zinc-700 hover:bg-zinc-900/50"
                }`}
              >
                <div className="flex-1">
                  <div className="mb-1 flex items-center gap-2">
                    <span className="font-semibold text-white">
                      {network.network_name}
                    </span>
                    {hasAddress && (
                      <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400">
                        Ready
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-zinc-500">
                    <Zap className="h-3 w-3" />
                    Min: {formatCryptoAmount(network.min_deposit)}{" "}
                    {selectedToken}
                  </div>
                </div>
                <ChevronRight
                  className={`h-5 w-5 ${isSelected ? "text-blue-400" : "text-zinc-600"}`}
                />
              </button>
            );
          })}
        </div>

        {isGenerating && (
          <div className="mt-4 flex items-center gap-2 text-sm text-zinc-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Generating deposit address...
          </div>
        )}
      </PortalCardContent>
    </PortalCard>
  );
};
