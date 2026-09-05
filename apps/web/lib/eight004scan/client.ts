/**
 * 8004scan Public API — typed, server-only client.
 *
 * - Reuses the shared HTTP foundation (`@bnb-marketplace/data-api`).
 * - Reads the API key ONLY from server-side env vars: `8004SCAN_API_KEY` is the
 *   canonical name (local runs, documented key name); `E8004SCAN_API_KEY` is a
 *   Vercel-compatible alias because Vercel rejects env names starting with a
 *   digit. The key is NEVER referenced with a `NEXT_PUBLIC_` prefix, and this
 *   module is only imported by server code (the route's server component), so it
 *   can never be bundled into the browser.
 * - Keyless-safe: with no key the client still works against the anonymous tier;
 *   callers decide how to present the "no key configured" situation.
 *
 * This module performs NO network calls at import time. Requests only happen
 * when a method is invoked at request time (never during `next build`).
 */

import { createApiClient } from "@bnb-marketplace/data-api";
import type {
  ListAgentsParams,
  Scan8004Agent,
  Scan8004Envelope,
  Scan8004ListEnvelope,
  Scan8004Meta,
} from "./types";

const DEFAULT_BASE_URL = "https://8004scan.io/api/v1/public";

/** Normalized failure reason the UI can switch on (never leaks the key). */
export type Scan8004FailureReason =
  "unauthorized" | "rate-limited" | "not-found" | "bad-request" | "error";

/** Result of a list call — discriminated so callers map to honest UI states. */
export type Scan8004Result<T> =
  | { ok: true; data: T[]; meta: Scan8004Meta }
  | { ok: false; reason: Scan8004FailureReason; status?: number; message?: string };

/** Read the server-only API key. Returns `undefined` when unset (keyless). */
export function get8004ScanApiKey(): string | undefined {
  // Bracket access because the documented env name begins with a digit.
  const key = process.env["8004SCAN_API_KEY"] ?? process.env["E8004SCAN_API_KEY"];
  return key && key.trim().length > 0 ? key : undefined;
}

/** Whether an API key is configured (used to decide the "unavailable" state). */
export function has8004ScanApiKey(): boolean {
  return get8004ScanApiKey() !== undefined;
}

function baseUrl(): string {
  const fromEnv = process.env["EIGHT004SCAN_BASE_URL"];
  return fromEnv && fromEnv.trim().length > 0 ? fromEnv : DEFAULT_BASE_URL;
}

function mapStatusToReason(status: number): Scan8004FailureReason {
  if (status === 401 || status === 403) return "unauthorized";
  if (status === 429) return "rate-limited";
  if (status === 404) return "not-found";
  if (status === 400) return "bad-request";
  return "error";
}

/** Build the query string from documented `GET /agents` params only. */
function toQuery(params: ListAgentsParams): string {
  const p = new URLSearchParams();
  if (params.page != null) p.set("page", String(params.page));
  if (params.limit != null) p.set("limit", String(params.limit));
  if (params.chainId != null) p.set("chainId", String(params.chainId));
  if (params.ownerAddress) p.set("ownerAddress", params.ownerAddress);
  if (params.search) p.set("search", params.search);
  if (params.protocol) p.set("protocol", params.protocol);
  if (params.sortBy) p.set("sortBy", params.sortBy);
  if (params.sortOrder) p.set("sortOrder", params.sortOrder);
  if (params.isTestnet != null) p.set("isTestnet", String(params.isTestnet));
  const s = p.toString();
  return s ? `?${s}` : "";
}

function isListEnvelope(v: unknown): v is Scan8004ListEnvelope<Scan8004Agent> {
  return (
    typeof v === "object" &&
    v !== null &&
    (v as { success?: unknown }).success === true &&
    Array.isArray((v as { data?: unknown }).data)
  );
}

/**
 * X.50: per-record validation for upstream agent rows (closes the X.49 LOW
 * deferral). Only the identity/type-critical fields the app actually keys on
 * are enforced; malformed rows are DROPPED rather than trusted, so a hostile
 * or broken upstream response can never inject partial records downstream.
 * Optional/nullable metrics stay untouched — `normalizeAgent` already coerces
 * them without fabricating values.
 */
export function isValidAgentRecord(value: unknown): value is Scan8004Agent {
  if (typeof value !== "object" || value === null) return false;
  const row = value as Record<string, unknown>;
  return (
    typeof row.id === "string" &&
    row.id.length > 0 &&
    typeof row.agent_id === "string" &&
    row.agent_id.length > 0 &&
    typeof row.token_id === "string" &&
    row.token_id.length > 0 &&
    typeof row.chain_id === "number" &&
    Number.isInteger(row.chain_id) &&
    typeof row.chain_type === "string" &&
    typeof row.is_testnet === "boolean"
  );
}

/** Keep only well-formed upstream rows. */
export function filterValidAgentRecords(rows: readonly unknown[]): Scan8004Agent[] {
  return rows.filter(isValidAgentRecord);
}

/**
 * X.245 — upstream registry read timeout.
 *
 * X.244 measured 8004scan healthy reads at ~0.7–2.2s and degraded reads
 * slow-failing at ~10.4s (502). The previous 8s timeout let a degraded
 * upstream block the whole server render for 8–10s on every marketplace
 * page/network switch. 4s keeps ~1.8x headroom over the worst observed
 * HEALTHY read and fails fast to the honest "registry unavailable" state.
 * Truthful degraded behavior is unchanged: a timeout still renders the
 * honest offline state — never fabricated data.
 */
export const SCAN_READ_TIMEOUT_MS = 4_000;

/**
 * `GET /agents` — list ERC-8004 agents (paginated).
 *
 * Never throws for HTTP/network problems: returns a discriminated result so the
 * page can render an honest state. `timeoutMs` guards against hanging requests.
 */
export async function listAgents(
  params: ListAgentsParams = {},
  options: { timeoutMs?: number; signal?: AbortSignal } = {}
): Promise<Scan8004Result<Scan8004Agent>> {
  const apiKey = get8004ScanApiKey();
  const client = createApiClient({
    baseUrl: baseUrl(),
    timeoutMs: options.timeoutMs ?? SCAN_READ_TIMEOUT_MS,
  });

  const headers: Record<string, string> = { Accept: "application/json" };
  // Documented auth: optional `X-API-Key` header. Omitted entirely when unset.
  if (apiKey) headers["X-API-Key"] = apiKey;

  try {
    // `forceLiterally` returns the raw JSON body so we can parse the 8004scan
    // envelope ({success,data,meta}) ourselves instead of the data-api envelope.
    const raw = await client.get<unknown>(`/agents${toQuery(params)}`, {
      headers,
      forceLiterally: true,
      cache: "no-store",
    });

    const envelope = raw as Scan8004Envelope<Scan8004Agent>;
    if (isListEnvelope(envelope)) {
      // X.50: drop malformed rows instead of trusting the upstream shape.
      return { ok: true, data: filterValidAgentRecords(envelope.data), meta: envelope.meta ?? {} };
    }
    // success:false envelope (shape documented) — surface message, no key leak.
    const message =
      typeof envelope === "object" && envelope !== null && "error" in envelope
        ? (envelope as { error?: { message?: string } }).error?.message
        : undefined;
    return { ok: false, reason: "error", message };
  } catch (error) {
    // `ApiClientError` carries a `status`; map to an honest reason.
    const status = (error as { status?: number })?.status;
    if (typeof status === "number") {
      return { ok: false, reason: mapStatusToReason(status), status };
    }
    // Network failure / timeout / abort → offline-style error.
    return { ok: false, reason: "error" };
  }
}
