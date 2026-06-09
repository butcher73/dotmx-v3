import { Lock, Eye, EyeOff, CheckCircle, AlertTriangle, X } from "lucide-react";
import {
  PortalCard,
  PortalCardHeader,
  PortalCardTitle,
  PortalCardContent,
} from "@/components/ui";

interface PasswordCardProps {
  showChangePassword: boolean;
  passwordVisibility: { current: boolean; new: boolean; confirm: boolean };
  passwordForm: { current: string; new: string; confirm: string };
  isChangingPassword: boolean;
  message: { type: "success" | "error"; text: string } | null;
  passwordStrength: {
    strength: number;
    label: string;
    color: string;
    requirements: Array<{ met: boolean; text: string }>;
  };
  onShowChangePassword: (show: boolean) => void;
  onPasswordVisibilityToggle: (field: "current" | "new" | "confirm") => void;
  onPasswordFormChange: (field: string, value: string) => void;
  onChangePassword: () => void;
}

export function PasswordCard({
  showChangePassword,
  passwordVisibility,
  passwordForm,
  isChangingPassword,
  message,
  passwordStrength,
  onShowChangePassword,
  onPasswordVisibilityToggle,
  onPasswordFormChange,
  onChangePassword,
}: PasswordCardProps) {
  return (
    <PortalCard className="border-zinc-800/50 bg-linear-to-br from-zinc-900 to-zinc-900/80">
      <PortalCardHeader>
        <PortalCardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5 text-purple-400" />
          Password Security
        </PortalCardTitle>
      </PortalCardHeader>
      <PortalCardContent>
        {message && (
          <div
            className={`mb-4 flex items-center gap-3 rounded-xl p-4 ${
              message.type === "success"
                ? "bg-emerald-500/10 ring-1 ring-emerald-500/20"
                : "bg-red-500/10 ring-1 ring-red-500/20"
            }`}
          >
            {message.type === "success" ? (
              <CheckCircle className="h-5 w-5 text-emerald-400" />
            ) : (
              <AlertTriangle className="h-5 w-5 text-red-400" />
            )}
            <div className="flex-1">
              <div
                className={`text-sm font-semibold ${
                  message.type === "success"
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {message.type === "success" ? "Success!" : "Error"}
              </div>
              <div className="text-xs text-zinc-400">{message.text}</div>
            </div>
          </div>
        )}
        {!showChangePassword ? (
          <div className="flex items-center justify-between">
            <div className="flex gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800/50">
                <Lock className="h-6 w-6 text-zinc-500" />
              </div>
              <div>
                <div className="mb-1 font-semibold text-white">
                  Change Password
                </div>
                <div className="text-sm text-zinc-400">
                  Update your account password
                </div>
              </div>
            </div>
            <button
              onClick={() => onShowChangePassword(true)}
              className="rounded-lg bg-blue-500/10 px-4 py-2 text-sm font-medium text-blue-400 ring-1 ring-blue-500/20 hover:bg-blue-500/20"
            >
              Change
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Current Password
              </label>
              <div className="relative">
                <input
                  type={passwordVisibility.current ? "text" : "password"}
                  value={passwordForm.current}
                  onChange={(e) =>
                    onPasswordFormChange("current", e.target.value)
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 pr-10 text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => onPasswordVisibilityToggle("current")}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {passwordVisibility.current ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                New Password
              </label>
              <div className="relative">
                <input
                  type={passwordVisibility.new ? "text" : "password"}
                  value={passwordForm.new}
                  onChange={(e) => onPasswordFormChange("new", e.target.value)}
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 pr-10 text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => onPasswordVisibilityToggle("new")}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {passwordVisibility.new ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
              {passwordForm.new && (
                <div className="mt-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-zinc-400">
                      Password Strength
                    </span>
                    <span
                      className={`text-xs font-bold ${
                        passwordStrength.color === "emerald"
                          ? "text-emerald-400"
                          : passwordStrength.color === "amber"
                            ? "text-amber-400"
                            : "text-red-400"
                      }`}
                    >
                      {passwordStrength.label}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
                    <div
                      className={`h-full transition-all duration-300 ${
                        passwordStrength.color === "emerald"
                          ? "bg-linear-to-r from-emerald-500 to-emerald-400"
                          : passwordStrength.color === "amber"
                            ? "bg-linear-to-r from-amber-500 to-amber-400"
                            : "bg-linear-to-r from-red-500 to-red-400"
                      }`}
                      style={{ width: `${passwordStrength.strength}%` }}
                    />
                  </div>
                  <div className="space-y-1.5 rounded-lg bg-zinc-900/50 p-3">
                    {passwordStrength.requirements.map((req, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2 text-xs"
                      >
                        {req.met ? (
                          <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                        ) : (
                          <X className="h-3.5 w-3.5 text-zinc-600" />
                        )}
                        <span
                          className={
                            req.met ? "text-zinc-300" : "text-zinc-600"
                          }
                        >
                          {req.text}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            <div>
              <label className="mb-2 block text-sm font-medium text-zinc-300">
                Confirm New Password
              </label>
              <div className="relative">
                <input
                  type={passwordVisibility.confirm ? "text" : "password"}
                  value={passwordForm.confirm}
                  onChange={(e) =>
                    onPasswordFormChange("confirm", e.target.value)
                  }
                  className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-2 pr-10 text-white placeholder-zinc-500 focus:ring-2 focus:ring-blue-500 focus:outline-none"
                />
                <button
                  onClick={() => onPasswordVisibilityToggle("confirm")}
                  className="absolute top-1/2 right-3 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
                >
                  {passwordVisibility.confirm ? (
                    <EyeOff className="h-5 w-5" />
                  ) : (
                    <Eye className="h-5 w-5" />
                  )}
                </button>
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => {
                  onShowChangePassword(false);
                  onPasswordFormChange("current", "");
                  onPasswordFormChange("new", "");
                  onPasswordFormChange("confirm", "");
                }}
                className="flex-1 rounded-lg bg-zinc-800 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-700"
              >
                Cancel
              </button>
              <button
                onClick={onChangePassword}
                disabled={
                  isChangingPassword ||
                  !passwordForm.current ||
                  !passwordForm.new ||
                  !passwordForm.confirm
                }
                className="flex-1 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isChangingPassword ? "Changing..." : "Update Password"}
              </button>
            </div>
          </div>
        )}
      </PortalCardContent>
    </PortalCard>
  );
}
