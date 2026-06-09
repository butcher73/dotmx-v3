import {
  Activity,
  Smartphone,
  Key,
  Lock,
  CheckCircle,
  ChevronRight,
} from "lucide-react";
import {
  PortalCard,
  PortalCardHeader,
  PortalCardTitle,
  PortalCardContent,
} from "@/components/ui";

interface QuickActionsCardProps {
  twoFactorEnabled: boolean;
  whitelistEnabled: boolean;
  onEnable2FA: () => void;
  onEnableWhitelist: () => void;
  onChangePassword: () => void;
}

export function QuickActionsCard({
  twoFactorEnabled,
  whitelistEnabled,
  onEnable2FA,
  onEnableWhitelist,
  onChangePassword,
}: QuickActionsCardProps) {
  return (
    <PortalCard className="border-zinc-800/50 bg-linear-to-br from-zinc-900 to-zinc-900/80">
      <PortalCardHeader>
        <PortalCardTitle className="flex items-center gap-2">
          <Activity className="h-5 w-5 text-purple-400" />
          Security Actions
        </PortalCardTitle>
      </PortalCardHeader>
      <PortalCardContent className="p-4">
        <div className="space-y-2">
          <button
            onClick={onEnable2FA}
            disabled={twoFactorEnabled}
            className={`flex w-full items-center justify-between rounded-xl p-4 text-left transition-all ${
              twoFactorEnabled
                ? "cursor-not-allowed bg-zinc-800/30 opacity-50"
                : "bg-linear-to-r from-emerald-500/10 to-emerald-500/5 ring-1 ring-emerald-500/20 hover:ring-emerald-500/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${twoFactorEnabled ? "bg-emerald-500/20" : "bg-emerald-500/10"}`}
              >
                <Smartphone className="h-5 w-5 text-emerald-400" />
              </div>
              <div>
                <div className="font-semibold text-white">Enable 2FA</div>
                <div className="text-xs text-zinc-400">
                  {twoFactorEnabled ? "Already enabled" : "+40 security points"}
                </div>
              </div>
            </div>
            {twoFactorEnabled ? (
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-zinc-500" />
            )}
          </button>

          <button
            onClick={onEnableWhitelist}
            disabled={whitelistEnabled}
            className={`flex w-full items-center justify-between rounded-xl p-4 text-left transition-all ${
              whitelistEnabled
                ? "cursor-not-allowed bg-zinc-800/30 opacity-50"
                : "bg-linear-to-r from-blue-500/10 to-blue-500/5 ring-1 ring-blue-500/20 hover:ring-blue-500/40"
            }`}
          >
            <div className="flex items-center gap-3">
              <div
                className={`rounded-lg p-2 ${whitelistEnabled ? "bg-blue-500/20" : "bg-blue-500/10"}`}
              >
                <Key className="h-5 w-5 text-blue-400" />
              </div>
              <div>
                <div className="font-semibold text-white">Enable Whitelist</div>
                <div className="text-xs text-zinc-400">
                  {whitelistEnabled ? "Already enabled" : "+25 security points"}
                </div>
              </div>
            </div>
            {whitelistEnabled ? (
              <CheckCircle className="h-5 w-5 text-blue-400" />
            ) : (
              <ChevronRight className="h-5 w-5 text-zinc-500" />
            )}
          </button>

          <button
            onClick={onChangePassword}
            className="flex w-full items-center justify-between rounded-xl bg-linear-to-r from-purple-500/10 to-purple-500/5 p-4 text-left ring-1 ring-purple-500/20 transition-all hover:ring-purple-500/40"
          >
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-purple-500/10 p-2">
                <Lock className="h-5 w-5 text-purple-400" />
              </div>
              <div>
                <div className="font-semibold text-white">Change Password</div>
                <div className="text-xs text-zinc-400">Update credentials</div>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-zinc-500" />
          </button>
        </div>
      </PortalCardContent>
    </PortalCard>
  );
}
