"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Header, Footer } from "@/components/common";
import {
  LayoutDashboard,
  PieChart,
  History,
  User,
  Wallet,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  LineChart,
  Gift,
  Shield,
  Bell,
  Users,
  Key,
  HelpCircle,
  FileText,
} from "lucide-react";

interface PortalLayoutProps {
  children: React.ReactNode;
}

export default function PortalLayout({ children }: PortalLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [accountExpanded, setAccountExpanded] = useState(false);
  const pathname = usePathname();

  const navigation = [
    // Main
    {
      name: "Dashboard",
      href: "/portal",
      icon: LayoutDashboard,
      section: "main",
    },
    { name: "Assets", href: "/portal/assets", icon: Wallet, section: "main" },
    {
      name: "Portfolio",
      href: "/portal/portfolio",
      icon: PieChart,
      section: "main",
    },
    { name: "Orders", href: "/portal/orders", icon: FileText, section: "main" },
    {
      name: "Transactions",
      href: "/portal/transactions",
      icon: History,
      section: "main",
    },
    // Analytics
    {
      name: "Analytics",
      href: "/portal/analytics",
      icon: LineChart,
      section: "analytics",
    },
    // Rewards
    {
      name: "Rewards",
      href: "/portal/rewards",
      icon: Gift,
      section: "rewards",
    },
    {
      name: "Referral",
      href: "/portal/referral",
      icon: Users,
      section: "rewards",
    },
    // Account
    {
      name: "Profile",
      href: "/portal/profile",
      icon: User,
      section: "account",
    },
    {
      name: "Security",
      href: "/portal/security",
      icon: Shield,
      section: "account",
    },
    {
      name: "API Keys",
      href: "/portal/api-keys",
      icon: Key,
      section: "account",
    },
    {
      name: "Notifications",
      href: "/portal/notifications",
      icon: Bell,
      section: "account",
    },
    // Support
    {
      name: "Help Center",
      href: "/docs",
      icon: HelpCircle,
      section: "support",
    },
  ];

  const isActive = (href: string) => {
    if (href === "/portal") return pathname === "/portal";
    return pathname?.startsWith(href);
  };

  return (
    <div className="bg-background text-foreground min-h-screen">
      <Header />

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside
          className={`bg-background-card border-border-muted hidden border-r transition-all duration-300 md:block ${
            sidebarOpen ? "w-64" : "w-20"
          }`}
          style={{ minHeight: "calc(100vh - 64px)" }}
        >
          <div className="sticky top-0 flex h-full flex-col overflow-hidden">
            {/* Header with Collapse button */}
            <div className="border-border-muted flex items-center justify-between border-b px-4 py-4">
              {sidebarOpen && (
                <div className="flex items-center gap-3">
                  <div className="from-accent/20 to-accent/10 flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br">
                    <div className="bg-accent h-3 w-3 rounded-full" />
                  </div>
                  <span className="text-sm font-semibold tracking-tight">
                    Menu
                  </span>
                </div>
              )}
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="text-foreground-muted hover:text-foreground hover:bg-background-elevated flex items-center justify-center rounded-lg p-1.5 transition-all"
              >
                {sidebarOpen ? (
                  <ChevronLeft className="h-4 w-4" />
                ) : (
                  <ChevronRight className="h-4 w-4" />
                )}
              </button>
            </div>

            {/* Navigation */}
            <nav className="flex-1 overflow-y-auto px-3 py-6">
              {/* Main Section */}
              <div className="space-y-1.5">
                {navigation
                  .filter((item) => item.section === "main")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`group relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                        } ${sidebarOpen ? "gap-3" : "justify-center"}`}
                        title={!sidebarOpen ? item.name : undefined}
                      >
                        <Icon
                          className={`h-4.5 w-4.5 shrink-0 stroke-2 transition-all ${
                            active ? "text-accent" : ""
                          }`}
                          strokeWidth={2}
                        />
                        {sidebarOpen && (
                          <span className="flex-1 text-[13px] font-medium tracking-tight">
                            {item.name}
                          </span>
                        )}
                        {active && sidebarOpen && (
                          <div className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
              </div>

              {/* Divider */}
              <div className="bg-border-muted mx-3 my-5 h-px" />

              {/* Analytics */}
              <div className="space-y-1.5">
                {navigation
                  .filter((item) => item.section === "analytics")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`group relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                        } ${sidebarOpen ? "gap-3" : "justify-center"}`}
                        title={!sidebarOpen ? item.name : undefined}
                      >
                        <Icon
                          className={`h-4.5 w-4.5 shrink-0 stroke-2 transition-all ${
                            active ? "text-accent" : ""
                          }`}
                          strokeWidth={2}
                        />
                        {sidebarOpen && (
                          <span className="flex-1 text-[13px] font-medium tracking-tight">
                            {item.name}
                          </span>
                        )}
                        {active && sidebarOpen && (
                          <div className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
              </div>

              {/* Rewards */}
              <div className="space-y-1.5">
                {navigation
                  .filter((item) => item.section === "rewards")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`group relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                        } ${sidebarOpen ? "gap-3" : "justify-center"}`}
                        title={!sidebarOpen ? item.name : undefined}
                      >
                        <Icon
                          className={`h-4.5 w-4.5 shrink-0 stroke-2 transition-all ${
                            active ? "text-accent" : ""
                          }`}
                          strokeWidth={2}
                        />
                        {sidebarOpen && (
                          <span className="flex-1 text-[13px] font-medium tracking-tight">
                            {item.name}
                          </span>
                        )}
                        {active && sidebarOpen && (
                          <div className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
              </div>

              {/* Divider */}
              <div className="bg-border-muted mx-3 my-5 h-px" />

              {/* Account Settings - Collapsible */}
              <div>
                <button
                  onClick={() => setAccountExpanded(!accountExpanded)}
                  className={`text-foreground-subtle hover:text-foreground hover:bg-background-elevated relative flex w-full items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                    sidebarOpen ? "gap-3" : "justify-center"
                  }`}
                  title={!sidebarOpen ? "Account" : undefined}
                >
                  <User
                    className="h-4.5 w-4.5 shrink-0 stroke-2"
                    strokeWidth={2}
                  />
                  {sidebarOpen && (
                    <>
                      <span className="flex-1 text-[13px] font-medium tracking-tight">
                        Account
                      </span>
                      <ChevronRight
                        className={`h-3.5 w-3.5 transition-transform duration-200 ${
                          accountExpanded ? "rotate-90" : ""
                        }`}
                      />
                    </>
                  )}
                </button>

                {/* Nested Account Items */}
                {accountExpanded && sidebarOpen && (
                  <div className="border-border-muted mt-2 ml-3 space-y-1 border-l pl-3">
                    {navigation
                      .filter((item) => item.section === "account")
                      .map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
                              active
                                ? "text-accent"
                                : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 shrink-0 stroke-2 transition-all ${
                                active ? "text-accent" : ""
                              }`}
                              strokeWidth={2}
                            />
                            <span className="flex-1 text-[12px] font-medium tracking-tight">
                              {item.name}
                            </span>
                            {active && (
                              <div className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
                            )}
                          </Link>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Divider */}
              <div className="bg-border-muted mx-3 my-5 h-px" />

              {/* Support */}
              <div className="space-y-1.5">
                {navigation
                  .filter((item) => item.section === "support")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        className={`group relative flex items-center rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                        } ${sidebarOpen ? "gap-3" : "justify-center"}`}
                        title={!sidebarOpen ? item.name : undefined}
                      >
                        <Icon
                          className={`h-4.5 w-4.5 shrink-0 stroke-2 transition-all ${
                            active ? "text-accent" : ""
                          }`}
                          strokeWidth={2}
                        />
                        {sidebarOpen && (
                          <span className="flex-1 text-[13px] font-medium tracking-tight">
                            {item.name}
                          </span>
                        )}
                        {active && sidebarOpen && (
                          <div className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
              </div>
            </nav>
          </div>
        </aside>

        {/* Mobile menu button */}
        <div className="fixed right-4 bottom-4 z-50 md:hidden">
          <button
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            className="bg-accent text-foreground flex h-12 w-12 items-center justify-center rounded-full shadow-md transition-all duration-200 hover:shadow-lg"
          >
            {mobileMenuOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </button>
        </div>

        {/* Mobile sidebar overlay */}
        {mobileMenuOpen && (
          <div
            className="bg-background/80 fixed inset-0 z-40 backdrop-blur-sm md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
        )}

        {/* Mobile sidebar */}
        <aside
          className={`bg-background-card fixed inset-y-0 left-0 z-50 w-72 transform overflow-y-auto shadow-xl transition-transform duration-300 md:hidden ${
            mobileMenuOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          <div className="flex h-full flex-col">
            {/* Mobile Header */}
            <div className="border-border-muted border-b px-4 py-4">
              <div className="flex items-center gap-3">
                <div className="from-accent/20 to-accent/10 flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br">
                  <div className="bg-accent h-3 w-3 rounded-full" />
                </div>
                <span className="text-sm font-semibold tracking-tight">
                  Menu
                </span>
              </div>
            </div>

            <nav className="flex-1 space-y-4 overflow-y-auto px-3 py-6">
              {/* Main Section */}
              <div className="space-y-1.5">
                {navigation
                  .filter((item) => item.section === "main")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                        }`}
                      >
                        <Icon
                          className={`h-4.5 w-4.5 shrink-0 stroke-2 transition-all ${
                            active ? "text-accent" : ""
                          }`}
                          strokeWidth={2}
                        />
                        <span className="flex-1 text-[13px] font-medium tracking-tight">
                          {item.name}
                        </span>
                        {active && (
                          <div className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
              </div>

              <div className="bg-border-muted mx-2 h-px" />

              {/* Analytics */}
              <div className="space-y-1.5">
                {navigation
                  .filter((item) => item.section === "analytics")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                        }`}
                      >
                        <Icon
                          className={`h-4.5 w-4.5 shrink-0 stroke-2 transition-all ${
                            active ? "text-accent" : ""
                          }`}
                          strokeWidth={2}
                        />
                        <span className="flex-1 text-[13px] font-medium tracking-tight">
                          {item.name}
                        </span>
                        {active && (
                          <div className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
              </div>

              {/* Rewards */}
              <div className="space-y-1.5">
                {navigation
                  .filter((item) => item.section === "rewards")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                        }`}
                      >
                        <Icon
                          className={`h-4.5 w-4.5 shrink-0 stroke-2 transition-all ${
                            active ? "text-accent" : ""
                          }`}
                          strokeWidth={2}
                        />
                        <span className="flex-1 text-[13px] font-medium tracking-tight">
                          {item.name}
                        </span>
                        {active && (
                          <div className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
              </div>

              <div className="bg-border-muted mx-2 h-px" />

              {/* Account Settings - Collapsible */}
              <div>
                <button
                  onClick={() => setAccountExpanded(!accountExpanded)}
                  className="text-foreground-subtle hover:text-foreground hover:bg-background-elevated relative flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200"
                >
                  <User
                    className="h-4.5 w-4.5 shrink-0 stroke-2"
                    strokeWidth={2}
                  />
                  <span className="flex-1 text-[13px] font-medium tracking-tight">
                    Account
                  </span>
                  <ChevronRight
                    className={`h-3.5 w-3.5 transition-transform duration-200 ${
                      accountExpanded ? "rotate-90" : ""
                    }`}
                  />
                </button>

                {accountExpanded && (
                  <div className="border-border-muted mt-2 ml-3 space-y-1 border-l pl-3">
                    {navigation
                      .filter((item) => item.section === "account")
                      .map((item) => {
                        const Icon = item.icon;
                        const active = isActive(item.href);
                        return (
                          <Link
                            key={item.name}
                            href={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`group relative flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-all duration-200 ${
                              active
                                ? "text-accent"
                                : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                            }`}
                          >
                            <Icon
                              className={`h-4 w-4 shrink-0 stroke-2 transition-all ${
                                active ? "text-accent" : ""
                              }`}
                              strokeWidth={2}
                            />
                            <span className="flex-1 text-[12px] font-medium tracking-tight">
                              {item.name}
                            </span>
                            {active && (
                              <div className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
                            )}
                          </Link>
                        );
                      })}
                  </div>
                )}
              </div>

              {/* Support */}
              <div className="space-y-1.5">
                {navigation
                  .filter((item) => item.section === "support")
                  .map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.href);
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`group relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200 ${
                          active
                            ? "bg-accent/10 text-accent"
                            : "text-foreground-subtle hover:text-foreground hover:bg-background-elevated"
                        }`}
                      >
                        <Icon
                          className={`h-4.5 w-4.5 shrink-0 stroke-2 transition-all ${
                            active ? "text-accent" : ""
                          }`}
                          strokeWidth={2}
                        />
                        <span className="flex-1 text-[13px] font-medium tracking-tight">
                          {item.name}
                        </span>
                        {active && (
                          <div className="bg-accent h-1.5 w-1.5 shrink-0 rounded-full" />
                        )}
                      </Link>
                    );
                  })}
              </div>
            </nav>
          </div>
        </aside>

        {/* Main content */}
        <main className="flex-1" style={{ minHeight: "calc(100vh - 64px)" }}>
          {children}
        </main>
      </div>

      <Footer />
    </div>
  );
}
