"use client";

interface PortfolioHeaderProps {
  mounted: boolean;
}

export function PortfolioHeader({ mounted }: PortfolioHeaderProps) {
  if (!mounted) return null;

  return (
    <div className="mb-5">
      <h1 className="text-foreground mb-1 text-2xl font-bold">Portfolio</h1>
      <p className="text-foreground-muted text-sm">
        Manage your positions and track your trading performance
      </p>
    </div>
  );
}
