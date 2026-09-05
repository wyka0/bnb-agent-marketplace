"use client";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { AuthControls } from "@/components/auth-controls";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bnb-marketplace/ui";
import { statusMeta, useAuthIdentity, useSessionManager } from "@/lib/account/session-client";

export default function SettingsPage() {
  const { identity, loading } = useAuthIdentity();
  const { session, load, message, busy, revokeTxHash, revoke } = useSessionManager();
  const meta = session ? statusMeta(session, load) : null;
  const revokeDisabled = busy || session === null || session.status === "revoked" || session.status === "failed";

  return (
    <div className="container py-8">
      <Breadcrumbs items={[{ label: "Settings" }]} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Settings</h1>
        <p className="mt-1 text-muted-foreground">
          Real application settings only. Preferences this app does not support (notifications,
          email, trading, API keys, payment or balance settings) are not offered.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Wallet &amp; authentication</CardTitle>
            <CardDescription>SIWE identity on BNB Testnet (chain 97).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {loading ? (
              <p className="text-muted-foreground" role="status">Loading authentication state…</p>
            ) : identity ? (
              <dl className="grid gap-3">
                <div>
                  <dt className="text-muted-foreground">Signed in as</dt>
                  <dd className="break-all font-mono">{identity.walletAddress}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Authentication</dt>
                  <dd className="font-medium text-emerald-600">Signed in with wallet</dd>
                </div>
                {identity.sessionExpiresAt ? (
                  <div>
                    <dt className="text-muted-foreground">Sign-in expires</dt>
                    <dd>{new Date(identity.sessionExpiresAt).toISOString()}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="text-muted-foreground">No wallet is connected. Connect one to sign in.</p>
            )}
            <div className="border-t pt-4">
              <AuthControls />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Session management</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {session ? (
              <>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd className={`font-medium ${meta?.tone === "emerald" ? "text-emerald-600" : meta?.tone === "red" ? "text-red-600" : "text-amber-600"}`}>
                      {meta?.label ?? session.status}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Bound agent</dt>
                    <dd>{session.agentName ?? "Not bound to an agent"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Expiry</dt>
                    <dd>{new Date(session.expiresAt).toISOString()}</dd>
                  </div>
                  {session.revokedAt ? (
                    <div>
                      <dt className="text-muted-foreground">Revoked</dt>
                      <dd>{new Date(session.revokedAt).toISOString()}</dd>
                    </div>
                  ) : null}
                </dl>
                {revokeTxHash !== null || session.revokeTxHash ? (
                  <div>
                    <dt className="text-muted-foreground">Revoke transaction</dt>
                    <dd className="break-all font-mono">{revokeTxHash ?? session.revokeTxHash}</dd>
                  </div>
                ) : null}
                <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                  <Button type="button" disabled={revokeDisabled} onClick={() => void revoke()}>
                    {session.status === "revoking" ? "Retry Revoke Session" : "Revoke Session"}
                  </Button>
                  <p className="text-muted-foreground">Disables the current Altana session on BNB Testnet. Agent 1816 and Job 515 are not affected.</p>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground">
                {busy ? "Loading authenticated session state…" : "No revocable Altana session for this account."}
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Security &amp; environment</CardTitle>
            <CardDescription>How this deployment is configured.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
              <li>Execution and session custody run server-side only; custody material never reaches the browser.</li>
              <li>All API responses are same-origin, rate-limited, and CSRF-protected.</li>
              <li>Altana activation targets BNB Testnet (chain 97); mainnet is never used for activation.</li>
              <li>Static assets are served over HTTPS with strict security headers.</li>
            </ul>
            <div className="border-t pt-4">
              <p className="text-muted-foreground">
                Full session and permission details are on the Permissions page.
              </p>
              <Button type="button" variant="outline" asChild className="mt-2">
                <a href="/permissions">Open Permissions</a>
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account controls</CardTitle>
            <CardDescription>Actions that really exist on this deployment.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              Signing out removes the wallet cookie on this device. It does not modify any Altana
              session; revoke an active session above or on Permissions first if you want it disabled.
            </p>
            <div className="border-t pt-4">
              <AuthControls compact />
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}