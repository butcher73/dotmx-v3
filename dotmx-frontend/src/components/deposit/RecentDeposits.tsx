"use client";

import { RefreshCw } from "lucide-react";
import {
  PortalCard,
  PortalCardContent,
  PortalCardHeader,
  PortalCardTitle,
  List,
  ListItem,
  ListItemBadge,
} from "@/components/ui";
import { getStatusDisplay } from "./utils";
import { formatCryptoAmount } from "@/utils/formatting";

export interface Deposit {
  id: string;
  network_code: string;
  asset_symbol: string;
  amount: string;
  tx_hash: string;
  status: string;
  confirmations: number;
  detected_at: string;
  confirmed_at: string | null;
  credited_at: string | null;
  created_at: string;
}

interface RecentDepositsProps {
  deposits: Deposit[];
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const RecentDeposits = ({
  deposits,
  isRefreshing,
  onRefresh,
}: RecentDepositsProps) => {
  return (
    <PortalCard>
      <PortalCardHeader>
        <div className="flex items-center justify-between">
          <PortalCardTitle>Recent Deposits</PortalCardTitle>
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2 rounded-lg border border-zinc-800/50 bg-zinc-900/50 px-3 py-1.5 text-sm font-medium text-zinc-400 transition-all hover:border-zinc-700 hover:text-zinc-300 disabled:opacity-50"
          >
            <RefreshCw
              className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
      </PortalCardHeader>
      <PortalCardContent>
        {deposits.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-zinc-500">
            No deposits yet. Your deposits will appear here once detected.
          </div>
        ) : (
          <List>
            {deposits.map((deposit) => {
              const status = getStatusDisplay(deposit.status);
              return (
                <ListItem
                  key={deposit.id}
                  icon={status.Icon}
                  iconColor={status.iconColor}
                  title={`${formatCryptoAmount(deposit.amount)} ${deposit.asset_symbol}`}
                  description={
                    <span className="inline-flex items-center gap-2">
                      <span>
                        {new Date(deposit.detected_at).toLocaleDateString()}{" "}
                        {new Date(deposit.detected_at).toLocaleTimeString()}
                      </span>
                      <span>•</span>
                      <span className="font-mono text-xs">
                        {deposit.tx_hash.slice(0, 8)}...
                        {deposit.tx_hash.slice(-8)}
                      </span>
                    </span>
                  }
                  metadata={
                    <ListItemBadge
                      label={status.label}
                      variant={status.variant}
                    />
                  }
                />
              );
            })}
          </List>
        )}
      </PortalCardContent>
    </PortalCard>
  );
};
