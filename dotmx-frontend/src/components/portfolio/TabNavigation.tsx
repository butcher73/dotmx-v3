"use client";

interface TabNavigationProps {
  tabs: string[];
  activeTab: string;
  setActiveTab: (tab: string) => void;
}

export function TabNavigation({
  tabs,
  activeTab,
  setActiveTab,
}: TabNavigationProps) {
  return (
    <div className="relative">
      <div className="flex gap-1 overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`rounded px-4 py-2 text-xs font-medium whitespace-nowrap transition-colors ${
              activeTab === tab
                ? "bg-accent text-foreground"
                : "bg-background-card text-foreground-subtle hover:text-foreground"
            }`}
            style={activeTab !== tab ? { border: "1px solid #333" } : undefined}
          >
            {tab}
          </button>
        ))}
      </div>
    </div>
  );
}
