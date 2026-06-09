import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface FeatureToggleProps {
  icon?: LucideIcon;
  iconColor?: string;
  title: string;
  description?: ReactNode;
  enabled: boolean;
  loading?: boolean;
  onToggle: () => void;
  disabled?: boolean;
  className?: string;
}

export function FeatureToggle({
  icon: Icon,
  iconColor = "text-blue-400",
  title,
  description,
  enabled,
  loading = false,
  onToggle,
  disabled = false,
  className = "",
}: FeatureToggleProps) {
  return (
    <div
      className={`flex items-center justify-between rounded-xl border p-4 ${
        enabled
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-zinc-800/50 bg-zinc-900/50"
      } ${className}`}
    >
      <div className="flex items-center gap-3">
        {Icon && (
          <div
            className={`flex h-10 w-10 items-center justify-center rounded-lg ${
              enabled ? "bg-emerald-500/20" : "bg-zinc-800/50"
            }`}
          >
            <Icon
              className={`h-5 w-5 ${enabled ? "text-emerald-400" : iconColor}`}
            />
          </div>
        )}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-medium text-white">{title}</span>
            {enabled && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                Active
              </span>
            )}
          </div>
          {description && (
            <div className="mt-1 text-sm text-zinc-400">{description}</div>
          )}
        </div>
      </div>
      <button
        onClick={onToggle}
        disabled={disabled || loading}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
          enabled ? "bg-emerald-500" : "bg-zinc-700"
        } ${disabled || loading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            enabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}

// Feature Status Card - Shows status with action button
interface FeatureStatusCardProps {
  icon?: LucideIcon;
  iconColor?: string;
  title: string;
  description?: ReactNode;
  enabled: boolean;
  loading?: boolean;
  actionLabel?: string;
  onAction: () => void;
  disabled?: boolean;
  className?: string;
}

export function FeatureStatusCard({
  icon: Icon,
  iconColor = "text-blue-400",
  title,
  description,
  enabled,
  loading = false,
  actionLabel,
  onAction,
  disabled = false,
  className = "",
}: FeatureStatusCardProps) {
  return (
    <div
      className={`rounded-xl border p-4 ${
        enabled
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-zinc-800/50 bg-zinc-900/50"
      } ${className}`}
    >
      <div className="flex items-start gap-4">
        {Icon && (
          <div
            className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${
              enabled ? "bg-emerald-500/20" : "bg-zinc-800/50"
            }`}
          >
            <Icon
              className={`h-6 w-6 ${enabled ? "text-emerald-400" : iconColor}`}
            />
          </div>
        )}
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-white">{title}</span>
            {enabled && (
              <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-medium text-emerald-400">
                Enabled
              </span>
            )}
          </div>
          {description && (
            <div className="mt-1 text-sm text-zinc-400">{description}</div>
          )}
          {actionLabel && (
            <button
              onClick={onAction}
              disabled={disabled || loading}
              className={`mt-3 rounded-lg px-4 py-2 text-sm font-medium transition-colors ${
                enabled
                  ? "bg-zinc-700 text-white hover:bg-zinc-600"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              } ${disabled || loading ? "cursor-not-allowed opacity-50" : ""}`}
            >
              {loading ? "Processing..." : actionLabel}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
