/**
 * Minimal, dependency-light structured logger.
 *
 * Designed as a thin constitutional layer so that logs have a consistent,
 * serializable shape everywhere without tying the monorepo to a specific
 * logging library. Swap the sink later without changing call sites.
 */

import { env } from "@bnb-marketplace/config";

type LogLevel = "trace" | "debug" | "info" | "warn" | "error" | "fatal";

const LEVELS: Record<LogLevel, number> = {
  trace: 0,
  debug: 1,
  info: 2,
  warn: 3,
  error: 4,
  fatal: 5,
};

const DEFAULT_LEVEL: LogLevel = "info";

export interface LoggerOptions {
  name: string;
  level?: LogLevel;
}

interface LogRecord {
  ts: string;
  level: LogLevel;
  name: string;
  msg?: unknown;
  traceId?: string;
  [key: string]: unknown;
}

function resolveLevel(name: string, level?: LogLevel): LogLevel {
  if (level) return level;
  const fromEnv = env?.LOG_LEVEL as LogLevel | undefined;
  return fromEnv && fromEnv in LEVELS ? fromEnv : DEFAULT_LEVEL;
}

function createSerializer(): (value: unknown, seen?: Set<unknown>) => unknown {
  return function serialize(value: unknown, seen = new Set()): unknown {
    if (value === null || typeof value !== "object") return value;
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    if (value instanceof Error) {
      return { message: value.message, stack: value.stack, name: value.name };
    }
    if (Array.isArray(value)) {
      return value.map((item) => serialize(item, seen));
    }
    const result: Record<string, unknown> = {};
    for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
      result[key] = serialize(item, seen);
    }
    return result;
  };
}

const serialize = createSerializer();

export class Logger {
  readonly name: string;
  private readonly level: LogLevel;

  constructor(options: LoggerOptions) {
    this.name = options.name;
    this.level = resolveLevel(options.name, options.level);
  }

  private allowed(level: LogLevel): boolean {
    return LEVELS[level] >= LEVELS[this.level];
  }

  private emit(level: LogLevel, msg: unknown, extras?: Record<string, unknown>): void {
    if (!this.allowed(level)) return;

    const record: LogRecord = {
      ts: new Date().toISOString(),
      level,
      name: this.name,
      ...(msg ? { msg: typeof msg === "string" ? msg : serialize(msg) } : {}),
    };
    if (extras) for (const [k, v] of Object.entries(extras)) record[k] = serialize(v);

    const line = JSON.stringify(record);
    if (level === "error" || level === "fatal") {
      console.error(line);
    } else {
      console.log(line);
    }
  }

  trace(msg: string, extras?: Record<string, unknown>): void {
    this.emit("trace", msg, extras);
  }
  debug(msg: string, extras?: Record<string, unknown>): void {
    this.emit("debug", msg, extras);
  }
  info(msg: string, extras?: Record<string, unknown>): void {
    this.emit("info", msg, extras);
  }
  warn(msg: string, extras?: Record<string, unknown>): void {
    this.emit("warn", msg, extras);
  }
  error(msg: string, extras?: Record<string, unknown>): void {
    this.emit("error", msg, extras);
  }
  fatal(msg: string, extras?: Record<string, unknown>): void {
    this.emit("fatal", msg, extras);
  }

  child(name: string): Logger {
    return new Logger({ name: `${this.name}:${name}`, level: this.level });
  }
}

export function createLogger(name: string, level?: LogLevel): Logger {
  return new Logger({ name, level });
}

export type { LogLevel };
