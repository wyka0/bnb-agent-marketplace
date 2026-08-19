export const AUTH_CHAIN_ID = 97;
export const AUTH_STATEMENT = "Sign in to BNB Agent Studio Marketplace.";
export const AUTH_NONCE_TTL_MS = 5 * 60 * 1000;
export const AUTH_ATTEMPT_COOKIE = "__Host-siwe_attempt";
export const AUTH_SESSION_COOKIE = "__Host-bnb_session";
export const AUTH_CSRF_COOKIE = "__Host-bnb_csrf";
export const AUTH_MAX_BODY_BYTES = 8_192;
export const AUTH_SESSION_LAST_USED_THROTTLE_MS = 5 * 60 * 1000;
export const AUTH_NONCE_RATE_WINDOW_MS = 10 * 60 * 1000;
export const AUTH_NONCE_RATE_LIMIT = 10;
export const AUTH_GLOBAL_NONCE_RATE_LIMIT = 1_000;

export function getAuthConfig() {
  const origin = new URL(process.env.AUTH_CANONICAL_ORIGIN ?? "http://localhost:3000");
  if (origin.protocol !== "http:" && origin.protocol !== "https:") {
    throw new Error("AUTH_CANONICAL_ORIGIN must use http or https.");
  }
  if (process.env.NODE_ENV === "production" && origin.protocol !== "https:") {
    throw new Error("AUTH_CANONICAL_ORIGIN must use https in production.");
  }
  if (origin.username || origin.password || origin.host.length === 0) {
    throw new Error("AUTH_CANONICAL_ORIGIN must not contain credentials and must include a host.");
  }
  if (origin.pathname !== "/" || origin.search || origin.hash) {
    throw new Error("AUTH_CANONICAL_ORIGIN must be an origin without a path, query, or hash.");
  }

  const sessionTtlSeconds = Number(process.env.AUTH_SESSION_TTL_SECONDS ?? 604_800);
  if (!Number.isInteger(sessionTtlSeconds) || sessionTtlSeconds < 900 || sessionTtlSeconds > 2_592_000) {
    throw new Error("AUTH_SESSION_TTL_SECONDS is outside the supported range.");
  }

  return {
    origin: origin.origin,
    domain: origin.host,
    uri: `${origin.origin}/login`,
    sessionTtlMs: sessionTtlSeconds * 1000,
  };
}
