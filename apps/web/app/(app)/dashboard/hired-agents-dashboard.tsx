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
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@bnb-marketplace/ui";
import type { HiredAgent, HiresDashboardResult } from "@/lib/dashboard/hired-agents";
import { buildErc8183ClaimRefundCall } from "@bnb-marketplace/integrations/altana";
import { createMainTrackPublicClient } from "@bnb-marketplace/integrations/altana";

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

function refundStatusCopy(state: RefundState): string {
  switch (state) {
    case "preparing":
      return "Preparing refund…";
    case "awaitingWallet":
      return "Confirm refund in your wallet…";
    case "submitting":
      return "Submitting refund…";
    case "confirmingTx":
      return "Confirming refund…";
    default:
      return "";
  }
}

type RefundState =
  "idle" | "preparing" | "awaitingWallet" | "submitting" | "confirmingTx" | "success" | "error";

/**
 * Truthful, state-dependent lifecycle notice for a FUNDED hire. The only
 * action surfaced is the one this wallet is actually entitled to, and it is
 * NEVER executed by the dashboard — every on-chain action requires a wallet
 * signature and is only explained here (X.192 hard stop).
 *
 * X.212 — the native browser confirmation dialog is replaced by this in-app
 * modal. Opening the modal performs ZERO wallet calls; the blockchain flow
 * starts only when the user clicks "Claim refund" INSIDE the modal.
 */
function ClaimRefundButton({ hire, onSuccess }: { hire: HiredAgent; onSuccess: () => void }) {
  const [state, setState] = React.useState<RefundState>("idle");
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [modalOpen, setModalOpen] = React.useState(false);
  const busy = state !== "idle" && state !== "error" && state !== "success";

  const eligible =
    hire.lifecycle.action === "claim-refund" &&
    hire.status === "FUNDED" &&
    hire.lifecycle.expired === true;

  if (!eligible) {
    return (
      <button
        type="button"
        disabled
        title="This job is not currently eligible for a refund."
        className="inline-flex h-9 shrink-0 cursor-not-allowed items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground"
      >
        Claim refund
      </button>
    );
  }

  async function handleClaimRefund() {
    if (busy) return;

    setState("preparing");
    setErrorMessage(null);

    try {
      const ethereum = (
        window as unknown as {
          ethereum?: {
            request: (args: { method: string; params?: unknown[] }) => Promise<unknown>;
          };
        }
      ).ethereum;
      if (!ethereum) {
        setErrorMessage("Connect your wallet to claim this refund.");
        setState("error");
        return;
      }

      setState("awaitingWallet");
      let walletAddress: string;
      try {
        const accounts = (await ethereum.request({ method: "eth_requestAccounts" })) as string[];
        walletAddress = accounts[0] ?? "";
        if (!walletAddress) throw new Error("No wallet account returned.");
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : String(cause);
        if (/user rejected|rejected/i.test(msg)) {
          setErrorMessage("Refund request was cancelled in your wallet.");
        } else {
          setErrorMessage("Connect your wallet to claim this refund.");
        }
        setState("error");
        return;
      }

      let chainIdHex: string;
      try {
        chainIdHex = (await ethereum.request({ method: "eth_chainId" })) as string;
      } catch {
        setErrorMessage(
          "We couldn't confirm the refund transaction. Check your wallet and try again."
        );
        setState("error");
        return;
      }

      const chainId = Number.parseInt(chainIdHex, 16);
      if (chainId !== 97) {
        try {
          await ethereum.request({
            method: "wallet_switchEthereumChain",
            params: [{ chainId: "0x61" }],
          });
        } catch (cause) {
          const msg = cause instanceof Error ? cause.message : String(cause);
          if (/user rejected/i.test(msg)) {
            setErrorMessage("Refund request was cancelled in your wallet.");
          } else {
            setErrorMessage("Switch to BNB Testnet to claim this refund.");
          }
          setState("error");
          return;
        }
      }

      setState("preparing");
      let call: ReturnType<typeof buildErc8183ClaimRefundCall>;
      try {
        call = buildErc8183ClaimRefundCall(97, BigInt(hire.jobId));
      } catch (cause) {
        setErrorMessage(
          cause instanceof Error ? cause.message : "We couldn't prepare the refund transaction."
        );
        setState("error");
        return;
      }

      setState("submitting");
      let txHash: string;
      try {
        const result = (await ethereum.request({
          method: "eth_sendTransaction",
          params: [
            { from: walletAddress, to: call.to, data: call.data, value: "0x0", chainId: "0x61" },
          ],
        })) as string;
        txHash = result;
        if (!/^0x[0-9a-fA-F]{64}$/.test(txHash))
          throw new Error("Invalid transaction hash returned.");
      } catch (cause) {
        const msg = cause instanceof Error ? cause.message : String(cause);
        if (/user rejected|rejected/i.test(msg)) {
          setErrorMessage("Refund request was cancelled in your wallet.");
        } else if (/insufficient funds|gas/i.test(msg)) {
          setErrorMessage("Your wallet does not have enough BNB for transaction gas.");
        } else if (/WrongStatus|already claimed/i.test(msg)) {
          setErrorMessage("This refund has already been claimed.");
        } else {
          setErrorMessage("The refund transaction was rejected by the contract.");
        }
        setState("error");
        return;
      }

      setState("confirmingTx");
      try {
        const publicClient = createMainTrackPublicClient();
        let receipt: { status: string } | null = null;
        for (let i = 0; i < 30; i++) {
          try {
            const r = (await publicClient.getTransactionReceipt({
              hash: txHash as `0x${string}`,
            })) as { status: string };
            receipt = r;
            break;
          } catch {
            await new Promise((resolve) => setTimeout(resolve, 2000));
          }
        }
        if (!receipt || receipt.status !== "success") {
          setErrorMessage(
            "We couldn't verify the refund transaction. Check your wallet and try again."
          );
          setState("error");
          return;
        }
      } catch {
        setErrorMessage(
          "We couldn't confirm the refund transaction. Check your wallet and try again."
        );
        setState("error");
        return;
      }

      setState("success");
      onSuccess();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : String(cause);
      if (/user rejected/i.test(msg)) {
        setErrorMessage("Refund request was cancelled in your wallet.");
      } else {
        setErrorMessage("Refund failed: " + msg + ". No funds moved.");
      }
      setState("error");
    }
  }

  if (state === "success") {
    return (
      <p className="text-xs font-medium text-emerald-600">
        Refund claimed — escrow returned. Refreshing...
      </p>
    );
  }

  const showStatusInModal = state !== "idle";
  const statusCopy = refundStatusCopy(state);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">
          This hire has expired. Escrow refund requires an on-chain wallet signature.
        </p>
        {errorMessage && !modalOpen ? (
          <p className="text-xs text-destructive">{errorMessage}</p>
        ) : null}
      </div>
      <Modal
        open={modalOpen}
        onOpenChange={(open) => {
          // Never close the modal while the wallet flow is in flight — the
          // transaction may already be submitted and must not lose its status.
          // Radix restores focus to the "Claim refund" trigger on close and
          // traps focus + supports Escape while open.
          if (!busy) setModalOpen(open);
        }}
      >
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>Claim refund</ModalTitle>
            <ModalDescription>Your expired funded job is eligible for a refund.</ModalDescription>
          </ModalHeader>
          <div className="grid gap-x-6 gap-y-1.5 text-xs sm:grid-cols-2">
            <HireRow k="Job" v={`#${hire.jobId}`} />
            <HireRow k="Amount" v={`${hire.budgetFormatted} U`} />
            <HireRow k="Network" v="BSC Testnet (chain 97)" />
            <HireRow k="Provider" v={shortAddress(hire.provider)} />
          </div>
          <p className="text-xs font-medium text-foreground">
            This action will request a blockchain transaction from your wallet.
          </p>
          {showStatusInModal ? (
            <p className="text-xs text-muted-foreground" role="status">
              {statusCopy}
            </p>
          ) : null}
          {errorMessage ? <p className="text-xs text-destructive">{errorMessage}</p> : null}
          <ModalFooter>
            <Button variant="outline" onClick={() => setModalOpen(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={() => void handleClaimRefund()} disabled={busy}>
              {busy ? statusCopy || "Processing…" : "Claim refund"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
      <button
        type="button"
        onClick={() => setModalOpen(true)}
        disabled={busy}
        title={
          busy
            ? "Refund in progress — please wait for your wallet."
            : "Refund requires a wallet signature and will be confirmed on-chain."
        }
        className="inline-flex h-9 shrink-0 items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Processing…" : "Claim refund"}
      </button>
    </div>
  );
}

function LifecycleNotice({ hire, onSuccess }: { hire: HiredAgent; onSuccess?: () => void }) {
  if (hire.lifecycle.action === "claim-refund") {
    return <ClaimRefundButton hire={hire} onSuccess={onSuccess ?? (() => {})} />;
  }
  if (hire.lifecycle.action === "reject") {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-muted-foreground">
          You are this job&apos;s evaluator. Rejection requires a wallet signature and refunds the
          escrow — it is not executed automatically.
        </p>
        <button
          type="button"
          disabled
          title="Reject requires a wallet signature and is not executed by the dashboard."
          className="inline-flex h-9 shrink-0 cursor-not-allowed items-center rounded-md border border-border bg-background px-3 text-xs font-medium text-muted-foreground"
        >
          Reject hire
        </button>
      </div>
    );
  }
  return (
    <p className="text-xs text-muted-foreground">
      Hire is funded and awaiting provider/evaluator action. No client action is available while the
      job is funded and unexpired.
    </p>
  );
}

export function HiredAgentsDashboard() {
  const [feed, setFeed] = React.useState<Feed | null>(null);

  const refresh = React.useCallback(() => {
    void fetch("/api/dashboard/hires", { cache: "no-store" })
      .then((response) => response.json() as Promise<Feed>)
      .then((body) => setFeed(body))
      .catch(() => setFeed({ ok: false }));
  }, []);

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
                    {hire.expiredAt ? (
                      <HireRow
                        k="Expires"
                        v={new Date(Number(hire.expiredAt) * 1000).toLocaleString()}
                      />
                    ) : null}
                  </dl>
                  <div className="mt-3 border-t border-border/50 pt-3">
                    <LifecycleNotice hire={hire} onSuccess={refresh} />
                  </div>
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
