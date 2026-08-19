import { NextResponse } from "next/server";
import { activateAavePreview } from "@/lib/activation/aave.server";
import { readJson } from "@/lib/auth/request.ts";
import { enforceRateLimit } from "@/lib/security/rate-limit.route.ts";
import { globalKeyOf } from "@/lib/security/rate-limiter.ts";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const limited = await enforceRateLimit("activation.aave.preview", globalKeyOf("activation.aave.preview"));
  if (limited) return limited;
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 4_096) {
    return NextResponse.json(
      { state: "error", code: "malformed-response", message: "Request body is too large." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  const input = await readJson<unknown>(request, 4_096);
  if (input === null) {
    return NextResponse.json(
      { state: "error", code: "malformed-response", message: "Request body must be JSON." },
      { status: 400, headers: { "Cache-Control": "no-store" } }
    );
  }
  try {
    return NextResponse.json(await activateAavePreview(input), { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json(
      { state: "error", code: "upstream-unavailable", message: "The preview service is unavailable." },
      { status: 503, headers: { "Cache-Control": "no-store" } }
    );
  }
}
