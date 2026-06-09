/**
 * Logging Infrastructure
 *
 * Structured logging with levels, correlation IDs, and request tracing.
 */

export type LogLevel = "debug" | "info" | "warn" | "error" | "fatal";

export interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  correlationId?: string;
  service?: string;
  component?: string;
  [key: string]: unknown;
}

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void;
  info(message: string, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  error(message: string, meta?: Record<string, unknown>): void;
  fatal(message: string, meta?: Record<string, unknown>): void;
  child(meta: Record<string, unknown>): Logger;
  setLevel(level: LogLevel): void;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  fatal: 4,
};

export interface LoggerConfig {
  level?: LogLevel;
  service?: string;
  pretty?: boolean;
  output?: (entry: LogEntry) => void;
}

/**
 * Create a structured logger
 */
export function createLogger(config: LoggerConfig = {}): Logger {
  let currentLevel = LOG_LEVELS[config.level ?? "info"];
  const service = config.service ?? "dotmx";
  const pretty = config.pretty ?? process.env.NODE_ENV !== "production";
  const output = config.output ?? defaultOutput;

  function defaultOutput(entry: LogEntry): void {
    if (pretty) {
      const levelColors: Record<LogLevel, string> = {
        debug: "\x1b[90m",
        info: "\x1b[36m",
        warn: "\x1b[33m",
        error: "\x1b[31m",
        fatal: "\x1b[35m",
      };
      const reset = "\x1b[0m";
      const color = levelColors[entry.level];
      const time = entry.timestamp.split("T")[1].split(".")[0];

      // Create a copy for metadata display without log-specific fields
      const { level: _level, message: _message, timestamp: _timestamp, service: _service, ...meta } = entry;

      const metaStr = Object.keys(meta).length > 0 ? ` ${JSON.stringify(meta)}` : "";

      console.log(`${color}[${time}] ${entry.level.toUpperCase().padEnd(5)}${reset} ${entry.message}${metaStr}`);
    } else {
      console.log(JSON.stringify(entry));
    }
  }

  function log(level: LogLevel, message: string, meta: Record<string, unknown> = {}): void {
    if (LOG_LEVELS[level] < currentLevel) return;

    const entry: LogEntry = {
      level,
      message,
      timestamp: new Date().toISOString(),
      service,
      ...meta,
    };

    output(entry);
  }

  const logger: Logger = {
    debug: (msg, meta) => log("debug", msg, meta),
    info: (msg, meta) => log("info", msg, meta),
    warn: (msg, meta) => log("warn", msg, meta),
    error: (msg, meta) => log("error", msg, meta),
    fatal: (msg, meta) => log("fatal", msg, meta),

    child(childMeta: Record<string, unknown>): Logger {
      return createLogger({
        ...config,
        output: (entry) => output({ ...entry, ...childMeta }),
      });
    },

    setLevel(level: LogLevel): void {
      currentLevel = LOG_LEVELS[level];
    },
  };

  return logger;
}

/**
 * Correlation ID management
 */
let currentCorrelationId: string | undefined;

export function setCorrelationId(id: string): void {
  currentCorrelationId = id;
}

export function getCorrelationId(): string | undefined {
  return currentCorrelationId;
}

export function generateCorrelationId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Request logger middleware factory
 */
export function createRequestLogger(logger: Logger) {
  return (handler: (ctx: any) => Promise<any>) => async (ctx: any) => {
    const correlationId = ctx.headers?.["x-correlation-id"] ?? generateCorrelationId();
    const start = performance.now();

    setCorrelationId(correlationId);

    logger.info("Request started", {
      correlationId,
      method: ctx.request?.method,
      path: ctx.path,
    });

    try {
      const result = await handler(ctx);
      const duration = performance.now() - start;

      logger.info("Request completed", {
        correlationId,
        method: ctx.request?.method,
        path: ctx.path,
        status: ctx.set?.status ?? 200,
        durationMs: duration.toFixed(2),
      });

      return result;
    } catch (error) {
      const duration = performance.now() - start;

      logger.error("Request failed", {
        correlationId,
        method: ctx.request?.method,
        path: ctx.path,
        error: error instanceof Error ? error.message : String(error),
        durationMs: duration.toFixed(2),
      });

      throw error;
    }
  };
}

// Global default logger
export const log = createLogger();
