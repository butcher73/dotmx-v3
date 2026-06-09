import { Check, ChevronRight } from "lucide-react";
import { type User } from "@/services/ApiClient";

interface InfoCardProps {
  user: User | null;
}

export function InfoCard({ user }: InfoCardProps) {
  return (
    <div className="bg-background-card flex-[2] overflow-hidden rounded-xl border border-[#333]">
      <div className="flex h-full flex-col p-6">
        <div className="flex-1 space-y-5">
          <div>
            <p className="text-foreground-muted mb-2.5 text-xs font-semibold tracking-wide uppercase">
              Identity verification
            </p>
            {user?.kyc_status === "verified" ? (
              <div className="inline-flex items-center gap-1.5 text-sm font-semibold text-green-600">
                <Check className="h-4 w-4" />
                Verified
              </div>
            ) : user?.kyc_status === "pending" ? (
              <div className="text-sm font-semibold text-yellow-600">
                Pending Review
              </div>
            ) : (
              <button className="text-primary inline-flex items-center gap-1 text-sm font-semibold hover:underline">
                Verify now <ChevronRight className="h-4 w-4" />
              </button>
            )}
          </div>
          <div>
            <p className="text-foreground-muted mb-2.5 text-xs font-semibold tracking-wide uppercase">
              Country/Region
            </p>
            <p className="text-foreground text-base font-semibold">
              {user?.country || "Not set"}
            </p>
          </div>
          <div>
            <p className="text-foreground-muted mb-2.5 text-xs font-semibold tracking-wide uppercase">
              Trading fee tier
            </p>
            <p className="text-foreground text-base font-semibold">
              Level {user?.fee_tier || 1}
            </p>
          </div>
        </div>
        <button className="text-foreground bg-background border-border hover:border-primary hover:bg-background-elevated mt-5 w-full rounded-lg border py-2.5 text-sm font-semibold transition-colors">
          View profile
        </button>
      </div>
    </div>
  );
}
