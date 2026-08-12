import { NextResponse } from "next/server";
import {
  fetchAgentRows,
  findAgentByIdentity,
  isValidAgentIdentity,
  parseHireRequest,
  runHireActivation,
} from "@/lib/activation/hire.server";

export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 4_096;

/**
 * POST /api/activation/hire — the REAL marketplace hire/activation endpoint.
 *
 * Resolves the EXACT 8004scan record for the requested `agentId`, classifies
 * its activation capability from real registry data only, and — when the agent
 * is truly ACTIVATABLE — builds the immutable LIVE action review + pinned
 * consent digest from the verified activation builders. It NEVER signs, never
 * broadcasts, never returns credentials, and never fabricates an action.
 */
export async function POST(request: Request) {
  const length = Number(request.headers.get("content-length") ?? "0");
  if (length > MAX_BODY_BYTES) {
    return NextResponse.json(
      { error: "bad-request", message: "Request body is too large." },
      { status: 400 }
    );
  }

  let input: unknown;
  try {
    input = await request.json();
  } catch {
    return NextResponse.json(
      { error: "bad-request", message: "Request body must be JSON." },
      { status: 400 }
    );
  }

  const parsed = parseHireRequest(input);
  if (!parsed.ok) {
    return NextResponse.json({ error: "bad-request", message: parsed.reason }, { status: 400 });
  }
  const agentId = parsed.agentId;
  if (!isValidAgentIdentity(agentId)) {
    return NextResponse.json(
      { error: "bad-request", message: "agentId must be a valid 8004scan agent identity." },
      { status: 400 }
    );
  }

  let rows: Awaited<ReturnType<typeof fetchAgentRows>>;
  try {
    rows = await fetchAgentRows();
  } catch (error) {
    return NextResponse.json(
      {
        error: "data-source-unavailable",
        message: error instanceof Error ? error.message : "The agent registry is unavailable.",
      },
      { status: 502 }
    );
  }

  const record = findAgentByIdentity(rows, agentId);
  if (record === null) {
    return NextResponse.json({ error: "agent-not-found", agentId }, { status: 404 });
  }

  const outcome = await runHireActivation(record, { env: process.env });
  return NextResponse.json(outcome, {
    headers: { "Cache-Control": "no-store" },
  });
}
