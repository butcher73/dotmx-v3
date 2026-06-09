import { ReactNode } from "react";

interface PortalPageLayoutProps {
  children: ReactNode;
}

interface PortalPageHeaderProps {
  title: string;
  description?: string;
  action?: ReactNode;
}

export function PortalPageLayout({ children }: PortalPageLayoutProps) {
  return (
    <div className="bg-background">
      <div className="container mx-auto px-4 py-6">{children}</div>
    </div>
  );
}

export function PortalPageHeader({
  title,
  description,
  action,
}: PortalPageHeaderProps) {
  return (
    <div className="mb-6 flex items-center justify-between">
      <div>
        <h1 className="text-foreground mb-1 text-xl font-bold">{title}</h1>
        {description && (
          <p className="text-foreground-muted text-sm">{description}</p>
        )}
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
