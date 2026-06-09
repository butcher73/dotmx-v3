import { ReactNode } from "react";

export type GradientCardVariant =
  | "default"
  | "success"
  | "warning"
  | "danger"
  | "info";

interface GradientCardProps {
  variant?: GradientCardVariant;
  children: ReactNode;
  className?: string;
  hover?: boolean;
}

const variantStyles = {
  default: "from-zinc-900 to-zinc-900/80",
  success: "from-emerald-900/20 via-zinc-900 to-zinc-900/80",
  warning: "from-amber-900/20 via-zinc-900 to-zinc-900/80",
  danger: "from-red-900/20 via-zinc-900 to-zinc-900/80",
  info: "from-blue-900/20 via-zinc-900 to-zinc-900/80",
};

export function GradientCard({
  variant = "default",
  children,
  className = "",
  hover = false,
}: GradientCardProps) {
  return (
    <div
      className={`rounded-2xl border border-zinc-800/50 bg-linear-to-br ${variantStyles[variant]} ${hover ? "transition-all duration-200 hover:border-zinc-700/50 hover:shadow-lg hover:shadow-zinc-900/50" : ""} ${className}`}
    >
      {children}
    </div>
  );
}

// Card Header
interface GradientCardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function GradientCardHeader({
  children,
  className = "",
}: GradientCardHeaderProps) {
  return (
    <div className={`border-b border-zinc-800/50 p-6 ${className}`}>
      {children}
    </div>
  );
}

// Card Title
interface GradientCardTitleProps {
  children: ReactNode;
  className?: string;
}

export function GradientCardTitle({
  children,
  className = "",
}: GradientCardTitleProps) {
  return (
    <h3 className={`text-lg font-semibold text-white ${className}`}>
      {children}
    </h3>
  );
}

// Card Content
interface GradientCardContentProps {
  children: ReactNode;
  className?: string;
}

export function GradientCardContent({
  children,
  className = "",
}: GradientCardContentProps) {
  return <div className={`p-6 ${className}`}>{children}</div>;
}

// Card Footer
interface GradientCardFooterProps {
  children: ReactNode;
  className?: string;
}

export function GradientCardFooter({
  children,
  className = "",
}: GradientCardFooterProps) {
  return (
    <div className={`border-t border-zinc-800/50 p-6 ${className}`}>
      {children}
    </div>
  );
}
