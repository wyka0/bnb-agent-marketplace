"use client";

/**
 * X.216 — symmetric Mainnet/Testnet discovery-network selector.
 *
 * A pure 8004scan DISCOVERY-NETWORK selector for the marketplace catalog.
 * It changes ONLY which registry reads the marketplace page performs
 * (`?network=mainnet|testnet` URL param → server `scope`). It is NOT a
 * wallet network switcher and has NO connection to the ERC-8183 commercial
 * hire chain (chain 97 stays the hire chain regardless of this selector).
 *
 * Symmetric confirm-first UX (matches the 8004scan reference):
 *   current mainnet → click Testnet → modal "Switch to Testnet?"
 *   current testnet → click Mainnet → modal "Switch to Mainnet?"
 *
 * Opening the modal performs ZERO wallet calls and ZERO blockchain writes.
 * Cancel keeps the current network. Confirm routes with the new param —
 * the selected network becomes active only when the route actually changes.
 *
 * X.243 — switch lifecycle correctness. The URL routing is fire-and-forget
 * (`router.replace` returns void and the router swallows navigation
 * failures), so the modal previously had NO path that ever cleared its
 * loading state ("Switching to Testnet…" hung forever). The lifecycle is
 * now explicit and bounded:
 *   SUCCESS — an effect closes the modal the moment the scope prop actually
 *   becomes the pending target (the route committed the new network).
 *   FAILURE — a bounded fallback (well beyond the 8s upstream read bound)
 *   clears the loading state and shows a truthful error; the URL/scope
 *   truth never changed, so the app stays consistent on the old network.
 * The timeout is the SECONDARY safety net only; the primary completion
 * signal is the state lifecycle itself (scope change → modal closes).
 *
 * Reuses the shared Modal/Button primitives — no new dependency.
 */

import * as React from "react";
import {
  Button,
  Modal,
  ModalContent,
  ModalDescription,
  ModalFooter,
  ModalHeader,
  ModalTitle,
} from "@bnb-marketplace/ui";
import {
  MARKETPLACE_NETWORK_LABELS,
  parseMarketplaceNetworkScope,
  type MarketplaceNetworkScope,
} from "@/lib/eight004scan/marketplace";

/**
 * X.243 — upper bound on the in-flight switch wait, as the SECONDARY
 * failure path (the primary close is the scope-change effect). Chosen
 * strictly above the bounded upstream read timeout (8s per request) so a
 * healthy-but-slow switch is never falsely failed; only a genuinely stuck
 * navigation (router swallowed the failure) trips it.
 */
const SWITCH_FALLBACK_MS = 15_000;

/** The two selectable networks (scope "all" presents as Mainnet active). */
const SELECTABLE = ["mainnet", "testnet"] as const;

function networkParam(scope: MarketplaceNetworkScope): string {
  // "all" is the default scope and stays out of the URL (clean canonical URL);
  // an explicit selection always persists in the URL.
  return scope === "all" ? "" : scope;
}

export function NetworkSelector({
  scope,
  onSwitch,
}: {
  scope: MarketplaceNetworkScope;
  /** Executes the existing network-switch mechanism (URL param routing). */
  onSwitch: (next: "mainnet" | "testnet") => void;
}) {
  // The "current" network for UX purposes: an unscoped ("all") catalog is
  // presented as Mainnet active — the default registry view.
  const current: "mainnet" | "testnet" =
    parseMarketplaceNetworkScope(scope) === "testnet" ? "testnet" : "mainnet";
  const [pending, setPending] = React.useState<"mainnet" | "testnet" | null>(null);
  const [switching, setSwitching] = React.useState(false);
  // X.243 — truthful switch-failure surface (cleared on next attempt/close).
  const [switchError, setSwitchError] = React.useState<string | null>(null);

  function confirmSwitch() {
    if (pending === null || switching) return;
    setSwitching(true);
    setSwitchError(null);
    // The existing switch mechanism (URL routing) runs; the active network
    // updates only when the route actually changes with the new param.
    onSwitch(pending);
  }

  // X.243 — PRIMARY completion path: the switch "succeeds" exactly when the
  // scope prop (server/URL truth) becomes the pending target. Closes the
  // modal, clears loading, and confirms the catalog below now belongs to the
  // newly selected network (same render that delivers the new catalog).
  React.useEffect(() => {
    if (!switching || pending === null) return;
    if (current === pending) {
      setSwitching(false);
      setPending(null);
      setSwitchError(null);
    }
  }, [switching, pending, current]);

  // X.243 — SECONDARY failure path: the router swallows navigation failures
  // (fire-and-forget replace; a rejected RSC fetch leaves the URL unchanged
  // and surfaces nothing). If the scope never became the pending target
  // within the bound, stop waiting and report truthfully. The application
  // remains consistent: `current` still reflects the unchanged URL scope,
  // so the catalog and selector agree on the OLD network. The timer reads
  // `pending` only for the message; it must outlive target changes within a
  // single in-flight switch (dep list is intentionally just [switching]).
  React.useEffect(() => {
    if (!switching) return;
    const timer = setTimeout(() => {
      setSwitching(false);
      setPending(null);
      setSwitchError(
        `The switch to ${pending === "testnet" ? "Testnet" : "Mainnet"} did not complete. The catalog still shows the previously selected network — try again.`
      );
    }, SWITCH_FALLBACK_MS);
    return () => clearTimeout(timer);
  }, [switching]);

  // X.243 — never carry a stale error across a new attempt (cleared above)
  // or across an unmount-triggered scope change.

  const targetLabel = pending ? MARKETPLACE_NETWORK_LABELS[pending] : "";
  const currentLabel = MARKETPLACE_NETWORK_LABELS[current];

  return (
    <div
      role="group"
      aria-label="Discovery network"
      className="inline-flex overflow-hidden rounded-md border border-border bg-background"
    >
      {SELECTABLE.map((network) => {
        const isActive = current === network;
        return (
          <button
            key={network}
            type="button"
            aria-pressed={isActive}
            disabled={switching}
            onClick={() => {
              if (!isActive && !switching) {
                setSwitchError(null);
                setPending(network);
              }
            }}
            title={
              isActive
                ? `Currently browsing ${MARKETPLACE_NETWORK_LABELS[network]}.`
                : `Switch the marketplace catalog to ${MARKETPLACE_NETWORK_LABELS[network]}.`
            }
            className={
              "inline-flex h-9 items-center px-3 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 " +
              (isActive
                ? "bg-primary text-primary-foreground"
                : "bg-background text-foreground hover:bg-accent hover:text-accent-foreground")
            }
          >
            {network === "mainnet" ? "Mainnet" : "Testnet"}
          </button>
        );
      })}

      {/* Symmetric confirmation modal (shared Radix-based primitive). */}
      <Modal
        open={pending !== null || switchError !== null}
        onOpenChange={() => {
          // Escape/overlay/Cancel close the modal when no switch is in flight;
          // Radix returns focus to the triggering network button.
          if (!switching) {
            setPending(null);
            setSwitchError(null);
          }
        }}
      >
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>
              {pending !== null
                ? `Switch to ${pending === "testnet" ? "Testnet" : "Mainnet"}?`
                : "Network switch failed"}
            </ModalTitle>
            <ModalDescription>{`You are currently on ${currentLabel}.`}</ModalDescription>
          </ModalHeader>
          {pending !== null ? (
            <p className="text-xs text-muted-foreground">
              {pending === "testnet"
                ? "The marketplace catalog will show agents from the 8004scan Testnet registry (chain 97)."
                : "The marketplace catalog will show agents from the 8004scan Mainnet registry (chain 56)."}
            </p>
          ) : null}
          {switching ? (
            <p className="text-xs text-muted-foreground" role="status">
              {`Switching to ${targetLabel}…`}
            </p>
          ) : null}
          {switchError !== null && !switching ? (
            <p className="text-xs text-destructive" role="alert">
              {switchError}
            </p>
          ) : null}
          <ModalFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPending(null);
                setSwitchError(null);
              }}
              disabled={switching}
            >
              Cancel
            </Button>
            <Button onClick={confirmSwitch} disabled={switching || pending === null}>
              {switching
                ? `Switching to ${pending === "testnet" ? "Testnet" : "Mainnet"}…`
                : pending !== null
                  ? `Switch to ${pending === "testnet" ? "Testnet" : "Mainnet"}`
                  : "Retry"}
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>
    </div>
  );
}

/** Serialize the network scope into the marketplace URL param form. */
export function networkScopeParam(scope: MarketplaceNetworkScope): string {
  return networkParam(scope);
}
