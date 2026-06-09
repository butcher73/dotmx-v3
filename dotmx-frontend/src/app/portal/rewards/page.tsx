"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  Gift,
  Star,
  Zap,
  Clock,
  CheckCircle,
  Trophy,
  Target,
  TrendingUp,
} from "lucide-react";
import { PortalCard, PortalCardContent } from "@/components/ui";
import { formatUSD } from "@/utils/formatting";

type RewardTab = "available" | "claimed" | "missions";

interface Reward {
  id: string;
  title: string;
  description: string;
  amount: number;
  type: "trading" | "referral" | "promotion" | "airdrop";
  status: "available" | "claimed" | "expired";
  expiresAt?: number;
  claimedAt?: number;
}

interface Mission {
  id: string;
  title: string;
  description: string;
  reward: number;
  progress: number;
  target: number;
  type: "daily" | "weekly" | "achievement";
  completed: boolean;
}

export default function RewardsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<RewardTab>("available");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Mock data
  const rewards: Reward[] = [
    {
      id: "1",
      title: "Welcome Bonus",
      description: "Complete your first trade to claim",
      amount: 10,
      type: "promotion",
      status: "available",
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    },
    {
      id: "2",
      title: "Trading Volume Bonus",
      description: "Achieved $10,000 trading volume",
      amount: 25,
      type: "trading",
      status: "claimed",
      claimedAt: Date.now() - 24 * 60 * 60 * 1000,
    },
  ];

  const missions: Mission[] = [
    {
      id: "1",
      title: "Daily Trader",
      description: "Complete 5 trades today",
      reward: 5,
      progress: 2,
      target: 5,
      type: "daily",
      completed: false,
    },
    {
      id: "2",
      title: "Volume King",
      description: "Trade $50,000 this week",
      reward: 50,
      progress: 32000,
      target: 50000,
      type: "weekly",
      completed: false,
    },
    {
      id: "3",
      title: "First Win",
      description: "Make your first profitable trade",
      reward: 10,
      progress: 1,
      target: 1,
      type: "achievement",
      completed: true,
    },
  ];

  const availableRewards = rewards.filter((r) => r.status === "available");
  const claimedRewards = rewards.filter((r) => r.status === "claimed");
  const totalEarned = claimedRewards.reduce((sum, r) => sum + r.amount, 0);
  const pendingRewards = availableRewards.reduce((sum, r) => sum + r.amount, 0);

  const tabs = [
    { id: "available", label: "Available", count: availableRewards.length },
    { id: "claimed", label: "Claimed", count: claimedRewards.length },
    {
      id: "missions",
      label: "Missions",
      count: missions.filter((m) => !m.completed).length,
    },
  ];

  if (authLoading) {
    return (
      <div className="bg-background">
        <div className="container mx-auto px-4 py-6">
          <div className="mb-6">
            <div className="bg-border mb-1.5 h-6 w-32 animate-pulse rounded" />
            <div className="bg-border h-4 w-48 animate-pulse rounded" />
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-background-card h-24 animate-pulse rounded-xl border border-[#333]"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  const getRewardIcon = (type: Reward["type"]) => {
    switch (type) {
      case "trading":
        return <TrendingUp className="h-4 w-4" />;
      case "referral":
        return <Star className="h-4 w-4" />;
      case "promotion":
        return <Zap className="h-4 w-4" />;
      case "airdrop":
        return <Gift className="h-4 w-4" />;
    }
  };

  const getMissionIcon = (type: Mission["type"]) => {
    switch (type) {
      case "daily":
        return <Clock className="text-accent h-4 w-4" />;
      case "weekly":
        return <Target className="text-info h-4 w-4" />;
      case "achievement":
        return <Trophy className="text-warning h-4 w-4" />;
    }
  };

  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-foreground mb-1 text-xl font-bold">Rewards</h1>
          <p className="text-foreground-muted text-sm">
            Earn rewards by trading and completing missions
          </p>
        </div>

        {/* Summary Cards */}
        <div className="mb-6 grid gap-4 md:grid-cols-3">
          <PortalCard>
            <PortalCardContent>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground-muted text-xs">
                  Total Earned
                </span>
                <Trophy className="text-warning h-4 w-4" />
              </div>
              <div className="text-foreground text-lg font-bold">
                {formatUSD(totalEarned)}
              </div>
              <p className="text-foreground-subtle mt-0.5 text-xs">
                Lifetime rewards
              </p>
            </PortalCardContent>
          </PortalCard>

          <PortalCard>
            <PortalCardContent>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground-muted text-xs">
                  Pending Rewards
                </span>
                <Gift className="text-positive h-4 w-4" />
              </div>
              <div className="text-positive text-lg font-bold">
                {formatUSD(pendingRewards)}
              </div>
              <p className="text-foreground-subtle mt-0.5 text-xs">
                {availableRewards.length} available
              </p>
            </PortalCardContent>
          </PortalCard>

          <PortalCard>
            <PortalCardContent>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-foreground-muted text-xs">
                  Active Missions
                </span>
                <Target className="text-accent h-4 w-4" />
              </div>
              <div className="text-foreground text-lg font-bold">
                {missions.filter((m) => !m.completed).length}
              </div>
              <p className="text-foreground-subtle mt-0.5 text-xs">
                {missions.filter((m) => m.completed).length} completed
              </p>
            </PortalCardContent>
          </PortalCard>
        </div>

        {/* Tabs */}
        <div className="mb-4 flex gap-1 border-b border-[#333]">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as RewardTab)}
              className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? "border-accent text-foreground"
                  : "text-foreground-muted hover:text-foreground border-transparent"
              }`}
            >
              {tab.label}
              <span
                className={`text-2xs rounded px-1.5 py-0.5 ${
                  activeTab === tab.id
                    ? "bg-accent text-foreground"
                    : "bg-border text-foreground-muted"
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-3">
          {activeTab === "available" && availableRewards.length === 0 && (
            <PortalCard>
              <PortalCardContent className="py-12 text-center">
                <Gift className="text-border-accent mx-auto mb-2 h-10 w-10" />
                <p className="text-foreground-subtle text-sm">
                  No available rewards
                </p>
                <p className="text-foreground-subtle mt-1 text-xs">
                  Complete missions to earn rewards
                </p>
              </PortalCardContent>
            </PortalCard>
          )}

          {activeTab === "available" &&
            availableRewards.map((reward) => (
              <PortalCard key={reward.id}>
                <PortalCardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-positive-muted text-positive flex h-10 w-10 items-center justify-center rounded-sm">
                      {getRewardIcon(reward.type)}
                    </div>
                    <div>
                      <div className="text-foreground text-sm font-medium">
                        {reward.title}
                      </div>
                      <div className="text-foreground-subtle text-xs">
                        {reward.description}
                      </div>
                      {reward.expiresAt && (
                        <div className="text-warning text-2xs mt-1">
                          Expires{" "}
                          {new Date(reward.expiresAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-positive text-sm font-bold">
                        {formatUSD(reward.amount)}
                      </div>
                    </div>
                    <button className="bg-accent hover:bg-accent-hover text-foreground rounded px-3 py-1.5 text-xs font-medium">
                      Claim
                    </button>
                  </div>
                </PortalCardContent>
              </PortalCard>
            ))}

          {activeTab === "claimed" && claimedRewards.length === 0 && (
            <PortalCard>
              <PortalCardContent className="py-12 text-center">
                <CheckCircle className="text-border-accent mx-auto mb-2 h-10 w-10" />
                <p className="text-foreground-subtle text-sm">
                  No claimed rewards yet
                </p>
              </PortalCardContent>
            </PortalCard>
          )}

          {activeTab === "claimed" &&
            claimedRewards.map((reward) => (
              <PortalCard key={reward.id}>
                <PortalCardContent className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-border text-foreground-subtle flex h-10 w-10 items-center justify-center rounded-sm">
                      {getRewardIcon(reward.type)}
                    </div>
                    <div>
                      <div className="text-foreground text-sm font-medium">
                        {reward.title}
                      </div>
                      <div className="text-foreground-subtle text-xs">
                        {reward.description}
                      </div>
                      {reward.claimedAt && (
                        <div className="text-foreground-subtle text-2xs mt-1">
                          Claimed{" "}
                          {new Date(reward.claimedAt).toLocaleDateString()}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-foreground text-sm font-bold">
                      {formatUSD(reward.amount)}
                    </span>
                    <CheckCircle className="text-positive h-4 w-4" />
                  </div>
                </PortalCardContent>
              </PortalCard>
            ))}

          {activeTab === "missions" &&
            missions.map((mission) => (
              <PortalCard
                key={mission.id}
                className={mission.completed ? "opacity-60" : ""}
              >
                <PortalCardContent>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`flex h-10 w-10 items-center justify-center rounded-sm ${
                          mission.completed ? "bg-positive-muted" : "bg-border"
                        }`}
                      >
                        {mission.completed ? (
                          <CheckCircle className="text-positive h-5 w-5" />
                        ) : (
                          getMissionIcon(mission.type)
                        )}
                      </div>
                      <div>
                        <div className="text-foreground text-sm font-medium">
                          {mission.title}
                        </div>
                        <div className="text-foreground-subtle text-xs">
                          {mission.description}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-positive text-sm font-bold">
                        +{formatUSD(mission.reward)}
                      </div>
                      <div className="text-foreground-subtle text-2xs capitalize">
                        {mission.type}
                      </div>
                    </div>
                  </div>

                  {!mission.completed && (
                    <div className="mt-3">
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="text-foreground-muted">Progress</span>
                        <span className="text-foreground">
                          {mission.progress.toLocaleString()} /{" "}
                          {mission.target.toLocaleString()}
                        </span>
                      </div>
                      <div className="bg-border h-1.5 overflow-hidden rounded-full">
                        <div
                          className="bg-accent h-full rounded-full transition-all"
                          style={{
                            width: `${Math.min(100, (mission.progress / mission.target) * 100)}%`,
                          }}
                        />
                      </div>
                    </div>
                  )}
                </PortalCardContent>
              </PortalCard>
            ))}
        </div>
      </div>
    </div>
  );
}
