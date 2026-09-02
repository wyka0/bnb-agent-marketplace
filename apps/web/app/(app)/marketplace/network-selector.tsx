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

  function confirmSwitch() {
    if (pending === null || switching) return;
    setSwitching(true);
    // The existing switch mechanism (URL routing) runs; the active network
    // updates only when the route actually changes with the new param.
    onSwitch(pending);
  }

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
              if (!isActive && !switching) setPending(network);
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
        open={pending !== null}
        onOpenChange={() => {
          // Escape/overlay/Cancel close the modal when no switch is in flight;
          // Radix returns focus to the triggering network button.
          if (!switching) setPending(null);
        }}
      >
        <ModalContent className="max-w-md">
          <ModalHeader>
            <ModalTitle>{`Switch to ${pending === "testnet" ? "Testnet" : "Mainnet"}?`}</ModalTitle>
            <ModalDescription>{`You are currently on ${currentLabel}.`}</ModalDescription>
          </ModalHeader>
          <p className="text-xs text-muted-foreground">
            {pending === "testnet"
              ? "The marketplace catalog will show agents from the 8004scan Testnet registry (chain 97)."
              : "The marketplace catalog will show agents from the 8004scan Mainnet registry (chain 56)."}
          </p>
          {switching ? (
            <p className="text-xs text-muted-foreground" role="status">
              {`Switching to ${targetLabel}…`}
            </p>
          ) : null}
          <ModalFooter>
            <Button variant="outline" onClick={() => setPending(null)} disabled={switching}>
              Cancel
            </Button>
            <Button onClick={confirmSwitch} disabled={switching}>
              {switching
                ? `Switching to ${pending === "testnet" ? "Testnet" : "Mainnet"}…`
                : `Switch to ${pending === "testnet" ? "Testnet" : "Mainnet"}`}
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
