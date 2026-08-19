import { NextResponse, type NextRequest } from "next/server";
import { buildSecurityHeaders, isHttpsRequest } from "./lib/security/headers.ts";
import { decodeSlugParam, isValidSlug, isAgentIdSlug } from "./lib/agent-slug.ts";

/**
 * Reject agent-detail URL shapes that can never resolve BEFORE the router
 * streams: this build commits 200 for dynamic routes, so a page-level
 * notFound() renders the not-found content without a real 404 status.
 * Guarding the decoded segment here keeps true 404s while name slugs and
 * registry identities (encoded or raw) pass through untouched.
 */
function agentSlugOfPath(pathname: string): string | null {
  const prefix = "/agents/";
  if (!pathname.startsWith(prefix)) return null;
  let rest = pathname.slice(prefix.length);
  if (rest.endsWith("/hire")) rest = rest.slice(0, -"/hire".length);
  return rest;
}

export function middleware(request: NextRequest) {
  const production = process.env.NODE_ENV === "production";
  const slug = agentSlugOfPath(request.nextUrl.pathname);
  if (slug !== null) {
    const decoded = decodeSlugParam(slug);
    if (decoded === null || (!isValidSlug(decoded) && !isAgentIdSlug(decoded))) {
      return new NextResponse(null, { status: 404 });
    }
  }
  const nonce = crypto.randomUUID().replaceAll("-", "");
  const https = isHttpsRequest(request.url, request.headers.get("x-forwarded-proto"));
  const securityHeaders = buildSecurityHeaders({ production, https, nonce });

  // Next 15 reads the request CSP/nonce while rendering App Router scripts.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  const csp = securityHeaders["Content-Security-Policy"];
  if (csp !== undefined) requestHeaders.set("Content-Security-Policy", csp);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  for (const [name, value] of Object.entries(securityHeaders)) response.headers.set(name, value);
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
