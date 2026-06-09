import { Check, Copy, Radio, CreditCard } from "lucide-react";
import { type User } from "@/services/ApiClient";

interface BalanceCardProps {
  user: User | null;
  totalBalance: number;
  copied: boolean;
  onCopy: (text: string) => void;
}

export function BalanceCard({
  user,
  totalBalance,
  copied,
  onCopy,
}: BalanceCardProps) {
  return (
    <div className="bg-background-elevated flex-[3] overflow-hidden rounded-xl border border-[#333]">
      <div className="relative p-8">
        <div className="text-foreground absolute top-6 right-6 flex items-center gap-3">
          <Radio className="h-5 w-5" />
          <CreditCard className="h-6 w-6" />
        </div>
        <p className="text-foreground-muted mb-3 text-sm font-medium tracking-wide uppercase">
          Balance
        </p>
        <h2 className="text-foreground mb-6 text-5xl font-bold">
          $ {totalBalance.toFixed(2)}
        </h2>
        <div className="mb-6 flex items-center gap-2">
          <p className="text-foreground text-base">
            {user?.email || "you***@mail.com"}
          </p>
          {user?.email && (
            <button
              onClick={() => onCopy(user.email || "")}
              className="text-foreground-muted hover:text-foreground transition-colors"
            >
              {copied ? <Check size={16} /> : <Copy size={16} />}
            </button>
          )}
        </div>
        <div className="border-border flex items-center justify-between border-t pt-4">
          <div>
            <p className="text-foreground-muted mb-1 text-xs font-medium tracking-wide uppercase">
              Account Name
            </p>
            <p className="text-foreground text-lg font-semibold">
              {user?.username || user?.email || "Anonymous User"}
            </p>
          </div>
          <div className="from-primary/20 to-primary/5 h-9 w-14 rounded-full bg-linear-to-br"></div>
        </div>
      </div>
    </div>
  );
}
