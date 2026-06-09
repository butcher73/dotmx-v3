"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/hooks/useAuth";
import {
  Bell,
  Mail,
  Smartphone,
  TrendingUp,
  DollarSign,
  Shield,
  Settings,
  Info,
} from "lucide-react";
import {
  PortalCard,
  PortalCardContent,
  PortalCardHeader,
  PortalCardTitle,
  PortalPageLayout,
  PortalPageHeader,
} from "@/components/ui";

interface NotificationPreference {
  id: string;
  category: string;
  title: string;
  description: string;
  email: boolean;
  push: boolean;
  sms: boolean;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: "trade" | "security" | "promotion" | "system";
  read: boolean;
  timestamp: number;
}

type NotificationTab = "all" | "preferences";

export default function NotificationsPage() {
  const router = useRouter();
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<NotificationTab>("all");

  useEffect(() => {
    if (!authLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [authLoading, isAuthenticated, router]);

  // Mock data
  const [preferences, setPreferences] = useState<NotificationPreference[]>([
    {
      id: "1",
      category: "Trading",
      title: "Order Filled",
      description: "Get notified when your orders are executed",
      email: true,
      push: true,
      sms: false,
    },
    {
      id: "2",
      category: "Trading",
      title: "Price Alerts",
      description: "Alerts when price reaches your target",
      email: false,
      push: true,
      sms: false,
    },
    {
      id: "3",
      category: "Trading",
      title: "Liquidation Warning",
      description: "Warning when position nears liquidation",
      email: true,
      push: true,
      sms: true,
    },
    {
      id: "4",
      category: "Account",
      title: "Login Alerts",
      description: "New login from unrecognized device",
      email: true,
      push: true,
      sms: true,
    },
    {
      id: "5",
      category: "Account",
      title: "Withdrawal Requests",
      description: "When a withdrawal is initiated",
      email: true,
      push: true,
      sms: true,
    },
    {
      id: "6",
      category: "Promotions",
      title: "Rewards & Promotions",
      description: "Updates on rewards and special offers",
      email: true,
      push: false,
      sms: false,
    },
    {
      id: "7",
      category: "System",
      title: "System Updates",
      description: "Important platform updates and maintenance",
      email: true,
      push: true,
      sms: false,
    },
  ]);

  const notifications: Notification[] = [
    {
      id: "1",
      title: "Order Filled",
      message:
        "Your BTC/USDT long order for 0.05 BTC has been filled at $67,250",
      type: "trade",
      read: false,
      timestamp: Date.now() - 5 * 60 * 1000,
    },
    {
      id: "2",
      title: "New Login Detected",
      message: "New login from Chrome on macOS in San Francisco, US",
      type: "security",
      read: false,
      timestamp: Date.now() - 2 * 60 * 60 * 1000,
    },
    {
      id: "3",
      title: "Deposit Confirmed",
      message: "Your deposit of 1,000 USDT has been confirmed",
      type: "trade",
      read: true,
      timestamp: Date.now() - 24 * 60 * 60 * 1000,
    },
    {
      id: "4",
      title: "Welcome Bonus Available",
      message: "Complete your first trade to claim your $10 welcome bonus",
      type: "promotion",
      read: true,
      timestamp: Date.now() - 48 * 60 * 60 * 1000,
    },
    {
      id: "5",
      title: "Scheduled Maintenance",
      message: "Platform maintenance scheduled for tomorrow at 00:00 UTC",
      type: "system",
      read: true,
      timestamp: Date.now() - 72 * 60 * 60 * 1000,
    },
  ];

  const unreadCount = notifications.filter((n) => !n.read).length;

  const togglePreference = (id: string, channel: "email" | "push" | "sms") => {
    setPreferences((prev) =>
      prev.map((p) => (p.id === id ? { ...p, [channel]: !p[channel] } : p))
    );
  };

  const getNotificationIcon = (type: Notification["type"]) => {
    switch (type) {
      case "trade":
        return <TrendingUp className="text-accent h-4 w-4" />;
      case "security":
        return <Shield className="text-warning h-4 w-4" />;
      case "promotion":
        return <DollarSign className="text-positive h-4 w-4" />;
      case "system":
        return <Settings className="text-info h-4 w-4" />;
    }
  };

  const formatTime = (timestamp: number) => {
    const diff = Date.now() - timestamp;
    const minutes = Math.floor(diff / (60 * 1000));
    const hours = Math.floor(diff / (60 * 60 * 1000));
    const days = Math.floor(diff / (24 * 60 * 60 * 1000));

    if (minutes < 60) return `${minutes}m ago`;
    if (hours < 24) return `${hours}h ago`;
    return `${days}d ago`;
  };

  if (authLoading) {
    return (
      <PortalPageLayout>
        <div className="mb-6">
          <div className="bg-border mb-1.5 h-6 w-32 animate-pulse rounded" />
          <div className="bg-border h-4 w-48 animate-pulse rounded" />
        </div>
      </PortalPageLayout>
    );
  }

  // Group preferences by category
  const groupedPreferences = preferences.reduce<
    Record<string, NotificationPreference[]>
  >((acc, pref) => {
    if (!acc[pref.category]) {
      acc[pref.category] = [];
    }
    acc[pref.category]!.push(pref);
    return acc;
  }, {});

  return (
    <PortalPageLayout>
      <div className="mb-6 flex items-center justify-between">
        <PortalPageHeader
          title="Notifications"
          description="Manage your notifications and preferences"
        />
        {unreadCount > 0 && (
          <button className="text-accent hover:text-accent-hover text-sm">
            Mark all as read
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="mb-6 flex gap-1 border-b border-[#333]">
        <button
          onClick={() => setActiveTab("all")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "all"
              ? "border-accent text-foreground"
              : "text-foreground-muted hover:text-foreground border-transparent"
          }`}
        >
          All Notifications
          {unreadCount > 0 && (
            <span className="bg-accent text-foreground text-2xs rounded-full px-2 py-0.5">
              {unreadCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab("preferences")}
          className={`flex items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "preferences"
              ? "border-accent text-foreground"
              : "text-foreground-muted hover:text-foreground border-transparent"
          }`}
        >
          Preferences
        </button>
      </div>

      {/* Coming Soon Notice */}
      <div
        className="bg-info-muted border-info/30 mb-6 flex items-start gap-3 rounded-lg p-4"
        style={{ border: "1px solid rgba(59, 130, 246, 0.3)" }}
      >
        <Info className="text-info mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <div className="text-info text-sm font-medium">
            Notifications Coming Soon
          </div>
          <p className="text-info/80 mt-1 text-xs">
            Real-time notifications are being developed. The preferences below
            show how the feature will work when available.
          </p>
        </div>
      </div>

      {/* Content */}
      {activeTab === "all" && (
        <div className="space-y-2">
          {notifications.length === 0 ? (
            <PortalCard>
              <PortalCardContent className="py-12 text-center">
                <Bell className="text-border-accent mx-auto mb-2 h-10 w-10" />
                <p className="text-foreground-subtle text-sm">
                  No notifications
                </p>
              </PortalCardContent>
            </PortalCard>
          ) : (
            notifications.map((notification) => (
              <PortalCard key={notification.id}>
                <PortalCardContent
                  className={`flex items-start gap-3 ${
                    !notification.read ? "border-l-accent border-l-2" : ""
                  }`}
                >
                  <div className="bg-border mt-0.5 flex h-8 w-8 items-center justify-center rounded-sm">
                    {getNotificationIcon(notification.type)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div
                        className={`text-sm font-medium ${
                          notification.read
                            ? "text-foreground-muted"
                            : "text-foreground"
                        }`}
                      >
                        {notification.title}
                      </div>
                      <span className="text-foreground-subtle text-2xs shrink-0">
                        {formatTime(notification.timestamp)}
                      </span>
                    </div>
                    <p
                      className={`mt-0.5 text-xs ${
                        notification.read
                          ? "text-foreground-subtle"
                          : "text-foreground-muted"
                      }`}
                    >
                      {notification.message}
                    </p>
                  </div>
                  {!notification.read && (
                    <div className="bg-accent h-2 w-2 shrink-0 rounded-full" />
                  )}
                </PortalCardContent>
              </PortalCard>
            ))
          )}
        </div>
      )}

      {activeTab === "preferences" && (
        <div className="space-y-6">
          {/* Channel Legend */}
          <PortalCard>
            <PortalCardContent>
              <div className="flex flex-wrap items-center gap-6">
                <div className="flex items-center gap-2">
                  <Mail className="text-foreground-muted h-4 w-4" />
                  <span className="text-foreground-muted text-sm">Email</span>
                </div>
                <div className="flex items-center gap-2">
                  <Bell className="text-foreground-muted h-4 w-4" />
                  <span className="text-foreground-muted text-sm">Push</span>
                </div>
                <div className="flex items-center gap-2">
                  <Smartphone className="text-foreground-muted h-4 w-4" />
                  <span className="text-foreground-muted text-sm">SMS</span>
                </div>
              </div>
            </PortalCardContent>
          </PortalCard>

          {/* Preferences by Category */}
          {Object.entries(groupedPreferences).map(([category, prefs]) => (
            <PortalCard key={category}>
              <PortalCardHeader>
                <PortalCardTitle>{category}</PortalCardTitle>
              </PortalCardHeader>
              <div className="divide-y border-t border-[#333]">
                {prefs.map((pref) => (
                  <div
                    key={pref.id}
                    className="flex items-center justify-between border-b border-[#333] p-4"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-foreground text-sm font-medium">
                        {pref.title}
                      </div>
                      <div className="text-foreground-subtle text-xs">
                        {pref.description}
                      </div>
                    </div>
                    <div className="ml-4 flex items-center gap-3">
                      {/* Email Toggle */}
                      <button
                        onClick={() => togglePreference(pref.id, "email")}
                        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                          pref.email
                            ? "bg-accent text-foreground"
                            : "bg-border text-foreground-subtle"
                        }`}
                        title="Email"
                      >
                        <Mail className="h-3.5 w-3.5" />
                      </button>

                      {/* Push Toggle */}
                      <button
                        onClick={() => togglePreference(pref.id, "push")}
                        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                          pref.push
                            ? "bg-accent text-foreground"
                            : "bg-border text-foreground-subtle"
                        }`}
                        title="Push"
                      >
                        <Bell className="h-3.5 w-3.5" />
                      </button>

                      {/* SMS Toggle */}
                      <button
                        onClick={() => togglePreference(pref.id, "sms")}
                        className={`flex h-7 w-7 items-center justify-center rounded transition-colors ${
                          pref.sms
                            ? "bg-accent text-foreground"
                            : "bg-border text-foreground-subtle"
                        }`}
                        title="SMS"
                      >
                        <Smartphone className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </PortalCard>
          ))}
        </div>
      )}
    </PortalPageLayout>
  );
}
