"use client";

/**
 * X.6 — Hire/Activation panel (client).
 *
 * Three honest states, derived from the pure capability classifier:
 *   - NOT_ACTIVATABLE   -> disabled "Unavailable on this network"
 *   - CAPABILITY_UNKNOWN -> disabled "Activation pending"
 *   - ACTIVATABLE        -> enabled "Hire" -> requests the server-side
 *     activation endpoint (/api/activation/hire), renders the IMMUTABLE
 *     transaction/action review with exact amount + recipient, and requires
 *     EXPLICIT consent. The app NEVER signs, broadcasts, settles, or pays:
 *     after consent it stops with an honest message.
 *
 * No private keys, FACILITATOR_KEY, server credentials, or API keys reach
 * this component — the endpoint response is the public whitelist render only.
 */

import * as React from "react";
import { Button, Card, CardContent, Skeleton } from "@bnb-marketplace/ui";
import type { LeaderboardAgent } from "@/lib/eight004scan/leaderboard-types";
import { classifyAgentActivation } from "@/lib/activation/capability";

interface HireOutcome {
  classifier: string;
  available: boolean;
  agentId?: string;
  chainId?: number;
  blocked?: { stage: string; reason: string };
  review?: Record<string, string | number>;
  consent?: { consentDigest: string; reviewRef: string; state: string };
}

type PanelState =
  | { phase: "idle" }
  | { phase: "loading" }
  | { phase: "outcome"; outcome: HireOutcome }
  | { phase: "fail"; reason: string };

export function HireReviewPanel({ agent }: { agent: LeaderboardAgent }) {
  const [state, setState] = React.useState<PanelState>({ phase: "idle" });
  const [consented, setConsented] = React.useState(false);
  const [consentRecorded, setConsentRecorded] = React.useState(false);

  const classification = classifyAgentActivation({
    chainId: agent.chainId,
    isTestnet: agent.isTestnet,
  });

  const requestHire = React.useCallback(async () => {
    setState({ phase: "loading" });
    setConsentRecorded(false);
    try {
      const response = await fetch("/api/activation/hire", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ agentId: agent.agentId }),
      });
      const body = (await response.json()) as HireOutcome;
      setState({ phase: "outcome", outcome: body });
    } catch {
      setState({ phase: "fail", reason: "The activation request failed; please retry." });
    }
  }, [agent.agentId]);

  const isActionable = classification.state === "ACTIVATABLE";

  const caption = isActionable
    ? "Verified actionable activation path — review is required before any external signing."
    : classification.state === "NOT_ACTIVATABLE"
      ? `Unavailable on this network (chain ${agent.chainId}); activation runs on BNB testnet only.`
      : "Activation pending — the agent does not expose a verified actionable endpoint yet.";

  return (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Price
          </span>
          <span className="rounded-full bg-primary-foreground/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
            {classification.state === "ACTIVATABLE"
              ? "Available"
              : classification.state === "NOT_ACTIVATABLE"
                ? "Unavailable"
                : "Pending"}
          </span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{caption}</p>

        {state.phase === "idle" && (
          <Button
            type="button"
            disabled={!isActionable}
            onClick={() => void requestHire()}
            className="mt-4 h-11 w-full"
          >
            Hire
          </Button>
        )}

        {state.phase === "loading" && (
          <div className="mt-4 space-y-2">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        )}

        {state.phase === "fail" && (
          <div className="mt-4">
            <p className="text-xs text-muted-foreground">{state.reason}</p>
            <Button type="button" onClick={() => void requestHire()} className="mt-3 h-10 w-full">
              Retry
            </Button>
          </div>
        )}

        {state.phase === "outcome" && !state.outcome.available && (
          <div className="mt-4 rounded-md border border-border/70 bg-muted/40 p-3">
            <p className="text-xs font-medium text-foreground">
              {state.outcome.classifier === "ACTIVATABLE" && state.outcome.blocked
                ? `Activation unavailable — ${state.outcome.blocked.stage}: ${state.outcome.blocked.reason}`
                : "Activation unavailable."}
            </p>
            <p className="mt-1 text-[11px] text-muted-foreground">
              No real actionable endpoint is exposed by this agent.
            </p>
          </div>
        )}

        {state.phase === "outcome" && state.outcome.available && state.outcome.review && (
          <ReviewView
            review={state.outcome.review}
            consent={state.outcome.consent}
            consented={consented}
            onConsentChange={setConsented}
            consentRecorded={consentRecorded}
            onRecordConsent={() => setConsentRecorded(true)}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ReviewView({
  review,
  consent,
  consented,
  onConsentChange,
  consentRecorded,
  onRecordConsent,
}: {
  review: Record<string, string | number>;
  consent?: HireOutcome["consent"];
  consented: boolean;
  onConsentChange: (value: boolean) => void;
  consentRecorded: boolean;
  onRecordConsent: () => void;
}) {
  const rows: Array<[string, string]> = [
    ["State", String(review.state)],
    ["Chain", String(review.chainId)],
    ["Network", String(review.network)],
    ["Token", String(review.token)],
    ["Amount", `${review.amount}`],
    ["Recipient (payTo)", String(review.payTo)],
    ["Destination", String(review.destination)],
    ["Action", String(review.action)],
    ["Facilitator", String(review.facilitator)],
    ["Operator", String(review.operator)],
  ];

  return (
    <div className="mt-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        Immutable action review
      </p>
      <dl className="mt-2 space-y-1.5 text-xs">
        {rows.map(([label, value]) => (
          <div key={label} className="flex items-start justify-between gap-2">
            <dt className="shrink-0 text-muted-foreground">{label}</dt>
            <dd
              className="max-w-[60%] truncate text-right font-mono text-foreground"
              title={typeof value === "string" ? value : undefined}
            >
              {value}
            </dd>
          </div>
        ))}
        <div className="flex items-start justify-between gap-2">
          <dt className="shrink-0 text-muted-foreground">Calldata digest</dt>
          <dd
            className="max-w-[60%] truncate text-right font-mono text-foreground"
            title={typeof review.calldata === "string" ? review.calldata : undefined}
          >
            {review.calldataDigest}
          </dd>
        </div>
      </dl>

      {consent && (
        <div className="mt-4 rounded-md border border-border/70 p-3">
          <p className="text-xs font-medium text-foreground">Explicit consent required</p>
          <label className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={consented}
              onChange={(event) => onConsentChange(event.target.checked)}
              className="mt-0.5"
            />
            <span>
              I have reviewed the immutable action above and consent to its exact terms (consent
              digest{" "}
              <span className="font-mono" title={consent.consentDigest}>
                {consent.consentDigest.slice(0, 18)}…
              </span>
              ).
            </span>
          </label>
          <Button
            type="button"
            disabled={!consented || consentRecorded}
            onClick={onRecordConsent}
            className="mt-3 h-10 w-full"
          >
            {consentRecorded ? "Consent recorded" : "Record consent"}
          </Button>
          {consentRecorded && (
            <p className="mt-2 text-[11px] text-muted-foreground">
              Consent recorded (digest {consent.consentDigest}). Signing and broadcast are NOT
              performed by this app — an external signing authority is required next.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
