import React from "react";

interface BadgeProps {
  children: React.ReactNode;
  variant?: "default" | "golden" | "numbered";
  size?: "sm" | "md" | "lg";
  className?: string;
  number?: number;
  animate?: boolean;
}

export const Badge: React.FC<BadgeProps> = ({
  children,
  variant = "default",
  size = "md",
  className = "",
  number,
  animate = false,
}) => {
  const baseClasses =
    "rounded-full flex items-center justify-center font-bold transition-all duration-500";

  const variantClasses = {
    default:
      "bg-linear-to-br from-[#ffd700] to-[#d4af37] text-black shadow-2xl",
    golden: "bg-linear-to-br from-[#ffd700] to-[#d4af37] text-black shadow-2xl",
    numbered:
      "bg-linear-to-br from-[#ffd700] to-[#d4af37] text-black shadow-2xl group-hover:shadow-[#d4af37]/30",
  };

  const sizeClasses = {
    sm: "w-8 h-8 text-sm",
    md: "w-12 h-12 text-lg",
    lg: "w-24 h-24 text-3xl",
  };

  const animateClasses = animate ? "hover:scale-110" : "";

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${sizeClasses[size]} ${animateClasses} ${className}`;

  if (variant === "numbered" && number) {
    return (
      <div className="relative mb-12">
        <div className={combinedClasses}>
          <span>{number}</span>
        </div>
        <div className="absolute -top-2 -right-2 h-8 w-8 animate-ping rounded-full bg-[#d4af37] opacity-60"></div>
      </div>
    );
  }

  return <div className={combinedClasses}>{children}</div>;
};

export default Badge;
