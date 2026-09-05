"use client";

import * as React from "react";
import { LogIn, LogOut, WalletCards } from "lucide-react";
import { Button } from "@bnb-marketplace/ui";

function shortenAddress(address: string): string {
  if (address.length < 12) return address;
  return `${address.slice(0, 6)}…${address.slice(-4)}`;
}

type EthereumProvider = {
  request(args: { method: string; params?: unknown[] }): Promise<unknown>;
};

declare global {
  interface Window {
    ethereum?: EthereumProvider;
  }
}

type Identity = { walletAddress: string; chainId: number } | null;

export function AuthControls({
  compact = false,
  onAuthenticated,
}: {
  compact?: boolean;
  onAuthenticated?: () => void;
}) {
  const [identity, setIdentity] = React.useState<Identity>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void fetch("/api/auth/me", { cache: "no-store" })
      .then((response) => response.json() as Promise<{ data: Identity }>)
      .then((result) => setIdentity(result.data))
      .catch(() => undefined);
  }, []);

  async function connect() {
    setError(null);
    const provider = window.ethereum;
    if (!provider) {
      setError("Install an EVM wallet to continue.");
      return;
    }
    setBusy(true);
    try {
      const accounts = (await provider.request({ method: "eth_requestAccounts" })) as string[];
      const address = accounts[0];
      if (!address) throw new Error("No wallet account was returned.");
      const chainId = String(await provider.request({ method: "eth_chainId" }));
      if (chainId !== "0x61") {
        await provider.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x61" }],
        });
      }
      const challengeResponse = await fetch("/api/auth/nonce", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address }),
      });
      const challenge = (await challengeResponse.json()) as {
        data?: { message: string };
        error?: { message: string };
      };
      if (!challengeResponse.ok || !challenge.data)
        throw new Error(challenge.error?.message ?? "Unable to start authentication.");
      const signature = await provider.request({
        method: "personal_sign",
        params: [challenge.data.message, address],
      });
      const verifyResponse = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: challenge.data.message, signature }),
      });
      const verified = (await verifyResponse.json()) as {
        data?: Identity;
        error?: { message: string };
      };
      if (!verifyResponse.ok || !verified.data)
        throw new Error(verified.error?.message ?? "Wallet authentication failed.");
      setIdentity(verified.data);
      onAuthenticated?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Wallet authentication failed.");
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    try {
      const csrf = document.cookie.match(/(?:^|; )__Host-bnb_csrf=([^;]*)/)?.[1];
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-CSRF-Token": decodeURIComponent(csrf ?? ""),
        },
        body: "{}",
      });
      setIdentity(null);
    } finally {
      setBusy(false);
    }
  }

  if (identity) {
    return (
      <div className="flex items-center gap-2">
        <span
          role="img"
          aria-label={`Connected wallet ${identity.walletAddress}`}
          title={identity.walletAddress}
          className="inline-flex h-9 max-w-44 shrink-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm"
        >
          <WalletCards className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />
          <span className="truncate font-mono text-xs text-foreground">
            {shortenAddress(identity.walletAddress)}
          </span>
        </span>
        <Button
          type="button"
          variant="outline"
          size={compact ? "icon" : "sm"}
          onClick={() => void logout()}
          disabled={busy}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut className="h-4 w-4" aria-hidden="true" />
          {!compact && <span>Log out</span>}
        </Button>
      </div>
    );
  }

  return (
    <div>
      <Button
        type="button"
        size={compact ? "icon" : "sm"}
        onClick={() => void connect()}
        disabled={busy}
        aria-label="Connect wallet"
        title="Connect wallet"
      >
        {compact ? (
          <WalletCards className="h-4 w-4" aria-hidden="true" />
        ) : (
          <LogIn className="h-4 w-4" aria-hidden="true" />
        )}
        {!compact && <span>{busy ? "Signing..." : "Connect Wallet"}</span>}
      </Button>
      {error && (
        <p className="mt-1 max-w-64 text-xs text-destructive" role="status">
          {error}
        </p>
      )}
    </div>
  );
}
