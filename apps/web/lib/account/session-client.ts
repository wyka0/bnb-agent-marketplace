"use client";

import * as React from "react";

/**
 * Shared client-side session + identity plumbing for Profile, Settings, and
 * Permissions. Verbatim extraction of the previously page-local session view
 * logic — the authenticated identity/session services are never duplicated.
 */

export type PublicSessionPermissionView = {
  kind: "CALL" | "TOKEN_SPEND" | "NATIVE_SPEND";
  targetAddress: string | null;
  functionSignature: string | null;
  functionSelector: string | null;
  tokenAddress: string | null;
  spendCapRaw: string | null;
  spendPeriod: string | null;
};

export type PublicSessionView = {
  sessionId: string;
  chainId: number;
  walletAddress: string;
  status: string;
  keyStoreActive: boolean;
  createdAt: string;
  updatedAt: string;
  expiresAt: string;
  revokedAt: string | null;
  lastVerifiedAt: string | null;
  lastReconstructedAt: string | null;
  spentRaw: string;
  remainingRaw: string;
  permissionLimitRaw: string;
  nativeFeeLimitRaw: string | null;
  permissions: PublicSessionPermissionView[];
  grantCallsId: string | null;
  registrationCallsId: string | null;
  registrationTxHash: string | null;
  revokeCallsId: string | null;
  revokeTxHash: string | null;
  agentId: string | null;
  agentName: string | null;
  agentSource: "8004scan" | null;
};

export type SessionResponse = {
  ok: boolean;
  data?: {
    session: PublicSessionView | null;
    load?: { kind: string; reason?: string };
    outcome?: "revoked" | "already-revoked";
    revokeTxHash?: string;
    reconciled?: boolean;
  };
  error?: { message: string };
};

export type AuthIdentity = {
  walletAddress: string;
  chainId: number;
  sessionExpiresAt?: string;
} | null;

const REVOKE_CONFIRM_TEXT = [
  "Revoke the Altana session for this wallet?",
  "",
  "This will disable the current Altana session: permitted automated operations will stop.",
  "Revocation is performed on BNB Testnet.",
  "This does not modify Agent 1816 or Job 515.",
  "",
  "Proceed?",
].join("\n");

export function csrfCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)__Host-bnb_csrf=([^;]*)/);
  if (!match || match[1] === undefined || match[1] === "") return null;
  return decodeURIComponent(match[1]);
}

export function statusMeta(
  session: PublicSessionView,
  load: { kind: string; reason?: string } | null
): { label: string; tone: "emerald" | "amber" | "red" } {
  if (session.status === "active" && (load?.kind ?? "active") === "active") return { label: "Active", tone: "emerald" };
  if (session.status === "revoked") return { label: "Revoked", tone: "red" };
  if (session.status === "expired") return { label: "Expired — revoke available", tone: "amber" };
  if (session.status === "revoking") return { label: "Revocation in progress", tone: "amber" };
  if (session.status === "failed") return { label: "Failed", tone: "red" };
  if (load?.reason === "key-store-revoked") return { label: "Revoked (reconciled from network)", tone: "red" };
  if (load?.kind === "blocked") return { label: "Reconciliation required", tone: "amber" };
  return { label: session.status, tone: "amber" };
}

export function useAuthIdentity(): {
  identity: AuthIdentity;
  loading: boolean;
} {
  const [identity, setIdentity] = React.useState<AuthIdentity>(null);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ data: AuthIdentity }>)
      .then((result) => {
        if (!cancelled) setIdentity(result.data);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return { identity, loading };
}

export function useSessionManager() {
  const [session, setSession] = React.useState<PublicSessionView | null>(null);
  const [load, setLoad] = React.useState<{ kind: string; reason?: string } | null>(null);
  const [message, setMessage] = React.useState("Loading authenticated Altana session state...");
  const [busy, setBusy] = React.useState(false);
  const [revokeTxHash, setRevokeTxHash] = React.useState<string | null>(null);

  const refresh = React.useCallback(async () => {
    setRevokeTxHash(null);
    const response = await fetch("/api/altana/session", { cache: "no-store" });
    const body = (await response.json()) as SessionResponse;
    if (response.status === 401) {
      setMessage("Please sign in to manage your Altana session.");
      setSession(null);
      setLoad(null);
      return;
    }
    if (body.ok && body.data) {
      setSession(body.data.session);
      setLoad(body.data.load ?? null);
      if (body.data.session) setMessage("Session state loaded from persistence.");
      else if (body.data.load?.kind === "blocked") setMessage("No revocable Altana session for this account.");
      else setMessage("No Altana session for this account.");
    } else if (body.error) {
      setSession(null);
      setLoad(null);
      setMessage(body.error.message);
    }
  }, []);

  const revoke = React.useCallback(async () => {
    const csrf = csrfCookie();
    if (csrf === null) {
      setMessage("Session token expired; please sign in again.");
      return;
    }
    if (!window.confirm(REVOKE_CONFIRM_TEXT)) return;
    setBusy(true);
    setMessage("Revoking the Altana session on BNB Testnet...");
    try {
      const response = await fetch("/api/altana/session/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ action: "revoke" }),
      });
      const body = (await response.json()) as SessionResponse;
      if (!response.ok) {
        throw new Error(body.error?.message ?? "Revocation failed; no transaction was sent.");
      }
      const outcome = body.data?.outcome ?? "revoked";
      setRevokeTxHash(body.data?.revokeTxHash ?? null);
      setMessage(
        body.data?.reconciled === true
          ? "The Altana session was already inactive; it has been reconciled without a new transaction."
          : outcome === "revoked"
            ? "The Altana session has been revoked on BNB Testnet."
            : "The Altana session is already revoked; no new transaction was sent."
      );
      await refresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Revocation failed; no transaction was sent.");
    } finally {
      setBusy(false);
    }
  }, [refresh]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  return { session, load, message, busy, revokeTxHash, refresh, revoke };
}