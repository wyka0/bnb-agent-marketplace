import "server-only";
import { cookies } from "next/headers";
import { AUTH_SESSION_COOKIE } from "./constants.ts";
import { getAuthenticatedUserFromStore } from "./session-core.ts";
import type { AuthenticatedIdentity } from "./types.ts";

export async function getAuthenticatedUser(): Promise<AuthenticatedIdentity | null> {
  const token = (await cookies()).get(AUTH_SESSION_COOKIE)?.value;
  if (!token) return null;
  const { prismaAuthStore } = await import("./prisma-store.server.ts");
  return getAuthenticatedUserFromStore(prismaAuthStore, token, new Date());
}
