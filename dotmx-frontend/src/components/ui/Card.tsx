import React from "react";

interface CardProps {
  children?: React.ReactNode;
  variant?: "default" | "highlight" | "feature" | "faq";
  className?: string;
  hover?: boolean;
  icon?: React.ReactNode;
  title?: string;
  description?: string;
}

export const Card: React.FC<CardProps> = ({
  children,
  variant = "default",
  className = "",
  hover = true,
  icon,
  title,
  description,
}) => {
  const baseClasses = "rounded-3xl transition-all duration-500 shadow-2xl";

  const variantClasses = {
    default:
      "bg-linear-to-br from-[#122347] to-[#1A2E57] border border-[#23345C] p-8",
    highlight:
      "bg-linear-to-br from-[#122347] to-[#1A2E57] border border-[#23345C] p-10 text-center",
    feature:
      "bg-linear-to-br from-[#122347] to-[#1A2E57] border border-[#23345C] p-10",
    faq: "bg-linear-to-r from-[#122347] to-[#1A2E57] border border-[#23345C] p-10",
  };

  const hoverClasses = hover
    ? "hover:border-[#3A8DFF] hover:transform hover:scale-105 group"
    : "";

  const combinedClasses = `${baseClasses} ${variantClasses[variant]} ${hoverClasses} ${className}`;

  if (variant === "highlight" && (icon || title || description)) {
    return (
      <div className={combinedClasses}>
        {icon && (
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#1A2E57] shadow-2xl transition-all duration-500 group-hover:shadow-[#3A8DFF]/30">
            {icon}
          </div>
        )}
        {title && (
          <h3 className="mb-6 text-2xl font-bold text-white">{title}</h3>
        )}
        {description && (
          <p className="text-lg leading-relaxed text-[#A3B8D9]">
            {description}
          </p>
        )}
        {children}
      </div>
    );
  }

  if (variant === "feature" && (icon || title || description)) {
    return (
      <div className={combinedClasses}>
        {icon && (
          <div className="mb-8 flex h-16 w-16 items-center justify-center rounded-2xl bg-linear-to-br from-[#3A8DFF] to-[#1A2E57] transition-all duration-500 group-hover:shadow-[#3A8DFF]/30">
            {icon}
          </div>
        )}
        {title && (
          <h3 className="mb-6 text-2xl font-bold text-[#3A8DFF]">{title}</h3>
        )}
        {description && (
          <p className="text-lg leading-relaxed text-[#A3B8D9]">
            {description}
          </p>
        )}
        {children}
      </div>
    );
  }

  if (variant === "faq" && (title || description)) {
    return (
      <div className={combinedClasses}>
        {title && (
          <h3 className="mb-6 text-2xl font-bold text-[#3A8DFF]">{title}</h3>
        )}
        {description && (
          <p className="text-lg leading-relaxed text-[#A3B8D9]">
            {description}
          </p>
        )}
        {children}
      </div>
    );
  }

  return <div className={combinedClasses}>{children}</div>;
};

export default Card;
