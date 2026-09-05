/**
 * OpenTelemetry placeholder.
 *
 * Intended to be wired to the real OpenTelemetry SDK once real tracing needs
 * emerge. For the foundation phase this exposes a no-op, stable interface so
 * downstream code can adopt the correct tracing API (tracer, span, attributes)
 * today and swap in a real SDK later without breaking call sites.
 */

import { env } from "@bnb-marketplace/config";

export interface ErrorRecord {
  message: string;
  code?: string;
}

export interface SpanLike {
  setAttribute(key: string, value: unknown): void;
  addAttributes(attributes: Record<string, unknown>): void;
  addEvent(name: string, attributes?: Record<string, unknown>): void;
  setStatus(status: boolean): void;
  setError(input: ErrorRecord): void;
  end(): void;
}

export interface TracerLike {
  startSpan(name: string, options?: Record<string, unknown>): SpanLike;
}

class NoopSpan implements SpanLike {
  setAttribute(): void {}
  addAttributes(): void {}
  addEvent(): void {}
  setStatus(): void {}
  setError(): void {}
  end(): void {}
}

class NoopTracer implements TracerLike {
  private static readonly span: SpanLike = new NoopSpan();
  startSpan(): SpanLike {
    return NoopTracer.span;
  }
}

function isOtelEnabled(): boolean {
  return Boolean(env?.OTEL_EXPORTER_OTLP_ENDPOINT);
}

let tracer: TracerLike = new NoopTracer();
let enabled = isOtelEnabled();

/** Returns the active tracer (a no-op until a real SDK is registered). */
export function getTracer(): TracerLike {
  return tracer;
}

/** Registers a real tracer implementation (e.g. the OTel SDK). */
export function setTracer(implementation: TracerLike): void {
  tracer = implementation;
  enabled = true;
}

/** Reflects whether a real OTel exporter/tracer is currently wired. */
export function isOtelActive(): boolean {
  return enabled;
}

export { isOtelEnabled };
