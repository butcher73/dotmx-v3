import React from "react";

interface IconProps {
  name: "info" | "chevron-down" | "arrow-right";
  className?: string;
  size?: number;
}

const icons = {
  info: (
    <path
      fillRule="evenodd"
      d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
      clipRule="evenodd"
    />
  ),
  "chevron-down": (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M19 9l-7 7-7-7"
    />
  ),
  "arrow-right": (
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 8l4 4m0 0l-4 4m4-4H3"
    />
  ),
};

export default function Icon({ name, className = "", size = 20 }: IconProps) {
  const iconPath = icons[name];

  if (!iconPath) {
    return null;
  }

  const isFilled = name === "info";

  return (
    <svg
      className={className}
      fill={isFilled ? "currentColor" : "none"}
      stroke={isFilled ? "none" : "currentColor"}
      viewBox="0 0 20 20"
      width={size}
      height={size}
    >
      {iconPath}
    </svg>
  );
}
