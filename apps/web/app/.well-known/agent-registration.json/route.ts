import { NextResponse } from "next/server";
import { bnbTestnetRiskMetadata } from "@/lib/agents/bnb-testnet-risk/metadata";

export const dynamic = "force-dynamic";

export function GET(request: Request) {
  if (new URL(request.url).protocol !== "https:") {
    return NextResponse.json(
      { state: "blocked", reason: "canonical HTTPS origin is required before registration" },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
  const url = new URL("/api/agents/bnb-testnet-risk/service", request.url).toString();
  return NextResponse.json(bnbTestnetRiskMetadata(url), {
    headers: { "Cache-Control": "no-store" },
  });
}
