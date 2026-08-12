"use client";

import * as React from "react";
import { CircleAlert, CircleCheck, LoaderCircle, Server, ShieldCheck } from "lucide-react";
import { Button, Card, CardContent } from "@bnb-marketplace/ui";
import {
  AAVE_AGENT_ID,
  AAVE_CHAIN_ID,
  AAVE_SAFE_ACTION,
  type ActivationResult,
} from "@/lib/activation/contract";

export function AaveActivationPreview() {
  const [result, setResult] = React.useState<ActivationResult | null>(null);
  const [pending, setPending] = React.useState(false);

  async function inspect() {
    if (pending) return;
    setPending(true);
    setResult(null);
    try {
      const response = await fetch("/api/activation/aave-preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agentId: AAVE_AGENT_ID,
          chainId: AAVE_CHAIN_ID,
          action: AAVE_SAFE_ACTION,
        }),
      });
      const body: unknown = await response.json();
      setResult(body as ActivationResult);
    } catch {
      setResult({
        state: "error",
        code: "mcp-server-error",
        message: "Activation preview is unavailable.",
      });
    } finally {
      setPending(false);
    }
  }

  return (
    <Card className="border-primary/30 bg-primary/[0.03]">
      <CardContent className="p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Server className="h-4 w-4 text-primary" aria-hidden="true" />
              <h3 className="text-sm font-semibold text-foreground">Activation Preview</h3>
            </div>
            <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
              Checks the verified Aave MCP connection and BSC support using a read-only tool. No
              financial action is called.
            </p>
          </div>
          <Button type="button" size="sm" onClick={inspect} disabled={pending} className="shrink-0">
            {pending ? (
              <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
            ) : (
              <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            )}
            {pending ? "Checking" : "Run safe preview"}
          </Button>
        </div>

        <div
          className="mt-4 rounded-md border border-border/70 bg-background/70 p-4"
          role="status"
          aria-live="polite"
        >
          {result === null ? (
            <p className="text-sm text-muted-foreground">
              Wallet signing is not enabled yet. This preview stops before approval or signing.
            </p>
          ) : result.state === "ready" ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CircleCheck className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                MCP ready · BSC chain 56 supported
              </p>
              <p className="text-xs text-muted-foreground">
                Manifest, initialization, tool discovery, and the read-only supported-chains probe
                completed. Payment was not required.
              </p>
            </div>
          ) : result.state === "payment-required" ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CircleAlert className="h-4 w-4 text-amber-500" aria-hidden="true" />
                Payment required · not paid
              </p>
              <p className="text-xs text-muted-foreground">
                Network {result.terms.network ?? "unknown"} · token{" "}
                {result.terms.token ?? "unknown"} · amount {result.terms.amount ?? "unknown"}
              </p>
              <p className="break-all text-xs text-muted-foreground">
                Pay to {result.terms.payTo ?? "unknown"} · resource{" "}
                {result.terms.resource ?? "unknown"} · expiry {result.terms.expiry ?? "unknown"}
              </p>
            </div>
          ) : result.state === "transaction-required" ? (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CircleAlert className="h-4 w-4 text-amber-500" aria-hidden="true" />
                Transaction request preview only
              </p>
              <p className="text-xs text-muted-foreground">
                {result.actions.length} ordered action{result.actions.length === 1 ? "" : "s"}{" "}
                returned. Signing is intentionally disabled in P12.
              </p>
              <ol className="space-y-2">
                {result.actions.map((action) => (
                  <li
                    key={action.order}
                    className="rounded border border-border/60 p-3 text-xs text-muted-foreground"
                  >
                    <p className="font-medium text-foreground">
                      Action {action.order}: {action.actionType ?? "unknown type"}
                    </p>
                    <p className="mt-1 break-all">
                      Chain {action.chain ?? "unknown"} · destination{" "}
                      {action.destination ?? "unknown"} · value {action.value ?? "unknown"}
                    </p>
                    {action.description ? <p className="mt-1">{action.description}</p> : null}
                    <p className="mt-1 break-all">Calldata {action.calldata ?? "not supplied"}</p>
                    {action.typedData ? (
                      <p className="mt-1">
                        Typed data: {action.typedData.primaryType ?? "unknown primary type"};
                        domain/types retained for future wallet review.
                      </p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <div className="space-y-2">
              <p className="flex items-center gap-2 text-sm font-medium text-foreground">
                <CircleAlert className="h-4 w-4 text-destructive" aria-hidden="true" />
                Preview unavailable
              </p>
              <p className="text-xs text-muted-foreground">
                {result.state === "unsupported" ? result.reason : result.message}
              </p>
            </div>
          )}
        </div>

        <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-xs text-muted-foreground">
            Review the requested action before signing. Signing is intentionally disabled in P12.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled
            title="Signing is intentionally disabled in P12"
          >
            Continue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
