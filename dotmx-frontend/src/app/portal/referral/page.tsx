"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  Users,
  Copy,
  Check,
  Share2,
  TrendingUp,
  DollarSign,
  UserPlus,
  Gift,
} from "lucide-react";
import { formatUSD } from "@/utils/formatting";
import {
  PortalCard,
  PortalCardContent,
  PortalCardHeader,
  PortalCardTitle,
  PortalPageLayout,
  PortalPageHeader,
} from "@/components/ui";

interface Referral {
  id: string;
  email: string;
  joinedAt: number;
  tradingVolume: number;
  commission: number;
  status: "active" | "pending" | "inactive";
}

export default function ReferralPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Mock data
  const referralCode = "DOTMX-REF-X7K9";
  const referralLink = `https://dotmx.xyz/register?ref=${referralCode}`;
  const commissionRate = 20; // 20%

  const stats = {
    totalReferrals: 12,
    activeReferrals: 8,
    totalEarnings: 1250.5,
    pendingEarnings: 85.25,
    totalVolume: 125000,
  };

  const referrals: Referral[] = [
    {
      id: "1",
      email: "j***n@gmail.com",
      joinedAt: Date.now() - 30 * 24 * 60 * 60 * 1000,
      tradingVolume: 45000,
      commission: 450,
      status: "active",
    },
    {
      id: "2",
      email: "m***a@yahoo.com",
      joinedAt: Date.now() - 14 * 24 * 60 * 60 * 1000,
      tradingVolume: 28000,
      commission: 280,
      status: "active",
    },
    {
      id: "3",
      email: "s***e@outlook.com",
      joinedAt: Date.now() - 7 * 24 * 60 * 60 * 1000,
      tradingVolume: 12000,
      commission: 120,
      status: "active",
    },
    {
      id: "4",
      email: "t***r@gmail.com",
      joinedAt: Date.now() - 2 * 24 * 60 * 60 * 1000,
      tradingVolume: 0,
      commission: 0,
      status: "pending",
    },
  ];

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (authLoading) {
    return (
      <PortalPageLayout>
        <div className="mb-6">
          <div className="bg-border mb-1.5 h-6 w-32 animate-pulse rounded" />
          <div className="bg-border h-4 w-48 animate-pulse rounded" />
        </div>
        <div className="grid gap-4 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-background-card h-24 animate-pulse rounded-xl border border-[#333]"
            />
          ))}
        </div>
      </PortalPageLayout>
    );
  }

  return (
    <PortalPageLayout>
      <PortalPageHeader
        title="Referral Program"
        description={`Invite friends and earn ${commissionRate}% commission on their trading fees`}
      />

      {/* Referral Link Card */}
      <div className="bg-background-card mb-6 rounded-lg p-4 shadow-sm">
        <div className="mb-3 flex items-center gap-2">
          <Share2 className="text-accent h-4 w-4" />
          <span className="text-foreground text-sm font-medium">
            Your Referral Link
          </span>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row">
          <div className="bg-background flex-1 rounded-lg px-3 py-2">
            <code className="text-foreground-muted text-xs break-all">
              {referralLink}
            </code>
          </div>
          <button
            onClick={() => copyToClipboard(referralLink)}
            className={`flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-xs font-medium transition-colors ${
              copied
                ? "bg-positive text-foreground"
                : "bg-accent hover:bg-accent-hover text-foreground"
            }`}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy Link
              </>
            )}
          </button>
        </div>

        <div className="mt-3 flex items-center gap-4 border-t border-[#333] pt-3">
          <div className="flex items-center gap-2">
            <span className="text-foreground-muted text-xs">
              Referral Code:
            </span>
            <code className="bg-border text-foreground rounded px-2 py-1 text-xs font-medium">
              {referralCode}
            </code>
            <button
              onClick={() => copyToClipboard(referralCode)}
              className="text-foreground-muted hover:text-foreground"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <PortalCard>
          <PortalCardContent>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-foreground-muted text-xs">
                Total Referrals
              </span>
              <Users className="text-accent h-4 w-4" />
            </div>
            <div className="text-foreground text-lg font-bold">
              {stats.totalReferrals}
            </div>
            <p className="text-foreground-subtle mt-0.5 text-xs">
              {stats.activeReferrals} active
            </p>
          </PortalCardContent>
        </PortalCard>

        <PortalCard>
          <PortalCardContent>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-foreground-muted text-xs">
                Total Earnings
              </span>
              <DollarSign className="text-positive h-4 w-4" />
            </div>
            <div className="text-positive text-lg font-bold">
              {formatUSD(stats.totalEarnings)}
            </div>
            <p className="text-foreground-subtle mt-0.5 text-xs">
              Lifetime earnings
            </p>
          </PortalCardContent>
        </PortalCard>

        <PortalCard>
          <PortalCardContent>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-foreground-muted text-xs">
                Pending Earnings
              </span>
              <Gift className="text-warning h-4 w-4" />
            </div>
            <div className="text-warning text-lg font-bold">
              {formatUSD(stats.pendingEarnings)}
            </div>
            <p className="text-foreground-subtle mt-0.5 text-xs">
              Awaiting settlement
            </p>
          </PortalCardContent>
        </PortalCard>

        <PortalCard>
          <PortalCardContent>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-foreground-muted text-xs">
                Referral Volume
              </span>
              <TrendingUp className="text-info h-4 w-4" />
            </div>
            <div className="text-foreground text-lg font-bold">
              {formatUSD(stats.totalVolume)}
            </div>
            <p className="text-foreground-subtle mt-0.5 text-xs">
              Total trading volume
            </p>
          </PortalCardContent>
        </PortalCard>
      </div>

      {/* Commission Tiers */}
      <PortalCard className="mb-6">
        <PortalCardHeader>
          <PortalCardTitle>Commission Tiers</PortalCardTitle>
        </PortalCardHeader>
        <PortalCardContent>
          <div className="grid gap-3 md:grid-cols-3">
            <div
              className="border-accent/30 bg-accent/5 rounded-lg p-3"
              style={{ border: "1px solid rgba(59, 130, 246, 0.3)" }}
            >
              <div className="mb-1 flex items-center justify-between">
                <span className="text-accent text-xs font-medium">
                  Standard
                </span>
                <span className="text-accent text-sm font-bold">20%</span>
              </div>
              <p className="text-foreground-subtle text-2xs">0-10 referrals</p>
            </div>
            <div className="bg-border/20 rounded-lg p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-foreground-muted text-xs font-medium">
                  Silver
                </span>
                <span className="text-foreground-muted text-sm font-bold">
                  25%
                </span>
              </div>
              <p className="text-foreground-subtle text-2xs">10-50 referrals</p>
            </div>
            <div className="bg-border/20 rounded-lg p-3">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-foreground-muted text-xs font-medium">
                  Gold
                </span>
                <span className="text-foreground-muted text-sm font-bold">
                  30%
                </span>
              </div>
              <p className="text-foreground-subtle text-2xs">50+ referrals</p>
            </div>
          </div>
        </PortalCardContent>
      </PortalCard>

      {/* Referral List */}
      <PortalCard>
        <PortalCardHeader>
          <div className="flex items-center justify-between">
            <PortalCardTitle>Your Referrals</PortalCardTitle>
            <span className="text-foreground-muted text-xs">
              {referrals.length} total
            </span>
          </div>
        </PortalCardHeader>

        <PortalCardContent>
          {referrals.length === 0 ? (
            <div className="py-12 text-center">
              <UserPlus className="text-border-accent mx-auto mb-2 h-10 w-10" />
              <p className="text-foreground-subtle text-sm">No referrals yet</p>
              <p className="text-foreground-subtle mt-1 text-xs">
                Share your referral link to start earning
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-[#333]">
                    <th className="text-foreground-muted px-4 py-2 text-left text-xs font-medium">
                      User
                    </th>
                    <th className="text-foreground-muted px-4 py-2 text-left text-xs font-medium">
                      Joined
                    </th>
                    <th className="text-foreground-muted px-4 py-2 text-right text-xs font-medium">
                      Trading Volume
                    </th>
                    <th className="text-foreground-muted px-4 py-2 text-right text-xs font-medium">
                      Commission
                    </th>
                    <th className="text-foreground-muted px-4 py-2 text-center text-xs font-medium">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {referrals.map((referral) => (
                    <tr
                      key={referral.id}
                      className="border-b border-[#333] last:border-b-0"
                    >
                      <td className="px-4 py-3">
                        <span className="text-foreground text-sm">
                          {referral.email}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className="text-foreground-muted text-xs">
                          {new Date(referral.joinedAt).toLocaleDateString()}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-foreground text-sm">
                          {formatUSD(referral.tradingVolume)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="text-positive text-sm font-medium">
                          {formatUSD(referral.commission)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`text-2xs inline-flex items-center rounded px-2 py-0.5 font-medium ${
                            referral.status === "active"
                              ? "bg-positive-muted text-positive"
                              : referral.status === "pending"
                                ? "bg-warning-muted text-warning"
                                : "bg-border text-foreground-muted"
                          }`}
                        >
                          {referral.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </PortalCardContent>
      </PortalCard>
    </PortalPageLayout>
  );
}
