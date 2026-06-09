import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, Repeat } from "lucide-react";
import {
  PortalCard,
  PortalCardHeader,
  PortalCardTitle,
  PortalCardContent,
} from "@/components/ui";

export function QuickActionsCard() {
  return (
    <PortalCard>
      <PortalCardHeader>
        <PortalCardTitle>Quick Actions</PortalCardTitle>
      </PortalCardHeader>
      <PortalCardContent className="space-y-3">
        <Link
          href="/portal/deposit"
          className="text-foreground bg-primary hover:bg-primary/90 shadow-primary/20 flex w-full items-center gap-3 rounded-lg px-4 py-3.5 text-sm font-semibold shadow-sm transition-all"
        >
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-white/10">
            <ArrowDownToLine className="h-5 w-5" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base">Deposit</div>
            <div className="text-xs font-normal opacity-90">Add funds</div>
          </div>
        </Link>

        <Link
          href="/portal/withdraw"
          className="text-foreground bg-background-elevated border-border hover:border-primary hover:bg-background-card flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-sm font-semibold transition-all"
        >
          <div className="bg-background flex h-10 w-10 items-center justify-center rounded-full">
            <ArrowUpFromLine className="text-primary h-5 w-5" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base">Withdraw</div>
            <div className="text-foreground-muted text-xs font-normal">
              Send funds
            </div>
          </div>
        </Link>

        <Link
          href="/portal/transfer"
          className="text-foreground bg-background-elevated border-border hover:border-primary hover:bg-background-card flex w-full items-center gap-3 rounded-lg border px-4 py-3.5 text-sm font-semibold transition-all"
        >
          <div className="bg-background flex h-10 w-10 items-center justify-center rounded-full">
            <Repeat className="text-primary h-5 w-5" />
          </div>
          <div className="flex-1 text-left">
            <div className="text-base">Transfer</div>
            <div className="text-foreground-muted text-xs font-normal">
              Move funds
            </div>
          </div>
        </Link>
      </PortalCardContent>
    </PortalCard>
  );
}
