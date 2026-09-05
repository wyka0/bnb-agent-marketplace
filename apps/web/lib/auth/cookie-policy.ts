import { AUTH_ATTEMPT_COOKIE, AUTH_CSRF_COOKIE, AUTH_SESSION_COOKIE } from "./constants.ts";

export type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "strict" | "lax" | "none";
  path?: string;
  maxAge?: number;
  expires?: Date;
  domain?: string;
};

export type CookiePolicy = { name: string; value: string; options: CookieOptions };

const HOST_COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: "lax",
  path: "/",
};

export function sessionCookiePolicy(expiresAt: Date): CookiePolicy {
  return { name: AUTH_SESSION_COOKIE, value: "", options: { ...HOST_COOKIE_OPTIONS, expires: expiresAt } };
}

export function csrfCookiePolicy(expiresAt: Date): CookiePolicy {
  return { name: AUTH_CSRF_COOKIE, value: "", options: { ...HOST_COOKIE_OPTIONS, httpOnly: false, expires: expiresAt } };
}

export function attemptCookiePolicy(): CookiePolicy {
  return { name: AUTH_ATTEMPT_COOKIE, value: "", options: { ...HOST_COOKIE_OPTIONS, maxAge: 300 } };
}

export function clearSessionCookies(): CookiePolicy[] {
  const clear: CookieOptions = { ...HOST_COOKIE_OPTIONS, maxAge: 0 };
  return [
    { name: AUTH_SESSION_COOKIE, value: "", options: { ...clear, httpOnly: true } },
    { name: AUTH_CSRF_COOKIE, value: "", options: { ...clear, httpOnly: false } },
    { name: AUTH_ATTEMPT_COOKIE, value: "", options: { ...clear, httpOnly: true } },
  ];
}
