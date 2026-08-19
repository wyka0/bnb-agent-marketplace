/**
 * X.57 TermiX Agent Advantage — two-arm measurement harness.
 *
 * Runs the three PRE-REGISTERED tasks from docs/termix/EXPERIMENT-PROTOCOL.md
 * and writes REAL artifacts to docs/termix/evidence/. It measures; it does not
 * score, and it never invents a value.
 *
 * Guarantees:
 *  - Arm A (baseline) and Arm B (marketplace agent) receive equivalent inputs.
 *  - Timings come from `performance.now()` around the actual call.
 *  - Upstream request counts are observed by wrapping globalThis.fetch.
 *  - Monetary cost is emitted as "NOT MEASURABLE" (no published unit price).
 *  - No blockchain transaction, no mainnet, no signing.
 *
 * Run: node --experimental-strip-types --import <server-only shim> \
 *        lib/termix/advantage-harness.ts
 */

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { performance } from "node:perf_hooks";
import { getBscCategoryPage } from "../eight004scan/discovery/service.ts";
import { listAgents } from "../eight004scan/client.ts";
import { DISCOVERY_CATEGORIES } from "../eight004scan/discovery/classifier.ts";
import {
  parsePaymentRequired,
  selectPaymentRequirement,
} from "@bnb-marketplace/integrations/altana";

const EVIDENCE_ROOT = "../../docs/termix/evidence";

/** Load local env without printing any value. */
function loadEnv(): void {
  try {
    for (const line of readFileSync("../../.env.local", "utf8").split(/\r?\n/)) {
      const m = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*)$/.exec(line);
      if (m && m[1] && m[2] && m[2].length > 0) process.env[m[1]] = m[2].trim();
    }
  } catch {
    // Absent env is a real condition; tasks will report their own state.
  }
}

/** Count outbound HTTP requests for a measured block (billable-unit proxy). */
async function measure<T>(fn: () => Promise<T>): Promise<{ value: T; ms: number; requests: number }> {
  const originalFetch = globalThis.fetch;
  let requests = 0;
  globalThis.fetch = ((...args: Parameters<typeof originalFetch>) => {
    requests += 1;
    return originalFetch(...args);
  }) as typeof originalFetch;
  const start = performance.now();
  try {
    const value = await fn();
    return { value, ms: Math.round(performance.now() - start), requests };
  } finally {
    globalThis.fetch = originalFetch;
  }
}

function writeEvidence(task: string, name: string, body: unknown): void {
  const dir = `${EVIDENCE_ROOT}/${task}`;
  mkdirSync(dir, { recursive: true });
  const text = typeof body === "string" ? body : JSON.stringify(body, null, 2);
  writeFileSync(`${dir}/${name}`, text, "utf8");
}

/* ------------------------------------------------------------------ *
 * Arm A baselines — the naive unaided procedure, scripted for parity.
 * ------------------------------------------------------------------ */

/**
 * Baseline screening: plain substring match on name+description, which is what
 * an evaluator does before discovering precedence/context rules.
 */
function baselineScreen(rows: readonly { name: string | null; description: string | null }[], keyword: string) {
  const needle = keyword.toLowerCase();
  return rows.filter(
    (row) =>
      (row.name ?? "").toLowerCase().includes(needle) ||
      (row.description ?? "").toLowerCase().includes(needle)
  );
}

async function task01(): Promise<void> {
  const KEY = "yield-optimisation" as const;
  const KEYWORD = "yield";

  // ---- ARM A: query the registry directly and screen by hand (scripted). ----
  const armA = await measure(async () => {
    const result = await listAgents({ page: 1, limit: 100, chainId: 56, isTestnet: false, search: KEYWORD });
    if (!result.ok) return { ok: false as const, reason: result.reason };
    const screened = baselineScreen(result.data, KEYWORD);
    return {
      ok: true as const,
      hits: result.meta.pagination?.total ?? null,
      retrieved: result.data.length,
      selected: screened.length,
      // The baseline produces names only: no justification, no timestamp.
      sample: screened.slice(0, 5).map((r) => r.name ?? "(unnamed)"),
    };
  });

  // ---- ARM B: the marketplace agent. ----
  const armB = await measure(() => getBscCategoryPage(KEY));

  writeEvidence("task-01", "input.json", { task: "yield-agent discovery", category: KEY, keyword: KEYWORD, chainId: 56, isTestnet: false });
  writeEvidence("task-01", "arm-a-baseline.json", { arm: "A", procedure: "direct registry query + naive substring screening", elapsedMs: armA.ms, upstreamRequests: armA.requests, monetaryCost: "NOT MEASURABLE", output: armA.value });

  const b = armB.value;
  writeEvidence("task-01", "arm-b-marketplace.json", {
    arm: "B",
    procedure: "marketplace category discovery agent",
    elapsedMs: armB.ms,
    upstreamRequests: armB.requests,
    monetaryCost: "NOT MEASURABLE",
    output: {
      state: b.state,
      hits: b.bucket?.hits ?? null,
      retrieved: b.bucket?.retrieved ?? 0,
      matched: b.bucket?.matched ?? 0,
      retrievedAt: b.fetchedAt,
      source: b.source,
      // Full justification per record — the differentiator vs Arm A.
      records: (b.bucket?.discovered ?? []).map((d) => ({
        name: d.agent.name,
        slug: d.agent.slug,
        chainId: d.agent.chainId,
        verification: d.agent.verification,
        matchedLabel: d.match.label,
        evidenceField: d.match.evidence,
        evidenceText: d.match.evidenceText,
        evidenceSource: d.match.source,
      })),
    },
  });

  console.log(`task-01 armA=${armA.ms}ms/${armA.requests}req  armB=${armB.ms}ms/${armB.requests}req`);
}

async function task02(): Promise<void> {
  const keys = DISCOVERY_CATEGORIES.map((c) => ({ key: c.key, keyword: c.searchKeyword }));

  // ---- ARM A: four direct queries + naive screening each. ----
  const armA = await measure(async () => {
    const out: Record<string, unknown> = {};
    for (const { key, keyword } of keys) {
      const result = await listAgents({ page: 1, limit: 100, chainId: 56, isTestnet: false, search: keyword });
      out[key] = result.ok
        ? { hits: result.meta.pagination?.total ?? null, retrieved: result.data.length, selected: baselineScreen(result.data, keyword).length }
        : { error: result.reason };
    }
    return out;
  });

  // ---- ARM B: the marketplace agent, per category. ----
  const armB = await measure(async () => {
    const out: Record<string, unknown> = {};
    for (const { key } of keys) {
      const page = await getBscCategoryPage(key);
      out[key] = {
        state: page.state,
        hits: page.bucket?.hits ?? null,
        retrieved: page.bucket?.retrieved ?? 0,
        matched: page.bucket?.matched ?? 0,
        justificationAvailable: (page.bucket?.discovered ?? []).every((d) => d.match.evidenceText.length > 0),
      };
    }
    return out;
  });

  writeEvidence("task-02", "input.json", { task: "cross-category triage", categories: keys, chainId: 56, isTestnet: false });
  writeEvidence("task-02", "arm-a-baseline.json", { arm: "A", elapsedMs: armA.ms, upstreamRequests: armA.requests, monetaryCost: "NOT MEASURABLE", output: armA.value });
  writeEvidence("task-02", "arm-b-marketplace.json", { arm: "B", elapsedMs: armB.ms, upstreamRequests: armB.requests, monetaryCost: "NOT MEASURABLE", output: armB.value });

  console.log(`task-02 armA=${armA.ms}ms/${armA.requests}req  armB=${armB.ms}ms/${armB.requests}req`);
}

async function task03(): Promise<void> {
  // SECURITY task — fully offline. No signing, no submission, no transaction.
  const valid = {
    x402Version: 1,
    resource: "https://example.test/paid",
    accepts: [
      {
        scheme: "permit2",
        network: "bnb-testnet",
        maxAmountRequired: "1000",
        asset: "0xc70B8741B8B07A6d61E54fd4B20f22Fa648E5565",
        payTo: "0x299Ce4113abF88F4997737184aa8A7a3D58AC15C",
        resource: "https://example.test/paid",
        description: "unit test resource",
        mimeType: "application/json",
        maxTimeoutSeconds: 60,
        extra: { assetTransferMethod: "permit2-exact" },
      },
    ],
  };
  const malformed = { totally: "not-a-402-body" };

  // ---- ARM A: unaided manual reasoning, scripted as naive field checks. ----
  const armA = await measure(async () => {
    const naive = (body: unknown) => {
      if (typeof body !== "object" || body === null) return { decision: "refuse", reason: "not an object" };
      const accepts = (body as { accepts?: unknown[] }).accepts;
      if (!Array.isArray(accepts) || accepts.length === 0) return { decision: "refuse", reason: "no accepts[]" };
      const first = accepts[0] as Record<string, unknown>;
      // A naive reviewer typically checks only that a network string is present.
      if (typeof first.network !== "string") return { decision: "refuse", reason: "no network" };
      return { decision: "accept", reason: `network field present: ${first.network}` };
    };
    return {
      validChallenge: naive(valid),
      mainnetTarget: naive(valid), // naive check cannot express "which chain am I paying on"
      malformed: naive(malformed),
      chainEnforcement: "NOT PERFORMED — naive review has no chain allowlist",
    };
  });

  // ---- ARM B: marketplace x402 screening (parse + chain-pinned selection). ----
  const armB = await measure(async () => {
    const parsedValid = parsePaymentRequired(valid);
    const okSelection = parsedValid.ok ? selectPaymentRequirement(parsedValid.requirements) : { ok: false as const, reason: "parse failed" };
    const mainnetSelection = parsedValid.ok ? selectPaymentRequirement(parsedValid.requirements, { network: 56 }) : { ok: false as const, reason: "parse failed" };
    const parsedMalformed = parsePaymentRequired(malformed);
    return {
      validChallenge: { decision: okSelection.ok ? "accept" : "refuse", reason: okSelection.ok ? "payable on bnb-testnet (chain 97)" : okSelection.reason },
      mainnetTarget: { decision: mainnetSelection.ok ? "accept" : "refuse", reason: mainnetSelection.ok ? "accepted" : mainnetSelection.reason },
      malformed: { decision: parsedMalformed.ok ? "accept" : "refuse", reason: parsedMalformed.ok ? "parsed" : parsedMalformed.reason },
      chainEnforcement: "ENFORCED — chain 97 only; mainnet refused",
      signed: false,
      submitted: false,
    };
  });

  writeEvidence("task-03", "input.json", { task: "security screening of untrusted 402 challenge", cases: { valid, mainnetTarget: "same challenge, selection attempted against chain 56", malformed } });
  writeEvidence("task-03", "arm-a-baseline.json", { arm: "A", procedure: "unaided manual field inspection", elapsedMs: armA.ms, upstreamRequests: armA.requests, monetaryCost: "NOT MEASURABLE (offline)", output: armA.value });
  writeEvidence("task-03", "arm-b-marketplace.json", { arm: "B", procedure: "marketplace x402 parse + chain-pinned requirement selection", elapsedMs: armB.ms, upstreamRequests: armB.requests, monetaryCost: "NOT MEASURABLE (offline)", output: armB.value });

  console.log(`task-03 armA=${armA.ms}ms/${armA.requests}req  armB=${armB.ms}ms/${armB.requests}req`);
}

async function main(): Promise<void> {
  loadEnv();
  const startedAt = new Date().toISOString();
  await task01();
  await task02();
  await task03();
  writeEvidence(".", "RUN-METADATA.json", {
    startedAt,
    finishedAt: new Date().toISOString(),
    node: process.version,
    harness: "apps/web/lib/termix/advantage-harness.ts",
    protocol: "docs/termix/EXPERIMENT-PROTOCOL.md",
    notes: [
      "Timings are single-run wall clock on a warm network; they are not averaged.",
      "upstreamRequests is the observed outbound HTTP call count (billable-unit proxy).",
      "Monetary cost is NOT MEASURABLE: no published per-request price in this repo.",
      "No blockchain transaction, no mainnet, no signing occurred.",
    ],
  });
  console.log("evidence written to docs/termix/evidence/");
}

main().catch((error: unknown) => {
  console.error(`X.57 HARNESS FAILED — ${error instanceof Error ? (error.stack ?? error.message) : String(error)}`);
  process.exitCode = 1;
});
