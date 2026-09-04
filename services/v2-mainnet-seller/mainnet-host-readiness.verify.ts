/**
 * X.235-P1 — Mainnet seller host readiness check (READ-ONLY).
 *
 * Usage:
 *   MAINNET_AGENT_URL=https://seller.example.com node mainnet-host-readiness.verify.ts
 *
 * Performs an HTTP GET /health probe only. ZERO writes, ZERO deployments,
 * ZERO server starts, ZERO modifications to the Testnet seller. If
 * MAINNET_AGENT_URL is missing or a placeholder, returns a clean BLOCKED result.
 * Rejects http:// endpoints (HTTPS required).
 */

const AGENT_URL = process.env.MAINNET_AGENT_URL ?? "";

const PLACEHOLDER_PATTERNS = [/placeholder/i, /example\.com/i, /your-domain/i, /<.*>/, /changeme/i];

interface HostReadiness {
  url: string;
  https: boolean;
  reachable: boolean;
  httpStatus: number | null;
  responseTimeMs: number | null;
  healthPayload: string | null;
  ready: boolean;
  blockers: string[];
}

async function main(): Promise<void> {
  console.log("=== MAINNET SELLER HOST READINESS CHECK (READ-ONLY) ===\n");

  const result: HostReadiness = {
    url: AGENT_URL,
    https: false,
    reachable: false,
    httpStatus: null,
    responseTimeMs: null,
    healthPayload: null,
    ready: false,
    blockers: [],
  };

  if (!AGENT_URL) {
    console.log("MAINNET HOST: BLOCKED — endpoint not provided.");
    console.log("\nSet MAINNET_AGENT_URL to the durable HTTPS root URL of the mainnet seller.");
    process.exit(0);
  }

  // Placeholder check
  const isPlaceholder = PLACEHOLDER_PATTERNS.some((p) => p.test(AGENT_URL));
  if (isPlaceholder) {
    console.log(`MAINNET HOST: BLOCKED — placeholder endpoint (${AGENT_URL}).`);
    console.log("\nProvide a real, durable HTTPS URL for the mainnet seller.");
    process.exit(0);
  }

  console.log(`URL: ${AGENT_URL}`);

  // HTTPS check
  if (!AGENT_URL.startsWith("https://")) {
    console.log("HTTPS: FAIL — endpoint must use https:// (http:// rejected)");
    console.log("\nMAINNET HOST: BLOCKED — non-HTTPS endpoint.");
    process.exit(0);
  }
  result.https = true;
  console.log("HTTPS: PASS");

  // GET /health probe
  const healthUrl = `${AGENT_URL.replace(/\/+$/, "")}/health`;
  const startTime = Date.now();
  try {
    const res = await fetch(healthUrl, {
      method: "GET",
      signal: AbortSignal.timeout(15_000),
    });
    result.responseTimeMs = Date.now() - startTime;
    result.httpStatus = res.status;
    result.reachable = true;
    const text = await res.text();
    result.healthPayload = text.slice(0, 200);
    console.log(`GET /health: HTTP ${res.status} (${result.responseTimeMs}ms)`);
    console.log(`  payload: ${result.healthPayload}`);

    if (res.status !== 200) {
      result.blockers.push(`GET /health returned ${res.status}, expected 200`);
    }
    // Check for a chainId in the payload
    try {
      const json = JSON.parse(text) as { chainId?: number; chain?: number };
      const chain = json.chainId ?? json.chain;
      if (chain !== undefined) {
        console.log(`  chain: ${chain}${chain === 56 ? " (PASS)" : " (NOT 56 — FAIL)"}`);
        if (chain !== 56) result.blockers.push(`health reports chain ${chain}, not 56`);
      } else {
        console.log("  chain: not reported in health payload");
        result.blockers.push("health payload does not report chainId");
      }
    } catch {
      console.log("  chain: health payload is not JSON");
      result.blockers.push("health payload is not JSON");
    }
  } catch (e) {
    result.responseTimeMs = Date.now() - startTime;
    console.log(`GET /health: UNREACHABLE (${e instanceof Error ? e.message : "unknown error"})`);
    result.blockers.push("host is unreachable");
  }

  // Final readiness
  result.ready = result.blockers.length === 0;
  if (result.ready) {
    console.log("\nMAINNET HOST: READY — HTTPS endpoint with healthy /health reporting chain 56.");
  } else {
    console.log("\nMAINNET HOST: BLOCKED");
    for (const b of result.blockers) console.log(`  — ${b}`);
  }
  process.exit(0);
}

void main();
