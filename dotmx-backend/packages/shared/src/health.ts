/**
 * Health Check Utilities
 *
 * Standard health check endpoints and dependency checks.
 */

export interface HealthCheck {
  name: string;
  check: () => Promise<HealthStatus>;
}

export interface HealthStatus {
  status: "healthy" | "degraded" | "unhealthy";
  message?: string;
  latencyMs?: number;
  details?: Record<string, unknown>;
}

export interface HealthReport {
  status: "healthy" | "degraded" | "unhealthy";
  timestamp: string;
  uptime: number;
  version: string;
  checks: Record<string, HealthStatus>;
}

/**
 * Create health check manager
 */
export interface HealthCheckManager {
  register(name: string, check: () => Promise<HealthStatus>): void;
  check(): Promise<HealthReport>;
  isHealthy(): Promise<boolean>;
}

export function createHealthCheckManager(version: string = "1.0.0"): HealthCheckManager {
  const checks = new Map<string, () => Promise<HealthStatus>>();
  const startTime = Date.now();

  return {
    register(name: string, check: () => Promise<HealthStatus>): void {
      checks.set(name, check);
    },

    async check(): Promise<HealthReport> {
      const results: Record<string, HealthStatus> = {};
      let overallStatus: "healthy" | "degraded" | "unhealthy" = "healthy";

      await Promise.all(
        Array.from(checks.entries()).map(async ([name, checkFn]) => {
          try {
            const start = performance.now();
            const status = await checkFn();
            status.latencyMs = performance.now() - start;
            results[name] = status;

            if (status.status === "unhealthy") {
              overallStatus = "unhealthy";
            } else if (status.status === "degraded" && overallStatus === "healthy") {
              overallStatus = "degraded";
            }
          } catch (error) {
            results[name] = {
              status: "unhealthy",
              message: error instanceof Error ? error.message : String(error),
            };
            overallStatus = "unhealthy";
          }
        })
      );

      return {
        status: overallStatus,
        timestamp: new Date().toISOString(),
        uptime: Date.now() - startTime,
        version,
        checks: results,
      };
    },

    async isHealthy(): Promise<boolean> {
      const report = await this.check();
      return report.status === "healthy";
    },
  };
}

// =============================================================================
// PRE-BUILT HEALTH CHECKS
// =============================================================================

/**
 * NATS health check
 */
export function createNatsHealthCheck(getConnection: () => any): () => Promise<HealthStatus> {
  return async () => {
    try {
      const nc = getConnection();
      if (!nc) {
        return { status: "unhealthy", message: "Not connected" };
      }

      // NATS connection status
      const status = nc.status();
      if (status === "connected") {
        return { status: "healthy" };
      } else if (status === "reconnecting") {
        return { status: "degraded", message: "Reconnecting" };
      } else {
        return { status: "unhealthy", message: `Status: ${status}` };
      }
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

/**
 * Redis health check
 */
export function createRedisHealthCheck(getClient: () => any): () => Promise<HealthStatus> {
  return async () => {
    try {
      const client = getClient();
      if (!client) {
        return { status: "unhealthy", message: "Not connected" };
      }

      await client.ping();
      return { status: "healthy" };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

/**
 * PostgreSQL health check
 */
export function createPostgresHealthCheck(getPool: () => any): () => Promise<HealthStatus> {
  return async () => {
    try {
      const pool = getPool();
      if (!pool) {
        return { status: "unhealthy", message: "Not connected" };
      }

      const result = await pool.query("SELECT 1");
      return { status: "healthy", details: { poolSize: pool.totalCount } };
    } catch (error) {
      return {
        status: "unhealthy",
        message: error instanceof Error ? error.message : String(error),
      };
    }
  };
}

/**
 * Memory health check
 */
export function createMemoryHealthCheck(thresholdMb: number = 1024): () => Promise<HealthStatus> {
  return async () => {
    const used = process.memoryUsage();
    const heapUsedMb = used.heapUsed / 1024 / 1024;

    if (heapUsedMb > thresholdMb) {
      return {
        status: "degraded",
        message: `High memory usage: ${heapUsedMb.toFixed(0)}MB`,
        details: {
          heapUsedMb: heapUsedMb.toFixed(2),
          heapTotalMb: (used.heapTotal / 1024 / 1024).toFixed(2),
          rssMb: (used.rss / 1024 / 1024).toFixed(2),
        },
      };
    }

    return {
      status: "healthy",
      details: {
        heapUsedMb: heapUsedMb.toFixed(2),
        heapTotalMb: (used.heapTotal / 1024 / 1024).toFixed(2),
      },
    };
  };
}

/**
 * Disk space health check (simple file system check)
 */
export function createDiskHealthCheck(path: string): () => Promise<HealthStatus> {
  return async () => {
    try {
      const { statfs } = await import("fs/promises");
      const stats = await statfs(path);

      const totalBytes = stats.blocks * stats.bsize;
      const freeBytes = stats.bfree * stats.bsize;
      const usedPercent = ((totalBytes - freeBytes) / totalBytes) * 100;

      if (usedPercent > 90) {
        return {
          status: "unhealthy",
          message: `Disk usage critical: ${usedPercent.toFixed(1)}%`,
        };
      } else if (usedPercent > 80) {
        return {
          status: "degraded",
          message: `Disk usage high: ${usedPercent.toFixed(1)}%`,
        };
      }

      return {
        status: "healthy",
        details: {
          usedPercent: usedPercent.toFixed(1),
          freeGb: (freeBytes / 1024 / 1024 / 1024).toFixed(2),
        },
      };
    } catch {
      return { status: "healthy" }; // Skip if not available
    }
  };
}
