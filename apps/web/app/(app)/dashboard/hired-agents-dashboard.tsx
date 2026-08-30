"use client";

/**
 * X.168 — Dashboard funded-hire visibility (client view).
 *
 * Loads the read-only `/api/dashboard/hires` feed and renders:
 *
 *   - stat cards: Active agents (Model A semantics), Funded hires (Model B),
 *     Total value, Net P&L — values come from the verified server feed, never
 *     invented client-side.
 *   - "Your hired agents": each FUNDED commercial hire with a FUNDED badge
 *     (never ACTIVE/Running/Managed/Autonomous) and its real job/amount/
 *     network/provider.
 *   - the existing empty state when there is no wallet or no funded/active hire.
 */

import * as React from "react";
import Link from "next/link";
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
} from "@bnb-marketplace/ui";
import type { HiredAgent, HiresDashboardResult } from "@/lib/dashboard/hired-agents";

type Feed = { ok: boolean; data?: HiresDashboardResult };

function HireRow({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd className="break-all text-right font-medium text-foreground">{v}</dd>
    </div>
  );
}

function StatCard({
  label,
  value,
  description,
}: {
  label: string;
  value: string;
  description: string;
}) {
  return (
    <Card>
      <CardHeader>
        <CardDescription>{label}</CardDescription>
        <CardTitle className="text-2xl">{value}</CardTitle>
        <CardDescription className="text-xs">{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

function typeLabel(type: HiredAgent["type"]): string {
  return type === "commercial-hire" ? "Commercial Hire" : type;
}

function shortAddress(address: string): string {
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

export function HiredAgentsDashboard() {
  const [feed, setFeed] = React.useState<Feed | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/dashboard/hires", { cache: "no-store" })
      .then((response) => response.json() as Promise<Feed>)
      .then((body) => {
        if (!cancelled) setFeed(body);
      })
      .catch(() => {
        if (!cancelled) setFeed({ ok: false });
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const data = feed?.ok && feed.data ? feed.data : null;
  const failed = feed !== null && feed.data === undefined;
  const hires = data?.hires ?? [];
  const showEmpty = failed || data === null || hires.length === 0;

  return (
    <>
      <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Active agents"
          value={String(data?.activeAgents ?? 0)}
          description="Verified ACTIVE managed sessions only."
        />
        <StatCard
          label="Funded hires"
          value={String(data?.fundedHires ?? 0)}
          description="FUNDED ERC-8183 commercial escrow (Model B)."
        />
        <StatCard
          label="Total value"
          value={data?.totalValue ?? "0.00 BNB"}
          description="BNB portfolio value; funded escrow is held in $U."
        />
        <StatCard
          label="Net P&L"
          value={data?.netPnl ?? "Not available"}
          description="No performance dataset exists — not a zero-loss result."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Your hired agents</CardTitle>
          <CardDescription>
            {hires.length > 0
              ? "Funded commercial hires shown with their real on-chain escrow state."
              : "Agents with a verified activation will appear here with their real session and performance data."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {showEmpty ? (
            failed ? (
              <EmptyState
                title="Hired agents unavailable"
                description="Your hired agents could not be verified right now. No status was assumed."
                action={
                  <button
                    type="button"
                    onClick={() => {
                      setFeed(null);
                      window.location.reload();
                    }}
                    className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Try again
                  </button>
                }
              />
            ) : (
              <EmptyState
                title="No agents hired yet"
                description="Explore the marketplace to discover and hire your first agent."
                action={
                  <Link
                    href="/marketplace"
                    className="inline-flex h-10 items-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                  >
                    Browse marketplace
                  </Link>
                }
              />
            )
          ) : (
            <ul className="space-y-3">
              {hires.map((hire) => (
                <li key={hire.jobId} className="rounded-lg border border-border/60 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{hire.agentName ?? "Hired agent"}</p>
                      <p className="text-xs text-muted-foreground">Type: {typeLabel(hire.type)}</p>
                    </div>
                    <Badge variant="success">FUNDED</Badge>
                  </div>
                  <dl className="mt-3 grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
                    <HireRow k="Job" v={`#${hire.jobId}`} />
                    <HireRow k="Amount" v={`${hire.budgetFormatted} U`} />
                    <HireRow k="Network" v="BSC Testnet (chain 97)" />
                    <HireRow k="Provider" v={shortAddress(hire.provider)} />
                  </dl>
                  {hire.identityUnavailable ? (
                    <p className="mt-2 text-[11px] text-muted-foreground/80">
                      Agent identity could not be confirmed from the registry; the funded on-chain
                      state is authoritative.
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </>
  );
}
