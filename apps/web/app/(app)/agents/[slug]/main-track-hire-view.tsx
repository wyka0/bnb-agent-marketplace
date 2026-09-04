"use client";

/**
 * X.149 — Main Track Hire (Model B) browser-wallet view.
 *
 * USER → Marketplace → verified seller/quote → explicit confirmation → user's
 * EIP-1193 wallet → ERC-8183 sequence → server receipt verification →
 * independent on-chain verification → funded-commercial-hire (active: false).
 *
 * The marketplace NEVER receives a private key; the browser wallet owns
 * nonce/gas/signing/submission. No `eth_sendRawTransaction` is ever used for
 * user transactions. Every failure is shown honestly — never ACTIVE.
 */

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, ShieldCheck, XCircle } from "lucide-react";
import { Button, Card, CardContent } from "@bnb-marketplace/ui";
import type { LeaderboardAgent } from "@/lib/eight004scan/leaderboard-types";
import {
  MAIN_TRACK_MODEL_B,
  MAIN_TRACK_USER_HIRE_CALLS,
  runMainTrackUserHireFromWallet,
  mainTrackUserHireErrorMessage,
} from "@/lib/activation/main-track-user-hire";
import type {
  MainTrackUserHirePrepareResult,
  MainTrackUserHireStep,
} from "@/lib/activation/main-track-user-hire";

type HireStepState =
  | { kind: "idle" }
  | { kind: "preparing" }
  | { kind: "review" }
  | { kind: "running"; step: MainTrackUserHireStep | null; label?: string }
  | {
      kind: "funded";
      jobId: string;
      txHashes: Record<string, string>;
      budget?: string;
      provider?: string;
      client?: string;
    }
  | { kind: "cancelled" }
  | { kind: "failed"; message: string };

const STEP_TO_STATE_LABEL: Record<MainTrackUserHireStep, string> = {
  createJob: "Creating job",
  registerJob: "Registering job",
  setBudget: "Setting budget",
  approve: "Approving escrow",
  fund: "Funding escrow",
};

function csrfCookie(): string | null {
  const match = document.cookie.match(/(?:^|;\s*)__Host-bnb_csrf=([^;]*)/);
  return match?.[1] ? decodeURIComponent(match[1]) : null;
}

type ApiEnvelope<T> = { ok: boolean; data?: T; error?: { code?: string; message: string } };

export function MainTrackHireView({ agent }: { agent: LeaderboardAgent }) {
  const [state, setState] = React.useState<HireStepState>({ kind: "idle" });
  const [plan, setPlan] = React.useState<MainTrackUserHirePrepareResult | null>(null);
  // X.225 — passive session awareness. `read` while mount loads: an
  // unauthenticated user sees the login-required state INSTEAD of a Hire
  // button that starts server negotiation. This fetch is read-only
  // (`GET /api/auth/me`) and triggers NO wallet/auth interaction by itself.
  const [authState, setAuthState] = React.useState<"checking" | "authenticated" | "guest">(
    "checking"
  );
  const busy = state.kind === "preparing" || state.kind === "running";
  // X.165 — hard re-entrancy guard. While a Hire execution is in flight, no further
  // invocation of confirmHire (double-click, re-render, re-click) may
  // start another execution. Cleared only on a terminal outcome. Deterministic, not a timeout.
  const hireInFlight = React.useRef(false);

  const review = plan?.review ?? null;

  React.useEffect(() => {
    let cancelled = false;
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ data?: { walletAddress?: unknown } }>)
      .then((body) => {
        if (cancelled) return;
        setAuthState(
          body?.data && typeof body.data.walletAddress === "string" && body.data.walletAddress
            ? "authenticated"
            : "guest"
        );
      })
      .catch(() => {
        if (!cancelled) setAuthState("guest");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function prepare() {
    if (hireInFlight.current) return;
    if (state.kind === "preparing" || state.kind === "running") return;
    // X.225 — proactive auth gate: never begin negotiation (or anything
    // wallet/blockchain-adjacent) for an unauthenticated user.
    if (authState !== "authenticated") {
      setAuthState("guest");
      return;
    }
    const csrf = csrfCookie();
    if (csrf === null) {
      setState({
        kind: "failed",
        message: "Authentication required — connect your wallet, then return.",
      });
      return;
    }
    setState({ kind: "preparing" });
    try {
      const response = await fetch("/api/activation/main-track-hire", {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
        body: JSON.stringify({ action: "prepare", agentId: agent.slug }),
      });
      const body = (await response.json()) as ApiEnvelope<MainTrackUserHirePrepareResult>;
      if (!response.ok || !body.ok || !body.data) {
        setState({
          kind: "failed",
          message: body.error?.message ?? "Hire is unavailable for this agent right now.",
        });
        return;
      }
      setPlan(body.data);
      setState({ kind: "review" });
    } catch {
      setState({
        kind: "failed",
        message: "Hire is unavailable — the server could not complete the request.",
      });
    }
  }

  async function confirmHire() {
    if (hireInFlight.current) return;
    if (!plan) return;
    hireInFlight.current = true;
    try {
      const ethereum = (
        window as unknown as {
          ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
          };
        }
      ).ethereum;
      if (!ethereum) {
        setState({
          kind: "failed",
          message: "No wallet connected — connect your EIP-1193 wallet to continue.",
        });
        return;
      }
      const csrf = csrfCookie();
      if (csrf === null) {
        setState({
          kind: "failed",
          message: "Authentication required — connect your wallet, then return.",
        });
        return;
      }

      const request = (method: string, params: unknown[]): Promise<unknown> =>
        ethereum.request({ method, params });

      const verifyStep = async (txHash: string, step: MainTrackUserHireStep) => {
        const response = await fetch("/api/activation/main-track-hire", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({ action: "receipt", agentId: agent.slug, txHash }),
        });
        const body = (await response.json()) as ApiEnvelope<{ receipt: { status: string } }>;
        const status = body.ok ? body.data?.receipt.status : "unavailable";
        void step;
        if (status === "confirmed") return { ok: true };
        if (status === "pending") return { ok: false };
        if (status === "reverted")
          return { ok: false, fatal: true, reason: "transaction reverted" };
        return { ok: false, fatal: true, reason: "receipt verification unavailable" };
      };

      setState({ kind: "running", step: null });
      const outcome = await runMainTrackUserHireFromWallet({
        request,
        plan: {
          chainId: plan.chainId,
          client: "",
          provider: plan.seller.toLowerCase(),
          budget: plan.price,
          jobId: plan.jobId,
          expiredAt: plan.expiredAt,
          calls: plan.calls,
        },
        expectations: plan.expectations,
        confirmStep: async () => true,
        verifyStep,
        receiptMaxAttempts: 40,
        receiptIntervalMs: 1500,
        // Stable per prepared plan: a concurrent re-entry with the same token is a
        // hard no-op that broadcasts nothing (X.165).
        attemptToken: `${agent.slug}:${plan.jobId}`,
        onStep: (step: MainTrackUserHireStep | null) => setState({ kind: "running", step }),
      });

      if (!outcome.ok) {
        setState({
          kind: outcome.state === "cancelled" ? "cancelled" : "failed",
          message: mainTrackUserHireErrorMessage({
            state: outcome.state,
            step: outcome.step,
            reason: outcome.reason,
          }),
        });
        return;
      }

      // Independent final verification through the marketplace (PublicNode).
      setState({ kind: "running", step: null, label: "Verifying on-chain result" });
      try {
        const response = await fetch("/api/activation/main-track-hire", {
          method: "POST",
          headers: { "Content-Type": "application/json", "x-csrf-token": csrf },
          body: JSON.stringify({
            action: "verify",
            agentId: agent.slug,
            jobId: plan.jobId,
            walletAddress: outcome.wallet,
            expectedBudget: plan.price,
          }),
        });
        const body = (await response.json()) as ApiEnvelope<{
          jobId: string;
          budget?: string;
          provider?: string;
          client?: string;
        }>;
        if (!response.ok || !body.ok) {
          setState({
            kind: "failed",
            message:
              body.error?.message ??
              "Hire could not be confirmed funded on-chain. No additional transaction was submitted.",
          });
          return;
        }
        setState({
          kind: "funded",
          jobId: body.data?.jobId ?? plan.jobId,
          txHashes: outcome.txHashes,
          budget: body.data?.budget,
          provider: body.data?.provider,
          client: body.data?.client,
        });
      } catch {
        setState({
          kind: "failed",
          message:
            "Hire verification could not be completed (network error). No additional transaction was submitted.",
        });
      }
    } finally {
      hireInFlight.current = false;
    }
  }

  const isAvailableAgent = agent.chainId === 97 && Boolean(agent.ownerAddress);
  // X.234 — chain-aware display from the agent's own chain, never a label guess.
  const agentChainLabel =
    agent.chainId === 56
      ? "BNB Mainnet"
      : agent.chainId === 97
        ? "BSC Testnet"
        : `Chain ${agent.chainId}`;

  return (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Hire
          </span>
          <span
            className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              isAvailableAgent
                ? "border-emerald-500/40 text-emerald-600 dark:text-emerald-400"
                : "border-border text-muted-foreground"
            }`}
          >
            {isAvailableAgent
              ? plan
                ? `${plan.review.price} · ${agentChainLabel}`
                : agentChainLabel
              : "Unavailable"}
          </span>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isAvailableAgent
            ? "A real ERC-8183 commercial hire. Your wallet signs and broadcasts every step; the marketplace verifies each receipt and the final funded state."
            : "Hire opens once the agent is a verified BSC Testnet (chain 97) registry agent."}
        </p>

        {state.kind === "review" && review ? (
          <dl className="mt-3 space-y-1.5 rounded-lg border border-border/60 bg-background/40 p-3 text-xs">
            <Row k="Agent" v={review.agent} />
            <Row k="Seller" v={review.provider} />
            <Row k="Price" v={review.price} />
            <Row k="Payment token" v={review.paymentToken} />
            <Row k="Chain" v={review.chain} />
            <div className="pt-1 text-muted-foreground">{review.whatWillHappen}</div>
            <div className="text-muted-foreground">
              Your wallet owns nonce, gas, signing and submission. {review.cancellationBehavior}
            </div>
            <div className="text-muted-foreground">
              Quote expires {new Date(review.expiry * 1000).toLocaleString()}.
            </div>
          </dl>
        ) : null}

        {state.kind === "running" ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground" role="status">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            {state.label ?? (state.step ? STEP_TO_STATE_LABEL[state.step] : "Preparing hire")} —
            approve each prompt in your wallet.
          </p>
        ) : null}

        {state.kind === "funded" ? (
          <div className="mt-3 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
            <div className="flex items-center gap-2 font-medium text-emerald-700 dark:text-emerald-400">
              <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> Hire funded successfully
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              You successfully activated this agent. The escrow is funded on-chain and the job is
              now with the seller.
            </p>
            <dl className="mt-2 space-y-1 text-xs">
              <Row k="Agent" v={agent.name} />
              <Row k="Job" v={`#${state.jobId}`} />
              <Row
                k="Amount"
                v={
                  state.budget
                    ? `${formatAmount(state.budget)} U escrow held`
                    : plan
                      ? `${plan.review.price} escrow held`
                      : "escrow held"
                }
              />
              <Row k="Seller" v={state.provider ?? (plan ? plan.seller : "")} />
              <Row k="Network" v={agentChainLabel} />
            </dl>
            {state.txHashes && Object.keys(state.txHashes).length > 0 ? (
              <details className="mt-2 rounded-lg border border-border/60 bg-background/40 p-2 text-xs">
                <summary className="cursor-pointer font-medium text-muted-foreground">
                  Transaction evidence ({Object.keys(state.txHashes).length} on-chain transactions)
                </summary>
                <dl className="mt-2 space-y-1">
                  {MAIN_TRACK_USER_HIRE_CALLS.filter((s) => state.txHashes[s]).map((s) => (
                    <Row key={s} k={STEP_TO_STATE_LABEL[s] ?? s} v={state.txHashes[s] ?? ""} />
                  ))}
                </dl>
              </details>
            ) : null}
            <p className="mt-2 text-xs text-muted-foreground">
              Awaiting seller fulfillment — the seller has not yet submitted the work, and this job
              is NOT completed. It is commercial escrow — not active or running. Submit/settle
              require separate authorization; if the job expires unfulfilled, the escrow is
              refundable.
            </p>
            <div className="mt-3">
              <Link
                href="/dashboard"
                className="inline-flex h-10 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                View in Dashboard
              </Link>
              <p className="mt-2 text-center text-[11px] text-muted-foreground/80">
                Track this job&apos;s live on-chain status under “Your hired agents”.
              </p>
            </div>
          </div>
        ) : null}

        {(state.kind === "cancelled" || state.kind === "failed") && "message" in state ? (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <span>{state.message}</span>
          </div>
        ) : null}

        <div className="mt-4">
          {authState === "guest" ? (
            // X.225 — proactive auth gate: no negotiation, no wallet request,
            // no switch request, no blockchain call. Only a login path.
            <div className="space-y-2">
              <div
                className="flex items-start gap-2 rounded-lg border border-border/60 bg-background/40 p-3 text-xs"
                role="note"
              >
                <ShieldCheck
                  className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"
                  aria-hidden="true"
                />
                <span>
                  Sign in to continue with this hire. A one-time wallet signature signs you in — no
                  transaction is sent at this step.
                </span>
              </div>
              <Link
                href="/login"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              >
                Sign in to hire
              </Link>
            </div>
          ) : state.kind === "review" ? (
            <Button disabled={busy} onClick={() => void confirmHire()} className="h-11 w-full">
              {plan ? `Confirm Hire — ${plan.review.price}` : "Confirm Hire"}
            </Button>
          ) : (
            <Button
              disabled={busy || authState === "checking" || !isAvailableAgent}
              onClick={() => void prepare()}
              className="h-11 w-full"
            >
              {busy ? "Preparing…" : "Hire"}
            </Button>
          )}
        </div>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/80">
          {MAIN_TRACK_MODEL_B} · The marketplace never receives your private key.
        </p>
      </CardContent>
    </Card>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{k}</dt>
      <dd className="break-all text-right font-medium text-foreground">{v}</dd>
    </div>
  );
}

function formatAmount(wei: string): string {
  try {
    const v = BigInt(wei);
    const whole = v / 10n ** 18n;
    const frac = (v % 10n ** 18n).toString().padStart(18, "0").replace(/0+$/, "");
    return frac ? `${whole}.${frac}` : `${whole}`;
  } catch {
    return wei;
  }
}
