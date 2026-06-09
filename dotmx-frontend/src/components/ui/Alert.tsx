import { LucideIcon } from "lucide-react";
import { ReactNode } from "react";

export type AlertVariant = "success" | "error" | "warning" | "info";

interface AlertProps {
  variant?: AlertVariant;
  icon?: LucideIcon;
  title?: string;
  message?: ReactNode;
  className?: string;
  children?: ReactNode;
}

const variantStyles = {
  success: {
    container: "bg-emerald-500/10 ring-1 ring-emerald-500/20",
    icon: "text-emerald-400",
    title: "text-emerald-300",
    message: "text-emerald-200/80",
  },
  error: {
    container: "bg-red-500/10 ring-1 ring-red-500/20",
    icon: "text-red-400",
    title: "text-red-300",
    message: "text-red-200/80",
  },
  warning: {
    container: "bg-amber-500/10 ring-1 ring-amber-500/20",
    icon: "text-amber-400",
    title: "text-amber-300",
    message: "text-amber-200/80",
  },
  info: {
    container: "bg-blue-500/10 ring-1 ring-blue-500/20",
    icon: "text-blue-400",
    title: "text-blue-300",
    message: "text-blue-200/80",
  },
};

export function Alert({
  variant = "info",
  icon: Icon,
  title,
  message,
  className = "",
  children,
}: AlertProps) {
  const styles = variantStyles[variant];

  return (
    <div
      className={`flex items-start gap-3 rounded-xl p-4 ${styles.container} ${className}`}
    >
      {Icon && <Icon className={`h-5 w-5 shrink-0 ${styles.icon}`} />}
      <div className="flex-1">
        {title && (
          <div className={`text-sm font-semibold ${styles.title}`}>{title}</div>
        )}
        {message && (
          <div className={`text-sm ${title ? "mt-1" : ""} ${styles.message}`}>
            {message}
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
