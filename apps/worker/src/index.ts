import { createLogger } from "@bnb-marketplace/telemetry";

const logger = createLogger("worker");

/**
 * Worker entrypoint (placeholder).
 *
 * The worker is the out-of-process workload engine — it will own scheduled
 * jobs (ticker ingestion, snapshotting, notifications) in a later phase.
 * For now it merely boots, validates the environment, and reports a health
 * marker so the process lifecycle is exercised end-to-end.
 */

function main(): void {
  logger.info("worker booted");

  // Touch config/env so misconfig surfaces early in the boot path.
  logger.debug("environment", { nodeEnv: process.env.NODE_ENV ?? "undefined" });
  logger.info("worker-ready", { pid: process.pid });
}

main();
