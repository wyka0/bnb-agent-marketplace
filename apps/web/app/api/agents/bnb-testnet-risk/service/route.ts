import { NextResponse } from "next/server";
import {
  parseRiskRequest,
  readBnbTestnetWalletSnapshot,
} from "@/lib/agents/bnb-testnet-risk/service";
import { readJson } from "@/lib/auth/request.ts";
import { enforceRateLimit } from "@/lib/security/rate-limit.route.ts";
import { globalKeyOf } from "@/lib/security/rate-limiter.ts";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 1_024;

export async function POST(request: Request) {
  const limited = await enforceRateLimit("agents.bnb.testnet.risk", globalKeyOf("agents.bnb.testnet.risk"));
  if (limited) return limited;
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { state: "invalid-request", reason: "request-too-large" },
      { status: 413 }
    );
  }

  const body = await readJson<unknown>(request, MAX_BODY_BYTES);
  if (body === null) {
    return NextResponse.json(
      { state: "invalid-request", reason: "invalid-wallet" },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }

  const parsed = parseRiskRequest(body);
  if (!parsed.ok) {
    return NextResponse.json(parsed, { status: 400 });
  }

  const result = await readBnbTestnetWalletSnapshot(parsed.wallet);
  return NextResponse.json(result, {
    status: result.state === "ready" ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
