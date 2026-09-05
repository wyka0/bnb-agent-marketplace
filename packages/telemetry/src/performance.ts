/**
 * Performance monitoring utilities.
 *
 * Lightweight timing helpers that measure the duration of named operations
 * and route reports to registered reporters. Reporters can be wired to
 * browser PerfObserver (web) or APM (worker) later without changing consumers.
 */

export interface TimerReport {
  name: string;
  durationMs: number;
  startedAt: number;
}

export type TimerReporter = (report: TimerReport) => void;

const noopReporter: TimerReporter = () => {};

/** Time an asynchronous function. */
export async function withTiming<T>(
  name: string,
  fn: () => Promise<T>,
  reporter: TimerReporter = noopReporter
): Promise<T> {
  const startedAt = performance.now();
  try {
    const result = await fn();
    reporter({ name, durationMs: performance.now() - startedAt, startedAt });
    return result;
  } catch (error) {
    reporter({ name, durationMs: performance.now() - startedAt, startedAt });
    throw error;
  }
}

/** Time a synchronous function. */
export function timedSync<T>(name: string, fn: () => T, reporter: TimerReporter = noopReporter): T {
  const startedAt = performance.now();
  try {
    const result = fn();
    reporter({ name, durationMs: performance.now() - startedAt, startedAt });
    return result;
  } catch (error) {
    reporter({ name, durationMs: performance.now() - startedAt, startedAt });
    throw error;
  }
}

/** Builds a reporter that flags slow (> baseline) operations. */
export function slowThresholdReporter(
  baseline: number,
  onSlow: (report: TimerReport) => void
): TimerReporter {
  return (report) => {
    if (report.durationMs > baseline) onSlow(report);
  };
}

/** Compose multiple reporters into one. */
export function composeReporters(reporters: TimerReporter[]): TimerReporter {
  return (report) => {
    for (const reporter of reporters) reporter({ ...report });
  };
}
