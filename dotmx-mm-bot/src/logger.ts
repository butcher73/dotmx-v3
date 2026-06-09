/**
 * Logger
 *
 * Structured logging with levels and context tags.
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type Level = keyof typeof LEVELS;

const LOG_LEVEL: Level = (process.env.LOG_LEVEL as Level) || "info";

function shouldLog(level: Level): boolean {
  return LEVELS[level] >= LEVELS[LOG_LEVEL];
}

function timestamp(): string {
  return new Date().toISOString().replace("T", " ").substring(0, 23);
}

function format(level: Level, tag: string, message: string): string {
  const prefix = {
    debug: "🔍",
    info: "ℹ️ ",
    warn: "⚠️ ",
    error: "❌",
  }[level];
  return `${timestamp()} ${prefix} [${tag}] ${message}`;
}

export const log = {
  debug(tag: string, msg: string) {
    if (shouldLog("debug")) console.log(format("debug", tag, msg));
  },
  info(tag: string, msg: string) {
    if (shouldLog("info")) console.log(format("info", tag, msg));
  },
  warn(tag: string, msg: string) {
    if (shouldLog("warn")) console.warn(format("warn", tag, msg));
  },
  error(tag: string, msg: string) {
    if (shouldLog("error")) console.error(format("error", tag, msg));
  },
};
