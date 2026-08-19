/** X.49 production security-header policy (pure and offline-verifiable). */

export type SecurityHeaderOptions = {
  production: boolean;
  https: boolean;
  nonce: string;
};

export function buildContentSecurityPolicy(input: SecurityHeaderOptions): string | null {
  if (!input.production) return null;
  const directives = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${input.nonce}' 'strict-dynamic'`,
    `style-src 'self' 'nonce-${input.nonce}'`,
    "img-src 'self' data: blob:",
    "font-src 'self' data:",
    "connect-src 'self'",
    "worker-src 'self' blob:",
    "manifest-src 'self'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
  ];
  if (input.https) directives.push("upgrade-insecure-requests");
  return `${directives.join("; ")};`;
}

export function buildSecurityHeaders(input: SecurityHeaderOptions): Record<string, string> {
  const headers: Record<string, string> = {
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Permissions-Policy": "camera=(), geolocation=(), microphone=(), payment=(), usb=()",
    "X-Frame-Options": "DENY",
  };
  const csp = buildContentSecurityPolicy(input);
  if (csp !== null) headers["Content-Security-Policy"] = csp;
  if (input.production && input.https) {
    headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains";
  }
  return headers;
}

export function isHttpsRequest(url: string, forwardedProto: string | null): boolean {
  const forwarded = forwardedProto?.split(",", 1)[0]?.trim().toLowerCase();
  if (forwarded === "https") return true;
  try {
    return new URL(url).protocol === "https:";
  } catch {
    return false;
  }
}
