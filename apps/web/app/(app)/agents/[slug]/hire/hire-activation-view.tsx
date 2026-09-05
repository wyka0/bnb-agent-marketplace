"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, CheckCircle2, KeyRound, ShieldCheck } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AuthControls } from "@/components/auth-controls";
import { Button, Card, CardContent, CardHeader, CardTitle, RegistryBadge } from "@bnb-marketplace/ui";
import { chainLabelForId } from "@/lib/eight004scan/card";
import { classifyAgentActivation } from "@/lib/activation/capability";

type SafeAgent = {
  name: string;
  agentId: string;
  description: string | null;
  category: string | null;
  protocols: string[];
  x402Supported: boolean;
  chainId: number;
  isTestnet: boolean;
  verification: string;
};

type PublicPermission = {
  kind: string;
  functionSignature: string | null;
  targetAddress: string | null;
  spendCapRaw: string | null;
  spendPeriod: string | null;
};

type PublicSession = {
  sessionId: string;
  status: string;
  chainId: number;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
  permissionLimitRaw: string;
  remainingRaw: string;
  permissions: PublicPermission[];
  agentId: string | null;
  agentName: string | null;
  agentSource: "8004scan" | null;
};

type ApiBody = {
  ok: boolean;
  data?: {
    consent?: { consentDigest: string };
    review?: Record<string, string | number>;
    session?: PublicSession;
    outcome?: string;
  };
  error?: { code?: string; message: string };
};

function csrfCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)__Host-bnb_csrf=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

export function HireActivationView({ agent }: { agent: SafeAgent }) {
  const classification = classifyAgentActivation({
    agentId: agent.agentId,
    chainId: agent.chainId,
    isTestnet: agent.isTestnet,
    name: agent.name,
    description: agent.description,
  });
  const [authenticated, setAuthenticated] = React.useState<boolean | null>(null);
  const [session, setSession] = React.useState<PublicSession | null>(null);
  const [review, setReview] = React.useState<ApiBody["data"] | null>(null);
  const [message, setMessage] = React.useState(classification.detail);
  const [busy, setBusy] = React.useState(false);

  const refresh = React.useCallback(async () => {
    const auth = await fetch("/api/auth/me", { cache: "no-store" }).then((response) => response.json());
    const signedIn = auth?.data !== null && auth?.data !== undefined;
    setAuthenticated(signedIn);
    if (!signedIn) return;
    const body = (await fetch("/api/altana/session", { cache: "no-store" }).then((response) =>
      response.json()
    )) as ApiBody;
    const current = body.data?.session ?? null;
    setSession(current && current.agentId === agent.agentId ? current : null);
  }, [agent.agentId]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  async function mutation(action: "review" | "activate") {
    const csrf = csrfCookie();
    if (csrf === null) {
      setMessage("Authentication required — connect your wallet, then return to this review.");
      setAuthenticated(false);
      return;
    }
    setBusy(true);
    try {
      const response = await fetch("/api/activation/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({
          action,
          agentId: agent.agentId,
          consentDigest: action === "activate" ? review?.consent?.consentDigest : undefined,
        }),
      });
      const body = (await response.json()) as ApiBody;
      if (!response.ok) {
        if (response.status === 401) setAuthenticated(false);
        setMessage(body.error?.message ?? "Activation unavailable.");
        return;
      }
      if (action === "review") {
        setReview(body.data ?? null);
        setMessage("Review loaded from the server. Confirm only if the identity and scope are correct.");
      } else if (body.data?.session) {
        setSession(body.data.session);
        setMessage("Activation confirmed — the persisted Altana session is active.");
      }
    } catch {
      setMessage("Activation unavailable — the server could not complete the request.");
    } finally {
      setBusy(false);
    }
  }

  async function revoke() {
    const csrf = csrfCookie();
    if (csrf === null) return;
    setBusy(true);
    try {
      const response = await fetch("/api/altana/session/revoke", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ action: "revoke" }),
      });
      const body = (await response.json()) as ApiBody;
      if (!response.ok) throw new Error(body.error?.message ?? "Revocation failed.");
      await refresh();
      setMessage(
        body.data?.outcome === "already-revoked"
          ? "The session was already revoked; no new transaction was sent."
          : "The session has been revoked."
      );
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Revocation failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container py-8">
      <Breadcrumbs
        items={[
          { label: "Marketplace", href: "/marketplace" },
          { label: agent.name, href: `/agents/${encodeURIComponent(agent.agentId)}` },
          { label: "Activate" },
        ]}
      />
      <div className="mb-6">
        <h1 className="text-3xl font-bold tracking-tight">Review agent activation</h1>
        <p className="mt-2 max-w-3xl text-muted-foreground">
          Confirm the exact registry identity and permission-safe Altana scope. No activation is
          claimed until the server returns a persisted active session.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Card>
          <CardHeader><CardTitle>{agent.name}</CardTitle></CardHeader>
          <CardContent className="space-y-5 text-sm">
            <dl className="grid gap-4 sm:grid-cols-2">
              <div><dt className="text-muted-foreground">Agent identity</dt><dd className="break-all font-mono text-xs">{agent.agentId}</dd></div>
              <div><dt className="text-muted-foreground">Source</dt><dd>8004scan registry</dd></div>
              <div><dt className="text-muted-foreground">Network</dt><dd>{chainLabelForId(agent.chainId)} (chain {agent.chainId})</dd></div>
              <div><dt className="text-muted-foreground">Verification</dt><dd>{agent.verification === "verified" ? "Verified" : "Unverified"}</dd></div>
              <div><dt className="text-muted-foreground">Category</dt><dd>{agent.category ?? "Not classified by 8004scan"}</dd></div>
              <div><dt className="text-muted-foreground">Capabilities</dt><dd>{agent.x402Supported ? "x402 payments" : "No actionable capability published"}</dd></div>
              <div><dt className="text-muted-foreground">Protocols</dt><dd>{agent.protocols.length ? agent.protocols.join(" · ") : "None listed"}</dd></div>
              <div><dt className="text-muted-foreground">Requested scope</dt><dd>{classification.state === "ACTIVATABLE" ? "Existing Altana CALL + bounded TOKEN_SPEND + NATIVE_SPEND policy" : "No permission request — agent is not activatable"}</dd></div>
            </dl>

            {review?.review ? (
              <div className="rounded-lg border border-border bg-background/50 p-4">
                <p className="font-medium">Server-confirmed immutable review</p>
                <p className="mt-2 break-all font-mono text-xs text-muted-foreground">
                  Consent digest: {review.consent?.consentDigest}
                </p>
              </div>
            ) : null}

            <div className="rounded-lg border border-border bg-muted/30 p-4" role="status">
              <p className="font-medium">{message}</p>
            </div>

            {session ? (
              <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
                <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400"><CheckCircle2 className="h-4 w-4" />Active session confirmed</div>
                <dl className="mt-3 grid gap-2 text-xs sm:grid-cols-2">
                  <div><dt className="text-muted-foreground">Status</dt><dd>{session.status}</dd></div>
                  <div><dt className="text-muted-foreground">Session</dt><dd className="break-all font-mono">{session.sessionId}</dd></div>
                  <div><dt className="text-muted-foreground">Created</dt><dd>{new Date(session.createdAt).toLocaleString()}</dd></div>
                  <div><dt className="text-muted-foreground">Permissions</dt><dd>{session.permissions.map((permission) => permission.kind).join(" · ")}</dd></div>
                </dl>
                <Button type="button" variant="outline" disabled={busy || session.status === "revoked"} onClick={() => void revoke()} className="mt-4">Revoke session</Button>
              </div>
            ) : null}
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Activation status</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2"><RegistryBadge state="synced" size="sm" /><span className="text-sm">Identity resolved</span></div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Authenticated ownership and CSRF are checked server-side.</div>
            <div className="flex items-start gap-2 text-sm text-muted-foreground"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" />Only the existing public session view is returned; custody material stays server-only.</div>
            {classification.state !== "ACTIVATABLE" ? (
              <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />{classification.detail}</div>
            ) : null}
            {authenticated === false ? <AuthControls onAuthenticated={() => void refresh()} /> : null}
            {authenticated === true && !session ? (
              review?.consent ? (
                <Button disabled={busy} onClick={() => void mutation("activate")} className="w-full">Confirm & activate</Button>
              ) : (
                <Button disabled={busy || classification.state !== "ACTIVATABLE"} onClick={() => void mutation("review")} className="w-full">Review permissions</Button>
              )
            ) : null}
            <Button variant="outline" asChild className="w-full"><Link href={`/agents/${encodeURIComponent(agent.agentId)}`}>Back to agent</Link></Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
