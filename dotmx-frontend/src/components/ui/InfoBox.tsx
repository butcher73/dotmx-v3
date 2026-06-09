import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export type InfoBoxVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info";

interface InfoBoxProps {
  variant?: InfoBoxVariant;
  icon?: LucideIcon;
  title?: string;
  children: ReactNode;
  className?: string;
}

const variantStyles = {
  default: {
    container: "border-zinc-700/50 bg-zinc-800/30",
    icon: "text-zinc-400",
    title: "text-zinc-200",
  },
  success: {
    container: "border-emerald-500/30 bg-emerald-500/5",
    icon: "text-emerald-400",
    title: "text-emerald-300",
  },
  warning: {
    container: "border-amber-500/30 bg-amber-500/5",
    icon: "text-amber-400",
    title: "text-amber-300",
  },
  danger: {
    container: "border-red-500/30 bg-red-500/5",
    icon: "text-red-400",
    title: "text-red-300",
  },
  info: {
    container: "border-blue-500/30 bg-blue-500/5",
    icon: "text-blue-400",
    title: "text-blue-300",
  },
};

export function InfoBox({
  variant = "default",
  icon: Icon,
  title,
  children,
  className = "",
}: InfoBoxProps) {
  const styles = variantStyles[variant];

  return (
    <div className={`rounded-xl border p-4 ${styles.container} ${className}`}>
      <div className="flex gap-3">
        {Icon && (
          <div className="shrink-0">
            <Icon className={`h-5 w-5 ${styles.icon}`} />
          </div>
        )}
        <div className="flex-1">
          {title && (
            <h4 className={`mb-1 font-semibold ${styles.title}`}>{title}</h4>
          )}
          <div className="text-sm text-zinc-400">{children}</div>
        </div>
      </div>
    </div>
  );
}

// Code Box - for displaying code snippets, API keys, etc.
interface CodeBoxProps {
  code: string;
  label?: string;
  onCopy?: () => void;
  copied?: boolean;
  className?: string;
}

export function CodeBox({
  code,
  label,
  onCopy,
  copied = false,
  className = "",
}: CodeBoxProps) {
  return (
    <div className={`${className}`}>
      {label && (
        <label className="mb-2 block text-sm font-medium text-zinc-300">
          {label}
        </label>
      )}
      <div className="relative rounded-lg border border-zinc-700/50 bg-zinc-900 p-4">
        <code className="font-mono text-sm break-all text-zinc-300">
          {code}
        </code>
        {onCopy && (
          <button
            onClick={onCopy}
            className="absolute top-2 right-2 rounded-lg bg-zinc-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-700"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        )}
      </div>
    </div>
  );
}

// Stats Box - for displaying key metrics
interface StatsBoxProps {
  label: string;
  value: ReactNode;
  icon?: LucideIcon;
  trend?: {
    value: number;
    direction: "up" | "down";
  };
  variant?: "default" | "success" | "warning" | "danger";
  className?: string;
}

export function StatsBox({
  label,
  value,
  icon: Icon,
  trend,
  variant = "default",
  className = "",
}: StatsBoxProps) {
  const variantColors = {
    default: "text-blue-400",
    success: "text-emerald-400",
    warning: "text-amber-400",
    danger: "text-red-400",
  };

  return (
    <div
      className={`rounded-xl border border-zinc-800/50 bg-zinc-900/50 p-4 ${className}`}
    >
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <p className="text-sm text-zinc-400">{label}</p>
          <p className={`mt-1 text-2xl font-bold ${variantColors[variant]}`}>
            {value}
          </p>
          {trend && (
            <div className="mt-1 flex items-center gap-1 text-xs">
              <span
                className={
                  trend.direction === "up" ? "text-emerald-400" : "text-red-400"
                }
              >
                {trend.direction === "up" ? "↑" : "↓"} {trend.value}%
              </span>
            </div>
          )}
        </div>
        {Icon && (
          <div className={`rounded-lg bg-zinc-800/50 p-3`}>
            <Icon className={`h-6 w-6 ${variantColors[variant]}`} />
          </div>
        )}
      </div>
    </div>
  );
}
