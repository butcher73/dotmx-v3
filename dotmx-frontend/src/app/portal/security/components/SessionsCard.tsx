import {
  Globe,
  Loader2,
  ChevronLeft,
  ChevronRight,
  Clock,
  MapPin,
} from "lucide-react";
import {
  PortalCard,
  PortalCardHeader,
  PortalCardTitle,
  PortalCardContent,
} from "@/components/ui";
import type { Session } from "@/services/ApiClient";

interface SessionsCardProps {
  sessions: Session[];
  isLoading: boolean;
  sessionsPage: number;
  sessionsPerPage: number;
  getDeviceInfo: (userAgent: string | undefined) => {
    type: string;
    browser: string;
    os: string;
    icon: React.ComponentType<{ className?: string }>;
  };
  onSetSessionsPage: (page: number) => void;
  onRevokeSession: (sessionId: string) => void;
}

export function SessionsCard({
  sessions,
  isLoading,
  sessionsPage,
  sessionsPerPage,
  getDeviceInfo,
  onSetSessionsPage,
  onRevokeSession,
}: SessionsCardProps) {
  return (
    <PortalCard className="border-zinc-800/50 bg-linear-to-br from-zinc-900 to-zinc-900/80">
      <PortalCardHeader>
        <PortalCardTitle className="flex items-center gap-2">
          <Globe className="h-5 w-5 text-cyan-400" />
          Active Sessions
          {!isLoading && (
            <span className="ml-auto rounded-full bg-cyan-500/10 px-2.5 py-0.5 text-xs font-bold text-cyan-400 ring-1 ring-cyan-500/20">
              {sessions.length} active
            </span>
          )}
        </PortalCardTitle>
      </PortalCardHeader>
      <PortalCardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-zinc-500" />
          </div>
        ) : sessions.length === 0 ? (
          <div className="rounded-lg border border-zinc-800/50 bg-zinc-900/50 py-12 text-center">
            <Globe className="mx-auto mb-3 h-12 w-12 text-zinc-600" />
            <div className="text-sm text-zinc-500">No active sessions</div>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {sessions
                .slice(
                  (sessionsPage - 1) * sessionsPerPage,
                  sessionsPage * sessionsPerPage
                )
                .map((session) => {
                  const deviceInfo = getDeviceInfo(session.user_agent);
                  const DeviceIcon = deviceInfo.icon;
                  const lastActive = new Date(session.last_activity_at);
                  const isRecent =
                    Date.now() - lastActive.getTime() < 5 * 60 * 1000;

                  return (
                    <div
                      key={session.id}
                      className={`group relative overflow-hidden rounded-xl border p-4 transition-all ${
                        session.is_current
                          ? "border-emerald-500/30 bg-linear-to-br from-emerald-500/5 to-emerald-500/0"
                          : "border-zinc-800/50 bg-zinc-900/50 hover:border-zinc-700/50"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex gap-4">
                          <div
                            className={`flex h-14 w-14 items-center justify-center rounded-2xl ${
                              session.is_current
                                ? "bg-emerald-500/10 ring-2 ring-emerald-500/30"
                                : "bg-zinc-800/50"
                            }`}
                          >
                            <DeviceIcon
                              className={`h-7 w-7 ${session.is_current ? "text-emerald-400" : "text-zinc-400"}`}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="mb-1 flex items-center gap-2">
                              <span className="font-semibold text-white">
                                {deviceInfo.browser}
                              </span>
                              {session.is_current && (
                                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-bold text-emerald-400">
                                  Current
                                </span>
                              )}
                              {!session.is_current && isRecent && (
                                <div className="flex items-center gap-1">
                                  <div className="h-2 w-2 animate-pulse rounded-full bg-green-400" />
                                  <span className="text-xs text-green-400">
                                    Active now
                                  </span>
                                </div>
                              )}
                            </div>
                            <div className="mb-2 text-sm text-zinc-400">
                              {deviceInfo.os}
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
                              <div className="flex items-center gap-1.5">
                                <MapPin className="h-3.5 w-3.5" />
                                {session.ip_address}
                              </div>
                              <div className="flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5" />
                                {lastActive.toLocaleString("en-US", {
                                  month: "short",
                                  day: "numeric",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </div>
                            </div>
                          </div>
                        </div>
                        {!session.is_current && (
                          <button
                            onClick={() => onRevokeSession(session.id)}
                            className="shrink-0 rounded-lg bg-red-500/10 px-3 py-2 text-sm font-medium text-red-400 ring-1 ring-red-500/20 transition-all hover:bg-red-500/20 hover:ring-red-500/30"
                          >
                            Revoke
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>

            {sessions.length > sessionsPerPage && (
              <div className="mt-4 flex items-center justify-between">
                <div className="text-sm text-zinc-500">
                  Showing {(sessionsPage - 1) * sessionsPerPage + 1}-
                  {Math.min(sessionsPage * sessionsPerPage, sessions.length)} of{" "}
                  {sessions.length}
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() =>
                      onSetSessionsPage(Math.max(1, sessionsPage - 1))
                    }
                    disabled={sessionsPage === 1}
                    className="rounded-lg bg-zinc-800 p-2 text-zinc-400 hover:text-white disabled:opacity-50"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() =>
                      onSetSessionsPage(
                        Math.min(
                          Math.ceil(sessions.length / sessionsPerPage),
                          sessionsPage + 1
                        )
                      )
                    }
                    disabled={
                      sessionsPage >=
                      Math.ceil(sessions.length / sessionsPerPage)
                    }
                    className="rounded-lg bg-zinc-800 p-2 text-zinc-400 hover:text-white disabled:opacity-50"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </PortalCardContent>
    </PortalCard>
  );
}
