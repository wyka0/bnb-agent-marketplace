import { NextResponse } from "next/server";
import {
  parseRiskRequest,
  readBnbTestnetWalletSnapshot,
} from "@/lib/agents/bnb-testnet-risk/service";

export const dynamic = "force-dynamic";
const MAX_BODY_BYTES = 1_024;

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") ?? "0");
  if (declaredLength > MAX_BODY_BYTES) {
    return NextResponse.json(
      { state: "invalid-request", reason: "request-too-large" },
      { status: 413 }
    );
  }

  let body: unknown;
  try {
    const raw = await request.text();
    if (new TextEncoder().encode(raw).length > MAX_BODY_BYTES) {
      return NextResponse.json(
        { state: "invalid-request", reason: "request-too-large" },
        { status: 413 }
      );
    }
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json(
      { state: "invalid-request", reason: "invalid-wallet" },
      { status: 400 }
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
