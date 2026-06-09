"use client";

import {
  PortalCard,
  PortalCardContent,
  PortalCardHeader,
  PortalCardTitle,
} from "@/components/ui";
import { NetworkInfo } from "@/services/ApiClient";
import { formatCryptoAmount } from "@/utils/formatting";

interface DepositSidebarProps {
  selectedToken?: string;
  selectedNetwork?: string;
  networks?: NetworkInfo[];
}

export const DepositSidebar = ({
  selectedToken,
  selectedNetwork,
  networks,
}: DepositSidebarProps) => {
  const currentNetwork = networks?.find(
    (n) => n.network_code === selectedNetwork
  );

  return (
    <div className="hidden w-80 space-y-6 lg:block">
      {/* How to Deposit */}
      <PortalCard>
        <PortalCardHeader>
          <PortalCardTitle>How to Deposit</PortalCardTitle>
        </PortalCardHeader>
        <PortalCardContent>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-semibold text-blue-400">
                1
              </div>
              <div>
                <p className="font-medium text-white">Select token</p>
                <p className="text-xs text-zinc-500">
                  Choose the cryptocurrency you want to deposit
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-semibold text-blue-400">
                2
              </div>
              <div>
                <p className="font-medium text-white">Select network</p>
                <p className="text-xs text-zinc-500">
                  Choose the blockchain network for your deposit
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-500/20 text-sm font-semibold text-blue-400">
                3
              </div>
              <div>
                <p className="font-medium text-white">Send funds</p>
                <p className="text-xs text-zinc-500">
                  Transfer to the generated address
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-sm font-semibold text-emerald-400">
                ✓
              </div>
              <div>
                <p className="font-medium text-white">Auto-credited</p>
                <p className="text-xs text-zinc-500">
                  Funds appear after network confirmations
                </p>
              </div>
            </div>
          </div>
        </PortalCardContent>
      </PortalCard>

      {/* Network Info */}
      {selectedToken && selectedNetwork && currentNetwork && (
        <PortalCard>
          <PortalCardHeader>
            <PortalCardTitle>Network Info</PortalCardTitle>
          </PortalCardHeader>
          <PortalCardContent>
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-zinc-500">Network</span>
                <span className="font-semibold text-white">
                  {currentNetwork.network_name}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Min. Deposit</span>
                <span className="font-semibold text-white">
                  {formatCryptoAmount(currentNetwork.min_deposit)}{" "}
                  {selectedToken}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Withdrawal Fee</span>
                <span className="font-semibold text-white">
                  {formatCryptoAmount(currentNetwork.withdrawal_fee || "0")}{" "}
                  {selectedToken}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Est. Time</span>
                <span className="font-semibold text-white">5-15 min</span>
              </div>
            </div>
          </PortalCardContent>
        </PortalCard>
      )}
    </div>
  );
};
