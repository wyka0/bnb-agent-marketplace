/**
 * @bnb-marketplace/telemetry — structured logging, tracing placeholders,
 * and performance timing helpers shared across apps and packages.
 */

export { createLogger, Logger } from "./logger.js";
export type { LoggerOptions, LogLevel } from "./logger.js";
export { getTracer, setTracer, isOtelEnabled, isOtelActive } from "./otel.js";
export type { TracerLike, SpanLike, ErrorRecord } from "./otel.js";
export { withTiming, timedSync, slowThresholdReporter, composeReporters } from "./performance.js";
export type { TimerReport, TimerReporter } from "./performance.js";
