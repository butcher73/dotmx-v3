import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export type StatusBannerVariant = "success" | "info" | "warning" | "danger";

interface StatusBannerProps {
  variant?: StatusBannerVariant;
  icon?: LucideIcon;
  title: string;
  description?: ReactNode;
  score?: number;
  maxScore?: number;
  className?: string;
  children?: ReactNode;
}

const variantStyles = {
  success: {
    container: "from-emerald-500/10 via-emerald-500/5 to-emerald-500/10",
    iconBg: "bg-emerald-500/20 ring-2 ring-emerald-500/50",
    iconColor: "text-emerald-400",
    titleColor: "text-emerald-400",
  },
  info: {
    container: "from-blue-500/10 via-purple-500/10 to-pink-500/10",
    iconBg: "bg-blue-500/20 ring-2 ring-blue-500/50",
    iconColor: "text-blue-400",
    titleColor: "text-blue-400",
  },
  warning: {
    container: "from-amber-500/10 via-amber-500/5 to-amber-500/10",
    iconBg: "bg-amber-500/20 ring-2 ring-amber-500/50",
    iconColor: "text-amber-400",
    titleColor: "text-amber-400",
  },
  danger: {
    container: "from-red-500/10 via-red-500/5 to-red-500/10",
    iconBg: "bg-red-500/20 ring-2 ring-red-500/50",
    iconColor: "text-red-400",
    titleColor: "text-red-400",
  },
};

export function StatusBanner({
  variant = "info",
  icon: Icon,
  title,
  description,
  score,
  maxScore = 100,
  className = "",
  children,
}: StatusBannerProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`overflow-hidden rounded-2xl border border-zinc-800/50 bg-linear-to-br ${styles.container} p-6 backdrop-blur-sm ${className}`}
    >
      <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex items-center gap-4">
          {Icon && (
            <div
              className={`flex h-16 w-16 items-center justify-center rounded-2xl ${styles.iconBg}`}
            >
              <Icon className={`h-8 w-8 ${styles.iconColor}`} />
            </div>
          )}
          <div>
            <div className="mb-1 flex items-center gap-2">
              <span className="text-2xl font-bold text-white">{title}</span>
              {score !== undefined && (
                <>
                  <span className={`text-4xl font-black ${styles.titleColor}`}>
                    {score}
                  </span>
                  <span className="text-xl text-zinc-500">/{maxScore}</span>
                </>
              )}
            </div>
            {description && (
              <div className="flex items-center gap-2 text-sm text-zinc-400">
                {description}
              </div>
            )}
          </div>
        </div>
        {children}
      </div>
    </div>
  );
}

// Status Indicator Component for use with StatusBanner
interface StatusIndicatorProps {
  label: string;
  enabled: boolean;
  icon?: LucideIcon;
}

export function StatusIndicator({
  label,
  enabled,
  icon: Icon,
}: StatusIndicatorProps) {
  return (
    <div
      className={`rounded-xl border p-3 ${
        enabled
          ? "border-emerald-500/30 bg-emerald-500/5"
          : "border-zinc-700/50 bg-zinc-900/50"
      }`}
    >
      <div className="flex items-center justify-between">
        {Icon && (
          <Icon
            className={`h-4 w-4 ${enabled ? "text-emerald-400" : "text-zinc-600"}`}
          />
        )}
        <span
          className={`text-xs font-medium ${enabled ? "text-emerald-400" : "text-zinc-500"}`}
        >
          {label}
        </span>
      </div>
    </div>
  );
}
