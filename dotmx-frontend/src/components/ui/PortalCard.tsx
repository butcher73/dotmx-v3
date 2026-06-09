import React from "react";

interface PortalCardProps {
  children: React.ReactNode;
  className?: string;
}

export const PortalCard: React.FC<PortalCardProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`rounded-xl border border-[#333] bg-background-card ${className}`}
    >
      {children}
    </div>
  );
};

interface PortalCardHeaderProps {
  children: React.ReactNode;
  className?: string;
}

export const PortalCardHeader: React.FC<PortalCardHeaderProps> = ({
  children,
  className = "",
}) => {
  return (
    <div
      className={`flex items-center justify-between border-b border-border p-6 ${className}`}
    >
      {children}
    </div>
  );
};

interface PortalCardContentProps {
  children: React.ReactNode;
  className?: string;
}

export const PortalCardContent: React.FC<PortalCardContentProps> = ({
  children,
  className = "",
}) => {
  return <div className={`p-6 ${className}`}>{children}</div>;
};

interface PortalCardTitleProps {
  children: React.ReactNode;
  className?: string;
}

export const PortalCardTitle: React.FC<PortalCardTitleProps> = ({
  children,
  className = "",
}) => {
  return (
    <h2 className={`text-lg font-bold text-foreground ${className}`}>{children}</h2>
  );
};
