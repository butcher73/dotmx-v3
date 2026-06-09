import { Settings, CheckCircle, AlertTriangle, Check } from "lucide-react";
import {
  PortalCard,
  PortalCardHeader,
  PortalCardTitle,
  PortalCardContent,
} from "@/components/ui";

interface UserProfileCardProps {
  user: {
    email?: string;
    username?: string;
    email_verified?: boolean;
  };
  sessionsCount: number;
  whitelistCount: number;
}

export function UserProfileCard({
  user,
  sessionsCount,
  whitelistCount,
}: UserProfileCardProps) {
  return (
    <PortalCard className="border-zinc-800/50 bg-linear-to-br from-zinc-900 to-zinc-900/80">
      <PortalCardHeader>
        <PortalCardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5 text-blue-400" />
          Account Profile
        </PortalCardTitle>
      </PortalCardHeader>
      <PortalCardContent className="p-6">
        <div className="flex flex-col items-center text-center">
          <div className="relative mb-4">
            <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-linear-to-br from-blue-500 via-purple-500 to-pink-500 p-0.5">
              <div className="flex h-full w-full items-center justify-center rounded-3xl bg-zinc-900">
                <span className="text-4xl font-black text-white">
                  {user.email?.charAt(0).toUpperCase() || "U"}
                </span>
              </div>
            </div>
            {user.email_verified && (
              <div className="absolute -right-1 -bottom-1 rounded-full bg-emerald-500 p-1.5 ring-4 ring-zinc-900">
                <Check className="h-3 w-3 text-white" />
              </div>
            )}
          </div>
          <div className="mb-2 text-xl font-bold text-white">
            {user.username || "User"}
          </div>
          <div className="mb-3 rounded-full bg-zinc-800/50 px-3 py-1 font-mono text-sm text-zinc-400">
            {user.email}
          </div>
          {user.email_verified ? (
            <div className="flex items-center gap-2 rounded-xl bg-emerald-500/10 px-4 py-2 ring-1 ring-emerald-500/30">
              <CheckCircle className="h-4 w-4 text-emerald-400" />
              <span className="text-sm font-semibold text-emerald-400">
                Email Verified
              </span>
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2 ring-1 ring-amber-500/30">
                <AlertTriangle className="h-4 w-4 text-amber-400" />
                <span className="text-sm font-semibold text-amber-400">
                  Email Not Verified
                </span>
              </div>
              <button className="text-xs text-blue-400 hover:text-blue-300">
                Resend verification email
              </button>
            </div>
          )}
        </div>

        <div className="mt-6 grid grid-cols-2 gap-3 border-t border-zinc-800 pt-6">
          <div className="rounded-xl bg-zinc-800/30 p-3 text-center">
            <div className="mb-1 text-2xl font-bold text-white">
              {sessionsCount}
            </div>
            <div className="text-xs text-zinc-400">Active Devices</div>
          </div>
          <div className="rounded-xl bg-zinc-800/30 p-3 text-center">
            <div className="mb-1 text-2xl font-bold text-white">
              {whitelistCount}
            </div>
            <div className="text-xs text-zinc-400">Whitelisted</div>
          </div>
        </div>
      </PortalCardContent>
    </PortalCard>
  );
}
