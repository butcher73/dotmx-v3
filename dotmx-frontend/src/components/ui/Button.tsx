import React from "react";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children?: React.ReactNode;
  variant?:
    | "primary"
    | "secondary"
    | "outline"
    | "danger"
    | "success"
    | "ghost"
    | "tab"
    | "icon-only"
    | "trading-buy"
    | "trading-sell"
    | "trading-close"
    | "percentage";
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  onClick?: (event: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  type?: "button" | "submit" | "reset";
  icon?: React.ReactNode;
  iconPosition?: "left" | "right";
  fullWidth?: boolean;
  active?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  children,
  variant = "primary",
  size = "md",
  className = "",
  onClick,
  disabled = false,
  loading = false,
  type = "button",
  icon,
  iconPosition = "left",
  fullWidth = false,
  active = false,
  ...props
}) => {
  const baseClasses = `
    inline-flex items-center justify-center
    font-medium rounded-lg 
    transition-all duration-200 ease-in-out
    focus:outline-none focus:ring-2 focus:ring-offset-1
    disabled:opacity-50 disabled:cursor-not-allowed
    ${fullWidth ? "w-full" : ""}
  `
    .trim()
    .replace(/\s+/g, " ");

  const variantClasses = {
    primary: `
      bg-[var(--accent)] text-white 
      hover:bg-[var(--accent-hover)] hover:shadow-lg
      focus:ring-[var(--accent)]/50
      shadow-md
    `,
    secondary: `
      bg-[var(--card-bg)] text-[var(--foreground)] border border-[var(--border)]
      hover:bg-[var(--accent-hover)] hover:border-[var(--accent)]
      focus:ring-[var(--accent)]/50
    `,
    outline: `
      border-2 border-[var(--accent)] text-[var(--accent)] bg-transparent
      hover:bg-[var(--accent)] hover:text-white
      focus:ring-[var(--accent)]/50
    `,
    danger: `
      bg-red-600 text-white
      hover:bg-red-700 hover:shadow-lg
      focus:ring-red-500/50
    `,
    success: `
      bg-green-600 text-white
      hover:bg-green-700 hover:shadow-lg
      focus:ring-green-500/50
    `,
    ghost: `
      text-[var(--muted)] bg-transparent
      hover:text-[var(--foreground)] hover:bg-[var(--card-bg)]
      focus:ring-[var(--accent)]/50
    `,
    tab: `
      text-[var(--muted)] bg-transparent border-b-2 border-transparent
      hover:text-[var(--foreground)] hover:border-[var(--accent)]
      focus:ring-[var(--accent)]/50 rounded-none
      ${active ? "text-[var(--accent)] border-[var(--accent)]" : ""}
    `,
    "icon-only": `
      text-[var(--muted)] bg-transparent
      hover:text-[var(--foreground)] hover:bg-[var(--card-bg)]
      focus:ring-[var(--accent)]/50
      aspect-square
    `,
    "trading-buy": `
      bg-green-600/20 text-green-400 border border-green-600/30
      hover:bg-green-600/30 hover:border-green-500
      focus:ring-green-500/50
    `,
    "trading-sell": `
      bg-red-600/20 text-red-400 border border-red-600/30
      hover:bg-red-600/30 hover:border-red-500
      focus:ring-red-500/50
    `,
    "trading-close": `
      bg-orange-600/20 text-orange-400 border border-orange-600/30
      hover:bg-orange-600/30 hover:border-orange-500
      focus:ring-orange-500/50
    `,
    percentage: `
      bg-[var(--card-bg)] text-[var(--muted)] border border-[var(--border)]
      hover:bg-[var(--accent)] hover:text-white hover:border-[var(--accent)]
      focus:ring-[var(--accent)]/50
      ${active ? "bg-[var(--accent)] text-white border-[var(--accent)]" : ""}
    `,
  };

  const sizeClasses = {
    xs: "px-2 py-1 text-xs gap-1",
    sm: "px-3 py-1.5 text-sm gap-1.5",
    md: "px-4 py-2 text-sm gap-2",
    lg: "px-6 py-3 text-base gap-2",
    xl: "px-8 py-4 text-lg gap-3",
  };

  const iconOnlySize = {
    xs: "p-1",
    sm: "p-1.5",
    md: "p-2",
    lg: "p-3",
    xl: "p-4",
  };

  const loadingSpinner = (
    <svg
      className="h-4 w-4 animate-spin"
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
    >
      <circle
        className="opacity-25"
        cx="12"
        cy="12"
        r="10"
        stroke="currentColor"
        strokeWidth="4"
      />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );

  const appliedSizeClasses =
    variant === "icon-only" ? iconOnlySize[size] : sizeClasses[size];

  const combinedClasses = `
    ${baseClasses}
    ${variantClasses[variant]?.trim().replace(/\s+/g, " ")}
    ${appliedSizeClasses}
    ${className}
  `
    .trim()
    .replace(/\s+/g, " ");

  return (
    <button
      type={type}
      className={combinedClasses}
      onClick={onClick}
      disabled={disabled || loading}
      {...props}
    >
      {loading && loadingSpinner}
      {!loading && icon && iconPosition === "left" && icon}
      {!loading && children}
      {!loading && icon && iconPosition === "right" && icon}
    </button>
  );
};

export default Button;
