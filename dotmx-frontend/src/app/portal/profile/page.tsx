"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { useAuth } from "@/hooks/useAuth";
import { apiClient } from "@/services/ApiClient";
import {
  User,
  Mail,
  Shield,
  Calendar,
  Edit3,
  CheckCircle,
  XCircle,
  LogOut,
  Settings,
  Camera,
  Save,
  X,
} from "lucide-react";
import {
  PortalCard,
  PortalCardContent,
  PortalPageLayout,
  Alert,
} from "@/components/ui";

export default function ProfilePage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading, refreshProfile, logout } =
    useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    first_name: "",
    last_name: "",
    username: "",
  });

  useEffect(() => {
    if (user) {
      setFormData({
        first_name: user.first_name || "",
        last_name: user.last_name || "",
        username: user.username || "",
      });
    }
  }, [user]);

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/login");
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <PortalPageLayout>
        <div className="mb-6">
          <div className="bg-border mb-2 h-9 w-32 animate-pulse rounded" />
          <div className="bg-border h-5 w-64 animate-pulse rounded" />
        </div>
        <PortalCard className="mb-6">
          <PortalCardContent>
            <div className="h-48 animate-pulse" />
          </PortalCardContent>
        </PortalCard>
        <div className="grid gap-6 md:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <PortalCard key={i}>
              <PortalCardContent>
                <div className="h-24 animate-pulse" />
              </PortalCardContent>
            </PortalCard>
          ))}
        </div>
      </PortalPageLayout>
    );
  }

  if (!user) {
    return null;
  }

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSave = async () => {
    setIsSaving(true);
    setMessage(null);
    try {
      // Send updated profile data to backend
      await apiClient.updateProfile(formData);
      // Refresh profile to get latest data
      await refreshProfile();
      setIsEditing(false);
      setMessage({ type: "success", text: "Profile updated successfully!" });
      setTimeout(() => setMessage(null), 5000);
    } catch (error) {
      console.error("Profile update failed:", error);
      setMessage({
        type: "error",
        text: "Failed to update profile. Please try again.",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      first_name: user.first_name || "",
      last_name: user.last_name || "",
      username: user.username || "",
    });
    setIsEditing(false);
    setMessage(null);
  };

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  const profileStats = [
    {
      title: "Email",
      value: user.email || "Not set",
      icon: Mail,
      color: "accent",
    },
    { title: "Role", value: user.role || "User", icon: Shield, color: "info" },
    {
      title: "Status",
      value: user.email_verified ? "Verified" : "Unverified",
      icon: user.email_verified ? CheckCircle : XCircle,
      color: user.email_verified ? "positive" : "warning",
    },
    { title: "Member Since", value: "N/A", icon: Calendar, color: "warning" },
  ];

  return (
    <PortalPageLayout>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-foreground mb-2 text-3xl font-bold">Profile</h1>
          <p className="text-foreground-muted">
            Manage your account information
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={() => router.push("/portal/security")}
            className="border-border bg-background-card text-foreground hover:border-border-accent flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-medium transition-colors"
          >
            <Settings className="h-4 w-4" />
            Security
          </button>
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="bg-accent text-foreground hover:bg-accent-hover flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium transition-colors"
            >
              <Edit3 className="h-4 w-4" />
              Edit Profile
            </button>
          ) : (
            <>
              <button
                onClick={handleCancel}
                disabled={isSaving}
                className="border-border bg-background-card text-foreground hover:border-border-accent flex items-center gap-2 rounded-sm border px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <X className="h-4 w-4" />
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={isSaving}
                className="bg-accent text-foreground hover:bg-accent-hover flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Save className="h-4 w-4" />
                {isSaving ? "Saving..." : "Save"}
              </button>
            </>
          )}
        </div>
      </div>

      {message && (
        <Alert
          variant={message.type}
          icon={message.type === "success" ? CheckCircle : XCircle}
          message={message.text}
          className="mb-6"
        />
      )}

      <PortalCard className="mb-8">
        <PortalCardContent className="flex flex-col items-center gap-6 md:flex-row md:items-start">
          <div className="relative">
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt="Profile avatar"
                width={120}
                height={120}
                className="border-border rounded-xl border-4"
              />
            ) : (
              <div className="border-border bg-accent text-foreground flex h-[120px] w-[120px] items-center justify-center rounded-xl border-4 text-4xl font-bold">
                {user.first_name?.[0] || user.email?.[0]?.toUpperCase() || "U"}
              </div>
            )}
            {isEditing && (
              <button className="bg-accent text-foreground hover:bg-accent-hover absolute -right-2 -bottom-2 rounded-sm p-2 shadow-lg transition-colors">
                <Camera className="h-4 w-4" />
              </button>
            )}
          </div>

          <div className="flex-1 text-center md:text-left">
            <h2 className="text-foreground mb-1 text-2xl font-bold">
              {user.first_name && user.last_name
                ? `${user.first_name} ${user.last_name}`
                : user.username || user.email?.split("@")[0] || "User"}
            </h2>
            <p className="text-foreground-subtle mb-3">{user.email}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 md:justify-start">
              <span
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${user.email_verified ? "bg-positive-muted text-positive" : "bg-warning-muted text-warning"}`}
              >
                {user.email_verified ? (
                  <CheckCircle className="h-3 w-3" />
                ) : (
                  <XCircle className="h-3 w-3" />
                )}
                {user.email_verified ? "Verified" : "Unverified"}
              </span>
              <span className="bg-accent-muted text-accent inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
                <Shield className="h-3 w-3" />
                {user.role || "User"}
              </span>
            </div>
          </div>
        </PortalCardContent>
      </PortalCard>

      <div className="mb-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {profileStats.map((stat, index) => {
          const Icon = stat.icon;
          const colorMap: Record<string, string> = {
            accent: "text-accent bg-accent-muted",
            positive: "text-positive bg-positive-muted",
            info: "text-info bg-info-muted",
            warning: "text-warning bg-warning-muted",
          };
          return (
            <PortalCard
              key={index}
              className="hover:border-border-accent transition-colors"
            >
              <PortalCardContent>
                <div className="mb-4 flex items-center justify-between">
                  <span className="text-foreground-muted text-sm">
                    {stat.title}
                  </span>
                  <div className={`rounded-sm p-2 ${colorMap[stat.color]}`}>
                    <Icon className="h-5 w-5" />
                  </div>
                </div>
                <div className="text-foreground truncate text-lg font-bold">
                  {stat.value}
                </div>
              </PortalCardContent>
            </PortalCard>
          );
        })}
      </div>

      <PortalCard>
        <PortalCardContent>
          <div className="mb-6">
            <h2 className="text-foreground mb-2 text-xl font-bold">
              Personal Information
            </h2>
            <p className="text-foreground-subtle text-sm">
              Update your personal details
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <div>
              <label className="text-foreground-muted mb-2 flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" />
                <span>First Name</span>
              </label>
              <input
                type="text"
                name="first_name"
                value={formData.first_name}
                onChange={handleChange}
                disabled={!isEditing}
                className="border-border bg-background text-foreground placeholder-foreground-subtle focus:border-accent w-full rounded-sm border px-4 py-3 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter first name"
              />
            </div>
            <div>
              <label className="text-foreground-muted mb-2 flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" />
                <span>Last Name</span>
              </label>
              <input
                type="text"
                name="last_name"
                value={formData.last_name}
                onChange={handleChange}
                disabled={!isEditing}
                className="border-border bg-background text-foreground placeholder-foreground-subtle focus:border-accent w-full rounded-sm border px-4 py-3 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter last name"
              />
            </div>
            <div>
              <label className="text-foreground-muted mb-2 flex items-center gap-2 text-sm font-medium">
                <User className="h-4 w-4" />
                <span>Username</span>
              </label>
              <input
                type="text"
                name="username"
                value={formData.username}
                onChange={handleChange}
                disabled={!isEditing}
                className="border-border bg-background text-foreground placeholder-foreground-subtle focus:border-accent w-full rounded-sm border px-4 py-3 transition-colors focus:outline-none disabled:cursor-not-allowed disabled:opacity-50"
                placeholder="Enter username"
              />
            </div>
            <div>
              <label className="text-foreground-muted mb-2 flex items-center gap-2 text-sm font-medium">
                <Mail className="h-4 w-4" />
                <span>Email</span>
              </label>
              <input
                type="email"
                value={user?.email || ""}
                disabled
                className="border-border bg-background text-foreground w-full cursor-not-allowed rounded-sm border px-4 py-3 opacity-50"
              />
              <p className="text-foreground-subtle mt-1 text-xs">
                Email cannot be changed
              </p>
            </div>
          </div>
        </PortalCardContent>
      </PortalCard>

      <PortalCard className="border-negative/20 mt-8">
        <PortalCardContent>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h3 className="text-foreground mb-1 text-lg font-semibold">
                Sign Out
              </h3>
              <p className="text-foreground-subtle text-sm">
                Sign out of your account on this device
              </p>
            </div>
            <button
              onClick={handleLogout}
              className="bg-negative text-foreground hover:bg-negative/90 flex items-center gap-2 rounded-sm px-4 py-2 text-sm font-medium transition-colors"
            >
              <LogOut className="h-4 w-4" />
              Sign Out
            </button>
          </div>
        </PortalCardContent>
      </PortalCard>
    </PortalPageLayout>
  );
}
