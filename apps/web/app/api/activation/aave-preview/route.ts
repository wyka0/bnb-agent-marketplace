import { NextResponse } from "next/server";
import { activateAavePreview } from "@/lib/activation/aave.server";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > 4_096) {
    return NextResponse.json(
      { state: "error", code: "malformed-response", message: "Request body is too large." },
      { status: 400 }
    );
  }
  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { state: "error", code: "malformed-response", message: "Request body must be JSON." },
      { status: 400 }
    );
  }
  return NextResponse.json(await activateAavePreview(input), {
    headers: { "Cache-Control": "no-store" },
  });
}
