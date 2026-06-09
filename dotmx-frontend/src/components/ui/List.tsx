import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

interface ListProps {
  children: ReactNode;
  className?: string;
}

export function List({ children, className = "" }: ListProps) {
  return (
    <div className={`divide-y divide-zinc-800/50 ${className}`}>{children}</div>
  );
}

// List Item Component
interface ListItemProps {
  icon?: LucideIcon;
  iconColor?: string;
  iconBgColor?: string;
  title: string;
  description?: ReactNode;
  metadata?: ReactNode;
  actions?: ReactNode;
  onClick?: () => void;
  className?: string;
}

export function ListItem({
  icon: Icon,
  iconColor = "text-blue-400",
  iconBgColor = "bg-zinc-800/50",
  title,
  description,
  metadata,
  actions,
  onClick,
  className = "",
}: ListItemProps) {
  return (
    <div
      className={`flex items-center gap-4 p-4 transition-colors ${onClick ? "cursor-pointer hover:bg-zinc-800/30" : ""} ${className}`}
      onClick={onClick}
    >
      {Icon && (
        <div
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${iconBgColor}`}
        >
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
      )}
      <div className="flex-1">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium text-white">{title}</h4>
            {description && (
              <p className="mt-0.5 text-sm text-zinc-400">{description}</p>
            )}
          </div>
          {metadata && (
            <div className="ml-4 shrink-0 text-right">{metadata}</div>
          )}
        </div>
      </div>
      {actions && <div className="shrink-0">{actions}</div>}
    </div>
  );
}

// List Item with Badge
interface ListItemBadgeProps {
  label: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
  className?: string;
}

export function ListItemBadge({
  label,
  variant = "default",
  className = "",
}: ListItemBadgeProps) {
  const variantStyles = {
    default: "bg-zinc-700/50 text-zinc-300",
    success: "bg-emerald-500/20 text-emerald-400",
    warning: "bg-amber-500/20 text-amber-400",
    danger: "bg-red-500/20 text-red-400",
    info: "bg-blue-500/20 text-blue-400",
  };

  return (
    <span
      className={`rounded-full px-2 py-0.5 text-xs font-medium ${variantStyles[variant]} ${className}`}
    >
      {label}
    </span>
  );
}

// List Empty State
interface ListEmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
  className?: string;
}

export function ListEmptyState({
  icon: Icon,
  title,
  description,
  action,
  className = "",
}: ListEmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className}`}
    >
      {Icon && (
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-zinc-800/50">
          <Icon className="h-8 w-8 text-zinc-600" />
        </div>
      )}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {description && (
        <p className="mt-1 text-sm text-zinc-400">{description}</p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
