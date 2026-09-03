"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowLeft, ExternalLink, ShieldCheck } from "lucide-react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { AuthControls } from "@/components/auth-controls";
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@bnb-marketplace/ui";
import { statusMeta, useAuthIdentity, useSessionManager } from "@/lib/account/session-client";

function shortenAddress(address: string): string {
  if (address.length <= 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

/**
 * X.232 — truthful chain labels. Maps known BNB chains to human names; any
 * other chain ID is shown as its numeric value (never fabricated).
 */
function chainDisplayName(chainId: number | null): string {
  if (chainId === null) return "Unknown (no wallet detected)";
  if (chainId === 56) return "BNB Smart Chain Mainnet (chain 56)";
  if (chainId === 97) return "BNB Testnet (chain 97)";
  return `Chain ${chainId}`;
}

export default function ProfilePage() {
  const { identity, loading } = useAuthIdentity();
  const { session, load, message, busy } = useSessionManager();
  const meta = session ? statusMeta(session, load) : null;

  // X.232 — WALLET CURRENT CHAIN is read-only (eth_chainId, never a wallet
  // prompt). The SIWE SESSION CHAIN comes from the authenticated identity.
  // These are deliberately displayed as separate, truthful facts.
  const [walletChainId, setWalletChainId] = React.useState<number | null>(null);
  React.useEffect(() => {
    let cancelled = false;
    const ethereum = (
      window as unknown as {
        ethereum?: { request: (args: { method: string }) => Promise<unknown> };
      }
    ).ethereum;
    if (!ethereum) return;
    void ethereum
      .request({ method: "eth_chainId" })
      .then((hex) => {
        if (cancelled) return;
        const n = Number.parseInt(String(hex), 16);
        if (Number.isInteger(n)) setWalletChainId(n);
      })
      .catch(() => {
        /* read-only; silence is safe (UI shows auth-only state) */
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const authChain = identity?.chainId ?? null;
  const walletDiffersFromAuth =
    walletChainId !== null && authChain !== null && walletChainId !== authChain;

  return (
    <div className="container py-8">
      <Breadcrumbs items={[{ label: "Profile" }]} />
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">Profile</h1>
        <p className="mt-1 text-muted-foreground">
          What your wallet has signed on this app. No username, avatar, reputation, balances, or
          performance are stored or fabricated.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Wallet identity</CardTitle>
            <CardDescription>Signed in via SIWE on {chainDisplayName(authChain)}.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {loading ? (
              <p className="text-muted-foreground" role="status">
                Loading authentication state…
              </p>
            ) : identity ? (
              <>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Wallet</dt>
                    <dd className="break-all font-mono">{identity.walletAddress}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Shortened</dt>
                    <dd className="font-mono">{shortenAddress(identity.walletAddress)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Wallet network</dt>
                    <dd>{chainDisplayName(walletChainId)}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Authentication</dt>
                    <dd>
                      <span className="font-medium text-emerald-600">Signed in</span>{" "}
                      <span className="text-muted-foreground">
                        on {chainDisplayName(authChain)}
                      </span>
                    </dd>
                  </div>
                </dl>
                {walletDiffersFromAuth ? (
                  <div
                    className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs"
                    role="note"
                  >
                    <ShieldCheck
                      className="mt-0.5 h-4 w-4 shrink-0 text-amber-600"
                      aria-hidden="true"
                    />
                    <span>
                      Your wallet is on {chainDisplayName(walletChainId)} but you signed in on{" "}
                      {chainDisplayName(authChain)}. Authentication is for{" "}
                      {chainDisplayName(authChain)}. Sign in again after switching networks if you
                      need a session on {chainDisplayName(walletChainId)}.
                    </span>
                  </div>
                ) : null}
                {identity.sessionExpiresAt ? (
                  <p className="text-muted-foreground">
                    Sign-in expires {new Date(identity.sessionExpiresAt).toISOString()}. Sign in
                    again to continue.
                  </p>
                ) : null}
                <div className="flex flex-wrap items-center gap-2 border-t pt-4">
                  <AuthControls compact />
                  <Button type="button" variant="outline" asChild>
                    <Link href="/settings">Manage account</Link>
                  </Button>
                </div>
              </>
            ) : (
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  Connect a wallet on BNB Testnet to see your signed-in identity. Until then there
                  is no profile data to show.
                </p>
                <AuthControls />
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Account &amp; session status</CardTitle>
            <CardDescription>{message}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            {session ? (
              <>
                <dl className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <dt className="text-muted-foreground">Status</dt>
                    <dd
                      className={`font-medium ${meta?.tone === "emerald" ? "text-emerald-600" : meta?.tone === "red" ? "text-red-600" : "text-amber-600"}`}
                    >
                      {meta?.label ?? session.status}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Bound agent</dt>
                    <dd>{session.agentName ?? "Not bound to an agent"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Created</dt>
                    <dd>{new Date(session.createdAt).toISOString()}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Expiry</dt>
                    <dd>{new Date(session.expiresAt).toISOString()}</dd>
                  </div>
                </dl>
                {session.revokedAt ? (
                  <p className="text-amber-600">
                    Revoked {new Date(session.revokedAt).toISOString()}.
                  </p>
                ) : null}
              </>
            ) : (
              <p className="text-muted-foreground">
                {busy
                  ? "Loading authenticated session state…"
                  : "No Altana session is available for this account. Sessions appear here only when they really exist."}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-2 border-t pt-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/permissions">
                  <ShieldCheck className="mr-1.5 h-4 w-4" aria-hidden="true" />
                  Permissions
                </Link>
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/settings">Settings</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader>
          <CardTitle>Browse agents</CardTitle>
          <CardDescription>Return to the live ERC-8004 registry marketplace.</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-2">
          <Button type="button" variant="outline" asChild>
            <Link href="/marketplace">
              <ArrowLeft className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Marketplace
            </Link>
          </Button>
          <Button type="button" variant="outline" asChild>
            <Link href="/compare">
              <ExternalLink className="mr-1.5 h-4 w-4" aria-hidden="true" />
              Compare
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
