import { useState, useEffect } from "react";
import { apiClient, type Session } from "@/services/ApiClient";

export function useSessions(isAuthenticated: boolean) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);
  const [sessionsPage, setSessionsPage] = useState(1);
  const sessionsPerPage = 5;

  // Load sessions
  useEffect(() => {
    if (!isAuthenticated) return;
    const loadSessions = async () => {
      try {
        const data = await apiClient.getSessions();
        setSessions(data.filter((s) => !s.revoked));
      } catch (error) {
        console.error("Failed to load sessions:", error);
      } finally {
        setIsLoadingSessions(false);
      }
    };
    loadSessions();
  }, [isAuthenticated]);

  const handleRevokeSession = async (sessionId: string) => {
    try {
      await apiClient.revokeSession(sessionId);
      setSessions((prev) => prev.filter((s) => s.id !== sessionId));
    } catch (error) {
      console.error("Failed to revoke session:", error);
    }
  };

  return {
    sessions,
    isLoadingSessions,
    sessionsPage,
    sessionsPerPage,
    setSessionsPage,
    handleRevokeSession,
  };
}
