"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import { useTransactionHistory } from "@/hooks";
import { Activity, ExternalLink } from "lucide-react";
import { formatUSD } from "@/utils/formatting";
import {
  PortalPageLayout,
  PortalPageHeader,
  PortalCard,
  PortalCardContent,
} from "@/components/ui";

export default function TransactionsPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading: authLoading } = useAuth();

  // Fetch transactions from backend API database
  const { transactions, isLoading: transactionsLoading } =
    useTransactionHistory(50);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  if (authLoading) {
    return (
      <PortalPageLayout>
        <div className="mb-6">
          <div className="bg-border mb-2 h-9 w-48 animate-pulse rounded" />
          <div className="bg-border h-5 w-64 animate-pulse rounded" />
        </div>
        <PortalCard>
          <PortalCardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="bg-border h-16 animate-pulse rounded-lg"
                />
              ))}
            </div>
          </PortalCardContent>
        </PortalCard>
      </PortalPageLayout>
    );
  }

  if (!isAuthenticated || !user) {
    return null;
  }

  return (
    <PortalPageLayout>
      <PortalPageHeader
        title="Transactions"
        description="Your trading history and activity"
      />

      <div className="bg-background-card rounded-xl border border-[#333]">
        {transactionsLoading ? (
          <PortalCardContent>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="bg-border h-16 animate-pulse rounded-lg"
                />
              ))}
            </div>
          </PortalCardContent>
        ) : transactions && transactions.length > 0 ? (
          <div className="divide-border divide-y">
            {transactions.map((tx, index) => (
              <div
                key={index}
                className="hover:bg-background-elevated flex items-center justify-between p-5 transition-colors"
              >
                <div className="flex items-center space-x-4">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${
                      tx.type.includes("Buy") ||
                      tx.type.includes("Long") ||
                      tx.type.includes("Deposit")
                        ? "bg-positive-muted text-positive"
                        : "bg-negative-muted text-negative"
                    }`}
                  >
                    <Activity className="h-5 w-5" />
                  </div>
                  <div>
                    <div className="text-foreground font-medium">{tx.type}</div>
                    <p className="text-foreground-subtle text-sm">
                      {tx.market || tx.pair || "—"}
                    </p>
                  </div>
                </div>

                <div className="text-center">
                  <div className="text-foreground-subtle text-sm">
                    {new Date(tx.timestamp * 1000).toLocaleDateString()}
                  </div>
                  <div className="text-foreground-disabled text-xs">
                    {new Date(tx.timestamp * 1000).toLocaleTimeString()}
                  </div>
                </div>

                <div className="text-right">
                  <div
                    className={`font-medium ${
                      tx.type.includes("Buy") ||
                      tx.type.includes("Long") ||
                      tx.type.includes("Deposit")
                        ? "text-positive"
                        : "text-negative"
                    }`}
                  >
                    {tx.type.includes("Buy") ||
                    tx.type.includes("Long") ||
                    tx.type.includes("Deposit")
                      ? "+"
                      : "-"}
                    {formatUSD(Math.abs(tx.amount))}
                  </div>
                  {tx.txHash && (
                    <a
                      href={`https://basescan.org/tx/${tx.txHash}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent inline-flex items-center gap-1 text-sm hover:underline"
                    >
                      View <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-20 text-center">
            <Activity className="text-border-accent mx-auto mb-4 h-12 w-12" />
            <h3 className="text-foreground mb-2 text-lg font-medium">
              No Transactions
            </h3>
            <p className="text-foreground-subtle">
              Your trading activity will appear here
            </p>
          </div>
        )}
      </div>
    </PortalPageLayout>
  );
}
