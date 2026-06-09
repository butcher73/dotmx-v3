import { PortalCard, PortalCardContent } from "@/components/ui";

const announcements = [
  {
    id: 1,
    text: "DotMX to list pre-market futures for SCR crypto",
    date: "10/09/2024",
  },
  {
    id: 2,
    text: "DotMX to support new USDC spot trading pairs",
    date: "10/09/2024",
  },
  {
    id: 3,
    text: "DotMX to list perpetual futures for MOODENG, NEIRO crypto",
    date: "10/09/2024",
  },
  {
    id: 4,
    text: "DotMX to delist several margin trading pairs and perpetual futures",
    date: "10/02/2024",
  },
];

export function AnnouncementsSection() {
  return (
    <PortalCard>
      <PortalCardContent>
        <h3 className="text-foreground mb-6 text-lg font-semibold">
          Announcements
        </h3>
        <div className="space-y-4">
          {announcements.map((announcement) => (
            <div
              key={announcement.id}
              className="border-border border-b pb-4 last:border-0"
            >
              <p className="text-foreground-muted mb-1.5 text-xs">
                {announcement.date}
              </p>
              <p className="text-foreground text-sm leading-relaxed">
                {announcement.text}
              </p>
            </div>
          ))}
        </div>
        <button className="text-foreground-muted border-border hover:border-primary hover:text-primary mt-6 w-full rounded-lg border py-2.5 text-sm font-medium transition-colors">
          View more
        </button>
      </PortalCardContent>
    </PortalCard>
  );
}
