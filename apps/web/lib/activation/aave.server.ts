/**
 * P12 fixed-endpoint, server-only Aave MCP activation client.
 * The only callable tool is the verified read-only chain discovery probe.
 */

import {
  AAVE_AGENT_ID,
  AAVE_CHAIN_ID,
  type ActivationRequest,
  type ActivationResult,
  normalizePaymentRequired,
  normalizeToolResult,
  requestUserSignature,
  validateActivationRequest,
} from "./contract.ts";

const AAVE_MCP_ENDPOINT = "https://erc8004.heyanon.ai/mcp/aave";
const REQUEST_TIMEOUT_MS = 8_000;
const MAX_RESPONSE_BYTES = 1_000_000;

type FetchLike = typeof fetch;

export async function activateAavePreview(
  input: unknown,
  transport: FetchLike = fetch
): Promise<ActivationResult> {
  const request = validateActivationRequest(input);
  if (!("action" in request)) return request;

  try {
    const manifest = await requestJson(transport, "GET");
    if (!manifest.ok) return manifest.result;

    const initialized = await requestJson(
      transport,
      "POST",
      mcpRequest(1, "initialize", {
        protocolVersion: "2025-06-18",
        capabilities: {},
        clientInfo: { name: "bnb-marketplace-p12", version: "1.0.0" },
      })
    );
    if (!initialized.ok) return initialized.result;

    const tools = await requestJson(transport, "POST", mcpRequest(2, "tools/list", {}));
    if (!tools.ok) return tools.result;
    if (!hasTool(tools.body, "getAaveV3SupportedChains")) {
      return error("malformed-response", "The verified read-only Aave tool is unavailable.");
    }

    const probe = await requestJson(
      transport,
      "POST",
      mcpRequest(3, "tools/call", {
        name: "getAaveV3SupportedChains",
        arguments: {},
      })
    );
    if (!probe.ok) return probe.result;

    const normalized = normalizeToolResult(probe.body);
    if (normalized.kind === "transaction") {
      return {
        state: "transaction-required",
        actions: normalized.actions,
        signing: requestUserSignature(normalized.actions).state,
      };
    }
    if (normalized.kind !== "chains") {
      return error("malformed-response", "The Aave MCP response could not be safely normalized.");
    }
    if (!normalized.chains.some((chain) => chain.chainId === AAVE_CHAIN_ID)) {
      return { state: "unsupported", reason: "unsupported-chain" };
    }
    return {
      state: "ready",
      agentId: AAVE_AGENT_ID,
      chainId: AAVE_CHAIN_ID,
      bscSupported: true,
      supportedChains: normalized.chains,
      mcp: { manifest: "ok", initialize: "ok", toolsList: "ok", safeProbe: "ok" },
      paymentRequired: false,
    };
  } catch (cause) {
    return cause instanceof Error && cause.name === "TimeoutError"
      ? error("timeout", "The Aave MCP request timed out.")
      : error("mcp-server-error", "The Aave MCP service is unavailable.");
  }
}

type RequestResult = { ok: true; body: unknown } | { ok: false; result: ActivationResult };

async function requestJson(
  transport: FetchLike,
  method: "GET" | "POST",
  body?: Record<string, unknown>
): Promise<RequestResult> {
  const response = await transport(AAVE_MCP_ENDPOINT, {
    method,
    headers: body
      ? { "Content-Type": "application/json", Accept: "application/json, text/event-stream" }
      : { Accept: "application/json" },
    body: body ? JSON.stringify(body) : undefined,
    cache: "no-store",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_RESPONSE_BYTES) {
    return {
      ok: false,
      result: error("malformed-response", "The Aave MCP response was too large."),
    };
  }
  const raw = await response.text();
  if (raw.length > MAX_RESPONSE_BYTES) {
    return {
      ok: false,
      result: error("malformed-response", "The Aave MCP response was too large."),
    };
  }
  const parsed = parseJson(raw);
  if (response.status === 402) return { ok: false, result: normalizePaymentRequired(parsed) };
  if (response.status !== 200 && response.status !== 201) {
    return {
      ok: false,
      result: error("mcp-server-error", `The Aave MCP service returned HTTP ${response.status}.`),
    };
  }
  if (parsed === null)
    return {
      ok: false,
      result: error("malformed-response", "The Aave MCP service returned invalid JSON."),
    };
  if (isRecord(parsed) && isRecord(parsed.error)) {
    return {
      ok: false,
      result: error("mcp-server-error", "The Aave MCP service rejected the request."),
    };
  }
  return { ok: true, body: parsed };
}

function hasTool(body: unknown, name: string): boolean {
  if (!isRecord(body) || !isRecord(body.result) || !Array.isArray(body.result.tools)) return false;
  return body.result.tools.some((tool) => isRecord(tool) && tool.name === name);
}

function mcpRequest(
  id: number,
  method: string,
  params: Record<string, unknown>
): Record<string, unknown> {
  return { jsonrpc: "2.0", id, method, params };
}

function parseJson(raw: string): unknown | null {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function error(
  code: "timeout" | "mcp-server-error" | "malformed-response",
  message: string
): ActivationResult {
  return { state: "error", code, message };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export type { ActivationRequest };
