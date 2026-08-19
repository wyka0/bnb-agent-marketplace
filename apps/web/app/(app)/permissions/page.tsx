"use client";

import { Breadcrumbs } from "@/components/breadcrumbs";
import { Button, Card, CardContent, CardDescription, CardHeader, CardTitle } from "@bnb-marketplace/ui";
import {
  statusMeta,
  useSessionManager,
} from "@/lib/account/session-client";

export default function PermissionsPage() {
  const { session, load, message, busy, revokeTxHash, revoke } = useSessionManager();

  const callPermission = session?.permissions.find((permission) => permission.kind === "CALL");
  const spendPermission = session?.permissions.find((permission) => permission.kind === "TOKEN_SPEND");
  const nativePermission = session?.permissions.find((permission) => permission.kind === "NATIVE_SPEND");
  const meta = session ? statusMeta(session, load) : null;
  const revokeDisabled = busy || session === null || session.status === "revoked" || session.status === "failed";

  return (
    <div className="container py-8">
      <Breadcrumbs items={[{ label: "Permissions" }]} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Altana Permissions</h1>
        <p className="mt-1 text-muted-foreground">Your authenticated Altana session: scope, spend, expiry, and KeyStore status.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>ALTANA SESSION</CardTitle>
          <CardDescription>{message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-sm">
          {session ? (
            <>
              <dl className="grid gap-3 sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Wallet</dt>
                  <dd className="break-all font-mono">{session.walletAddress}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Network</dt>
                  <dd>BNB Testnet (chain {session.chainId})</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Status</dt>
                  <dd className={`font-medium ${meta?.tone === "emerald" ? "text-emerald-600" : meta?.tone === "red" ? "text-red-600" : "text-amber-600"}`}>{meta?.label ?? session.status}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">KeyStore</dt>
                  <dd>{session.keyStoreActive ? "Active" : load?.reason === "key-store-unavailable" ? "Unknown" : "Inactive"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Session</dt>
                  <dd className="break-all font-mono">{session.sessionId}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Activated agent</dt>
                  <dd>{session.agentName ?? "Not bound to an agent"}</dd>
                  {session.agentId ? (
                    <dd className="break-all font-mono text-xs text-muted-foreground">
                      {session.agentId} · {session.agentSource}
                    </dd>
                  ) : null}
                </div>
                <div>
                  <dt className="text-muted-foreground">Permissions</dt>
                  <dd className="font-mono">{callPermission?.functionSignature ?? "n/a"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Spend target</dt>
                  <dd className="break-all font-mono">{callPermission?.targetAddress ?? "n/a"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Spend cap</dt>
                  <dd>{session.permissionLimitRaw} raw $U unit/day ({spendPermission?.spendPeriod ?? "day"})</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Usage</dt>
                  <dd>{session.spentRaw} / {session.permissionLimitRaw} raw units ({session.remainingRaw} remaining)</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Native relay-fee cap</dt>
                  <dd>{nativePermission?.spendCapRaw ?? "n/a"} wei/day</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Expiry</dt>
                  <dd>{new Date(session.expiresAt).toISOString()}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Created</dt>
                  <dd>{new Date(session.createdAt).toISOString()}</dd>
                </div>
                {session.revokedAt ? (
                  <div>
                    <dt className="text-muted-foreground">Revoked</dt>
                    <dd>{new Date(session.revokedAt).toISOString()}</dd>
                  </div>
                ) : null}
                {revokeTxHash !== null ? (
                  <div>
                    <dt className="text-muted-foreground">Revoke transaction</dt>
                    <dd>
                      <span className="break-all font-mono">{revokeTxHash}</span>{" "}
                      <a className="text-primary underline" href={`https://testnet.bscscan.com/tx/${revokeTxHash}`} target="_blank" rel="noreferrer">open in explorer</a>
                    </dd>
                  </div>
                ) : session.revokeTxHash ? (
                  <div>
                    <dt className="text-muted-foreground">Revoke transaction</dt>
                    <dd>
                      <span className="break-all font-mono">{session.revokeTxHash}</span>{" "}
                      <a className="text-primary underline" href={`https://testnet.bscscan.com/tx/${session.revokeTxHash}`} target="_blank" rel="noreferrer">open in explorer</a>
                    </dd>
                  </div>
                ) : null}
                {session.registrationTxHash ? (
                  <div>
                    <dt className="text-muted-foreground">Registration transaction</dt>
                    <dd className="break-all font-mono">{session.registrationTxHash}</dd>
                  </div>
                ) : null}
              </dl>
              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <Button type="button" disabled={revokeDisabled} onClick={() => void revoke()}>
                  {session.status === "revoking" ? "Retry Revoke Session" : "Revoke Session"}
                </Button>
                <p className="text-muted-foreground">Revoking disables the current Altana session on BNB Testnet. Agent 1816 and Job 515 are not affected.</p>
              </div>
            </>
          ) : (
            <p className="text-muted-foreground">No Altana session available for this account.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}