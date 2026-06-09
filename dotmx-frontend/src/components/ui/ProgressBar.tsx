import { ReactNode } from "react";

export type ProgressBarVariant = "default" | "success" | "warning" | "danger";

interface ProgressBarProps {
  value: number;
  max?: number;
  variant?: ProgressBarVariant;
  label?: ReactNode;
  showValue?: boolean;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const variantStyles = {
  default: "bg-blue-500",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  danger: "bg-red-500",
};

const sizeStyles = {
  sm: "h-1",
  md: "h-2",
  lg: "h-3",
};

export function ProgressBar({
  value,
  max = 100,
  variant = "default",
  label,
  showValue = false,
  size = "md",
  className = "",
}: ProgressBarProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));

  return (
    <div className={`w-full ${className}`}>
      {(label || showValue) && (
        <div className="mb-2 flex items-center justify-between text-sm">
          {label && <span className="text-zinc-300">{label}</span>}
          {showValue && (
            <span className="font-medium text-white">
              {value}/{max}
            </span>
          )}
        </div>
      )}
      <div
        className={`w-full overflow-hidden rounded-full bg-zinc-800 ${sizeStyles[size]}`}
      >
        <div
          className={`${sizeStyles[size]} transition-all duration-300 ${variantStyles[variant]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

// Circular Progress
interface CircularProgressProps {
  value: number;
  max?: number;
  size?: number;
  strokeWidth?: number;
  variant?: ProgressBarVariant;
  showValue?: boolean;
  label?: ReactNode;
  className?: string;
}

export function CircularProgress({
  value,
  max = 100,
  size = 120,
  strokeWidth = 8,
  variant = "default",
  showValue = true,
  label,
  className = "",
}: CircularProgressProps) {
  const percentage = Math.min(100, Math.max(0, (value / max) * 100));
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  const variantColors = {
    default: "#3A8DFF",
    success: "#00D897",
    warning: "#F59E0B",
    danger: "#FF6B6B",
  };

  return (
    <div
      className={`relative inline-flex items-center justify-center ${className}`}
    >
      <svg width={size} height={size} className="-rotate-90 transform">
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#27272a"
          strokeWidth={strokeWidth}
          fill="none"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={variantColors[variant]}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-300"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        {showValue && (
          <span className="text-2xl font-bold text-white">
            {Math.round(percentage)}
          </span>
        )}
        {label && <span className="text-xs text-zinc-400">{label}</span>}
      </div>
    </div>
  );
}
