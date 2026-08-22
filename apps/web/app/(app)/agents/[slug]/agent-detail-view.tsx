"use client";

/**
 * Agent Details — Sprint 2C "Agent Details Framework".
 *
 * Implements docs/ux/Agent-Details-UX-Blueprint.md exactly. Assembles ONLY
 * existing Design System, Agent Card System, badges, loading + empty states and
 * tokens. No data layer, no API, no 8004scan, no Altana, no wallet.
 *
 * Because no registry data exists yet, every live value renders as an honest
 * pending state — a Skeleton, a "Pending" badge, or an em-dash "—". No fake
 * blockchain data, scores, prices, reviews, permissions, or metrics are shown.
 * Each block maps to a future 8004scan / Altana integration point (see comments).
 *
 * Layout (blueprint §4/§5/§6):
 *   Desktop ≥1280  — two columns: main content (left) + sticky trust rail (right)
 *   Tablet 768–1023 — single column; rail blocks flow inline; sticky Hire bar
 *   Mobile <768     — single column; persistent bottom Hire bar
 */

import * as React from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  CalendarClock,
  Clock3,
  Copy,
  Database,
  Droplets,
  Gauge,
  GitCompareArrows,
  Network,
  Share2,
  ShieldCheck,
  Sparkles,
  Star,
  TrendingUp,
  User,
} from "lucide-react";
import type { TermixReputationResult } from "@/lib/termix/reputation";
import type {
  PancakeSwapIntelligenceData,
  PancakeSwapIntelligencePool,
} from "@/lib/pancakeswap/intelligence";
import {
  PANCAKESWAP_SECTION_TITLE,
  PANCAKESWAP_SECTION_DESCRIPTION,
  PANCAKESWAP_SOURCE_LABEL,
  PANCAKESWAP_VOLUME_LABEL,
  PANCAKESWAP_VOLUME_NOTE,
  PANCAKESWAP_FEE_TIER_LABEL,
  PANCAKESWAP_APR_NOTE,
  PANCAKESWAP_READ_ONLY_DISCLAIMER,
  pancakeSwapFailureCopy,
  displayPools,
  isPancakeSwapReady,
  formatUsd,
  formatCount,
  formatFeeTier,
  formatSampleScope,
} from "./agent-detail-pancakeswap.copy";
import {
  // layout
  MarketplaceContainer,
  SectionDivider,
  // marketplace badges (state-driven)
  MarketplaceVerificationBadge,
  RegistryBadge,
  BuilderBadge,
  ReputationBadge,
  StatusBadge,
  ProtocolBadge,
  // loading / empty
  WaitingHint,
  // primitives
  Avatar,
  Button,
  Card,
  CardContent,
  Skeleton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@bnb-marketplace/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { titleFromSlug } from "@/lib/agent-slug";
import type { LeaderboardAgent } from "@/lib/eight004scan/leaderboard-types";
import { chainLabelForId } from "@/lib/eight004scan/card";
import { AAVE_AGENT_ID } from "@/lib/activation/contract";
import { AaveActivationPreview } from "./aave-activation-preview";
import { HireReviewPanel } from "./hire-review-panel";
import { classifyAgentActivation } from "@/lib/activation/capability";

/* ------------------------------------------------------------------ *
 * Honest primitives — the em-dash and pending helpers used everywhere.
 * No live value is ever fabricated; it is either a Skeleton, a Pending
 * chip, or an em-dash with a "pending ERC-8004 Registry sync" meaning.
 * ------------------------------------------------------------------ */

/** Em-dash placeholder for a not-yet-available scalar value. */
function Dash({ label }: { label?: string }) {
  return (
    <span
      className="text-muted-foreground/70"
      aria-label={label ?? "Not available — pending ERC-8004 Registry sync"}
    >
      —
    </span>
  );
}

/** A small "Pending" chip reused where a badge slot awaits registry data. */
function Pending({ text = "Pending", className }: { text?: string; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary ${className ?? ""}`}
    >
      <Clock3 className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
      {text}
    </span>
  );
}

/** Section shell — every content block is a titled <section> for a11y (§18). */
function Section({
  id,
  title,
  hint,
  description,
  children,
}: {
  id: string;
  title: string;
  hint?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={`${id}-heading`} className="scroll-mt-24">
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <h2
          id={`${id}-heading`}
          className="text-sm font-semibold uppercase tracking-wide text-foreground"
        >
          {title}
        </h2>
        {hint}
      </div>
      {description ? <p className="mb-3 text-sm text-muted-foreground">{description}</p> : null}
      {children}
    </section>
  );
}

/** A metric tile — value area is a Skeleton while pending (never 0/fake). */
function MetricTile({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-4">
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        {label}
      </div>
      <div className="mt-2">
        <Skeleton className="h-6 w-20 translate-y-0.5" />
        <p className="mt-1.5 text-xs text-muted-foreground/70">Pending ERC-8004 Registry sync</p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ *
 * Static permission rows (structure only — allow/deny/— arrive with the
 * Altana scope integration; every value is shown honestly as pending).
 * ------------------------------------------------------------------ */

const PERMISSION_ROWS = [
  { action: "Transfer assets", scope: "Agent wallet" },
  { action: "Swap tokens", scope: "Approved routers" },
  { action: "Bridge assets", scope: "Cross-chain" },
  { action: "Call contracts", scope: "Whitelisted only" },
  { action: "Manage allowances", scope: "Per-protocol" },
] as const;

const PERFORMANCE_METRICS = [
  { icon: TrendingUp, label: "Tasks completed" },
  { icon: Gauge, label: "Success rate" },
  { icon: Database, label: "Uptime (30d)" },
  { icon: Clock3, label: "Avg. latency / task" },
] as const;

/* ------------------------------------------------------------------ *
 * TermiX AACP Reputation (read-only) — a SEPARATE signal from 8004scan.
 *
 * This is an additional, independent on-chain reputation source (TermiX
 * AACP, BSC Testnet chain 97). It is intentionally NOT merged with the
 * 8004scan registry reputation and NO composite score is computed. When no
 * deterministic ERC-8004 → AACP identity mapping exists (the default for a
 * slug-only route), the honest "unavailable for this identity" state renders.
 * The result is fetched server-side and passed in as a prop; the browser
 * never calls the TermiX backend directly.
 * ------------------------------------------------------------------ */

/** Human-readable copy for each honest non-available TermiX state. */
const TERMIX_FAILURE_COPY: Record<string, string> = {
  "not-found": "TermiX reputation data is not available for this agent.",
  unsupported: "TermiX reputation is unavailable for this agent identity.",
  "network-error": "TermiX reputation is temporarily unavailable.",
  "server-error": "TermiX reputation is temporarily unavailable.",
  "rate-limited": "TermiX reputation is temporarily unavailable.",
  unauthorized: "TermiX reputation is unavailable for this agent identity.",
  forbidden: "TermiX reputation is unavailable for this agent identity.",
  "bad-request": "TermiX reputation is unavailable for this agent identity.",
  error: "TermiX reputation is temporarily unavailable.",
};

const TERMIX_ANOMALY_LABEL: Record<string, string> = {
  "overturn-count": "Overturn count",
  "borderline-count": "Borderline count",
  "llm-deviation": "LLM deviation",
  "extreme-pass-rate": "Extreme pass rate",
};

/** A single TermiX stat cell (label + value). Renders a genuine 0 verbatim. */
function TermixStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border/60 bg-background/40 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

/**
 * One pool card (read-only market intelligence). TVL is computed from on-chain
 * reserves × official USD prices; 24h volume is honestly unavailable on-chain
 * and renders as "—" (never a fabricated 0); APR/APY is never fabricated.
 */
function PoolCard({ pool, index }: { pool: PancakeSwapIntelligencePool; index: number }) {
  return (
    <li className="rounded-lg border border-border/60 bg-background/40 p-3.5">
      <div className="flex min-w-0 items-center justify-between gap-2">
        <p className="truncate text-sm font-semibold text-foreground">{pool.symbol}</p>
        <span className="shrink-0 text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
          #{index + 1}
        </span>
      </div>
      <div className="mt-2.5 grid grid-cols-2 gap-x-3 gap-y-1.5 text-xs">
        <div className="min-w-0">
          <span className="text-muted-foreground">TVL (est.)</span>
          <p
            className="mt-0.5 truncate font-medium tabular-nums text-foreground"
            title={pool.tvlUsd !== null ? `$${pool.tvlUsd.toFixed(2)}` : undefined}
          >
            {formatUsd(pool.tvlUsd)}
          </p>
        </div>
        <div className="min-w-0">
          {/* honest label: on-chain reserves provide NO volume — shown as "—" */}
          <span className="text-muted-foreground">{PANCAKESWAP_VOLUME_LABEL}</span>
          <p className="mt-0.5 truncate font-medium tabular-nums text-foreground">—</p>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground">1 {pool.token0Symbol} (USD)</span>
          <p className="mt-0.5 truncate font-medium tabular-nums text-foreground">
            {formatUsd(pool.token0PriceUsd)}
          </p>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground">1 {pool.token1Symbol} (USD)</span>
          <p className="mt-0.5 truncate font-medium tabular-nums text-foreground">
            {formatUsd(pool.token1PriceUsd)}
          </p>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground">{PANCAKESWAP_FEE_TIER_LABEL}</span>
          <p className="mt-0.5 truncate font-medium tabular-nums text-foreground">
            {formatFeeTier(pool.feeTier)}
          </p>
        </div>
        <div className="min-w-0">
          <span className="text-muted-foreground">Reserves</span>
          <p
            className="mt-0.5 truncate font-medium tabular-nums text-foreground"
            title={`${pool.token0Symbol}: ${formatCount(pool.reserve0)} · ${pool.token1Symbol}: ${formatCount(pool.reserve1)}`}
          >
            {formatCount(pool.reserve0)} {pool.token0Symbol} / {formatCount(pool.reserve1)}{" "}
            {pool.token1Symbol}
          </p>
        </div>
      </div>
      {/* No APR/APY is fabricated — on-chain data provides neither. */}
      <p className="mt-2 text-[10px] text-muted-foreground/80">
        {PANCAKESWAP_APR_NOTE} · {PANCAKESWAP_VOLUME_NOTE}
      </p>
    </li>
  );
}

/**
 * PancakeSwap Market Intelligence block. `data` is a discriminated server result;
 * every non-ready path renders an honest empty/error state (never a fake row).
 * The read-only disclaimer and the sample scope are mandatory copy.
 */
function PancakeSwapPoolSection({ data }: { data: PancakeSwapIntelligenceData }) {
  const pools = displayPools(data, 5);

  return (
    <Section
      id="pancakeswap-pools"
      title={PANCAKESWAP_SECTION_TITLE}
      hint={
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          <Droplets className="h-3.5 w-3.5" aria-hidden="true" />
          {PANCAKESWAP_SOURCE_LABEL}
        </span>
      }
      description={PANCAKESWAP_SECTION_DESCRIPTION}
    >
      {isPancakeSwapReady(data) ? (
        <>
          <ul className="grid gap-3 sm:grid-cols-2" aria-label="PancakeSwap pools">
            {pools.map((p, i) => (
              <PoolCard key={p.poolId} pool={p} index={i} />
            ))}
          </ul>
          <p className="mt-3 text-[11px] text-muted-foreground">{formatSampleScope(data.sample)}</p>
        </>
      ) : (
        <div
          className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 p-8 text-center"
          role="status"
        >
          <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Droplets className="h-5 w-5" aria-hidden="true" />
          </div>
          <p className="max-w-md text-sm text-muted-foreground">{pancakeSwapFailureCopy(data)}</p>
        </div>
      )}
      <p className="mt-3 text-[11px] text-muted-foreground/80">
        {PANCAKESWAP_READ_ONLY_DISCLAIMER}
      </p>
    </Section>
  );
}

/** The source label chip — always identifies TermiX AACP distinctly. */
function TermixSourceLabel() {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
      <Network className="h-3.5 w-3.5" aria-hidden="true" />
      TermiX AACP · Read-only on-chain reputation
    </span>
  );
}

/**
 * TermiX Reputation block. `result` is undefined only if the server chose not to
 * attempt a lookup at all; every real path passes a discriminated result.
 */
function TermixReputationSection({
  result,
  formatTime,
}: {
  result: TermixReputationResult | undefined;
  formatTime: (iso: string) => string;
}) {
  // Available state — real data.
  if (result && result.ok) {
    const r = result.data;
    return (
      <Section
        id="termix-reputation"
        title="TermiX Reputation"
        hint={<TermixSourceLabel />}
        description="An additional, independent on-chain reputation signal from TermiX AACP (BSC Testnet). Shown separately from the 8004scan registry score — the two are never combined."
      >
        <Card className="border-border/70">
          <CardContent className="p-5">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  TermiX Reputation Score
                </p>
                <div className="mt-1 flex items-baseline gap-1.5">
                  {/* A genuine API 0 is shown verbatim (0 is a real score, not "missing"). */}
                  <span className="text-3xl font-bold tabular-nums text-foreground">{r.score}</span>
                  <span className="text-sm text-muted-foreground">/ 100</span>
                </div>
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-border/60 bg-background/40 px-2.5 py-1 font-mono text-xs text-muted-foreground">
                agentId {r.agentId} · chain {r.chainId}
              </span>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
              <TermixStat label="Completed jobs" value={r.completedJobs} />
              <TermixStat label="Total jobs" value={r.totalJobs} />
              <TermixStat label="On-time jobs" value={r.onTimeJobs} />
              <TermixStat label="Approved jobs" value={r.approvedJobs} />
              <TermixStat label="Dispute wins" value={r.disputeWins} />
              <TermixStat label="Anomaly flags" value={r.anomalyFlags} />
            </div>

            {r.anomalies.length > 0 ? (
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <span className="text-xs text-muted-foreground">Flags:</span>
                {r.anomalies.map((a) => (
                  <span
                    key={a}
                    className="inline-flex items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400"
                  >
                    {TERMIX_ANOMALY_LABEL[a] ?? a}
                  </span>
                ))}
              </div>
            ) : null}

            {r.evaluatorMetrics ? (
              <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-1.5 border-t border-border/60 pt-3 text-xs sm:grid-cols-4">
                <div>
                  <dt className="text-muted-foreground">Overturns</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {r.evaluatorMetrics.overturnCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Borderline</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {r.evaluatorMetrics.borderlineCount}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Avg dev / LLM</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {r.evaluatorMetrics.avgDevFromLLM}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Pass rate</dt>
                  <dd className="font-medium tabular-nums text-foreground">
                    {r.evaluatorMetrics.passRate}
                  </dd>
                </div>
              </dl>
            ) : null}

            <p className="mt-4 inline-flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <CalendarClock className="h-3 w-3" aria-hidden="true" />
              Retrieved {formatTime(r.retrievedAt)}
            </p>
          </CardContent>
        </Card>
      </Section>
    );
  }

  // Non-available states — honest, never a fabricated 0.
  const reason = result?.ok === false ? result.reason : "unsupported";
  const copy = TERMIX_FAILURE_COPY[reason] ?? TERMIX_FAILURE_COPY.unsupported;
  return (
    <Section
      id="termix-reputation"
      title="TermiX Reputation"
      hint={<TermixSourceLabel />}
      description="An additional, independent on-chain reputation signal from TermiX AACP (BSC Testnet). Shown separately from the 8004scan registry score — the two are never combined."
    >
      <div
        className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 p-8 text-center"
        role="status"
      >
        <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-muted text-muted-foreground">
          <Network className="h-5 w-5" aria-hidden="true" />
        </div>
        <p className="max-w-md text-sm text-muted-foreground">{copy}</p>
      </div>
    </Section>
  );
}

export function AgentDetailView({
  slug,
  agent,
  termix,
  pancakeswap,
}: {
  slug: string;
  /** Live ERC-8004 registry record (undefined for slug-only / unresolved routes). */
  agent?: LeaderboardAgent;
  /** Server-fetched TermiX reputation result (undefined = no identity attempted). */
  termix?: TermixReputationResult;
  /** Server-fetched PancakeSwap pools result (readonly market/liquidity). */
  pancakeswap: PancakeSwapIntelligenceData;
}) {
  const router = useRouter();
  // Live registry record name, or a Title Case display title derived only from
  // the route slug (shared helper — no fabricated registry data). The raw slug
  // is never changed; the registry "Reference" field below still shows it.
  const title = agent?.name ?? titleFromSlug(slug);
  const activation = agent
    ? classifyAgentActivation({ chainId: agent.chainId, isTestnet: agent.isTestnet })
    : null;

  /* ---- Date formatting (client-side; server value `retrievedAt` is ISO) ---- */
  const formatTime = React.useCallback((iso: string) => {
    try {
      return new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(iso));
    } catch {
      return iso;
    }
  }, []);

  /* ---- Interactive-only UI state (no persistence, no data) ---- */
  const [favorite, setFavorite] = React.useState(false);
  const [copied, setCopied] = React.useState(false);

  /**
   * Back navigation (Sprint 2D §4): use browser history when the user arrived
   * from within the app; otherwise fall back to /marketplace. Never navigate to
   * Home. Detected via history.length (a direct load / share link has a short
   * history stack).
   */
  const handleBack = React.useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/marketplace");
    }
  }, [router]);

  const onShare = React.useCallback(() => {
    // Copies the current URL — a browser action, not a blockchain call.
    if (typeof navigator !== "undefined" && navigator.clipboard && typeof window !== "undefined") {
      navigator.clipboard.writeText(window.location.href).then(
        () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1500);
        },
        () => undefined
      );
    }
  }, []);

  /* ------------------------------------------------------------------ *
   * Trust strip — order fixed by blueprint §8 (frozen). All states are the
   * honest "awaiting registry" states: Verification pending, Risk unknown →
   * shown via the neutral tokens; Registry waiting; Reputation unrated;
   * Builder unknown; Status coming-soon. No value is faked.
   * ------------------------------------------------------------------ */
  const trustStrip = (
    <div
      className="flex flex-wrap items-center gap-x-2 gap-y-3"
      aria-label="Trust and verification status"
    >
      <MarketplaceVerificationBadge state={agent ? agent.verification : "pending"} />
      <BuilderBadge state="unknown-builder" />
      <Pending text="Risk pending" />
      <RegistryBadge state={agent ? "synced" : "waiting"} />
      <ReputationBadge state="unknown" />
      <StatusBadge state="coming-soon" />
    </div>
  );

  /* ---- Right-rail blocks (reused inline on tablet/mobile) ---- */
  const hireCard = agent ? (
    <HireReviewPanel agent={agent} />
  ) : (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="flex items-baseline justify-between gap-2">
          <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Price
          </span>
          <StatusBadge state="coming-soon" size="sm" />
        </div>
        <div className="mt-1 flex items-baseline gap-1.5">
          <span className="text-2xl font-bold tracking-tight text-foreground">
            <Dash label="Pricing pending ERC-8004 Registry integration" />
          </span>
          <span className="text-sm text-muted-foreground">/ hire</span>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          Agent data will appear automatically once the ERC-8004 Registry record is resolved.
        </p>

        <button
          type="button"
          disabled
          title="Hire requires a resolved registry agent"
          className="mt-4 inline-flex h-11 w-full items-center justify-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground transition-all disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          Hire
          <span className="rounded-full bg-primary-foreground/15 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
            Unavailable
          </span>
        </button>
        <p className="mt-2 text-center text-[11px] text-muted-foreground/80">
          Hiring opens once the agent is live in the ERC-8004 Registry.
        </p>
      </CardContent>
    </Card>
  );

  const builderCard = (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <User className="h-3.5 w-3.5" aria-hidden="true" />
          Builder
        </div>
        <div className="mt-2 flex items-center gap-3">
          <Avatar fallback="?" size="sm" className="rounded-lg" />
          <div className="min-w-0">
            <p className="truncate text-sm font-medium text-foreground">
              <Dash label="Builder pending" />
            </p>
            <p className="truncate text-xs text-muted-foreground">
              Awaiting ERC-8004 Registry owner
            </p>
          </div>
        </div>
        <div className="mt-3">
          <BuilderBadge state="unknown-builder" size="sm" />
        </div>
      </CardContent>
    </Card>
  );

  const registryCard = (
    <Card className="border-border/70">
      <CardContent className="p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            Registry record
          </div>
          <RegistryBadge state={agent ? "synced" : "waiting"} size="sm" />
        </div>
        {agent ? (
          <>
            <dl className="mt-3 space-y-2 text-xs">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="truncate font-mono text-foreground" title={agent.slug}>
                  {agent.slug}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Chain</dt>
                <dd className="truncate text-foreground" title={String(agent.chainId)}>
                  {chainLabelForId(agent.chainId)}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Token ID</dt>
                <dd className="font-mono text-foreground">{agent.tokenId}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Contract</dt>
                <dd
                  className="max-w-[11rem] truncate font-mono text-foreground"
                  title={agent.contractAddress ?? undefined}
                >
                  {agent.contractAddress ?? <Dash label="Contract not provided" />}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Owner</dt>
                <dd
                  className="max-w-[11rem] truncate font-mono text-foreground"
                  title={agent.ownerAddress ?? ""}
                >
                  {agent.ownerAddress}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted-foreground">Last synced</dt>
                <dd className="inline-flex items-center gap-1 text-muted-foreground">
                  <CalendarClock className="h-3 w-3" aria-hidden="true" />
                  {formatTime(agent.updatedAt ?? "")}
                </dd>
              </div>
            </dl>
            {/* Registry metric tiles — real values from the record (nulls stay as em-dashes). */}
            <div className="mt-4 grid grid-cols-2 gap-2" aria-label="Registry metrics">
              {[
                { label: "Registry score", value: agent.registryScore },
                { label: "Stars", value: agent.starCount },
                { label: "Avg score", value: agent.averageScore },
                { label: "Feedbacks", value: agent.totalFeedbacks },
                { label: "Health score", value: agent.healthScore },
                {
                  label: "x402 support",
                  value: agent.x402Supported ? "Yes" : "Not supported",
                },
              ].map((m) => (
                <div
                  key={m.label}
                  className="rounded-lg border border-border/60 bg-background/40 p-3"
                >
                  <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                    {m.label}
                  </p>
                  <p className="mt-1 truncate text-lg font-semibold tabular-nums text-foreground">
                    {m.value == null ? (
                      <Dash label={`${m.label} not provided by registry`} />
                    ) : (
                      m.value
                    )}
                  </p>
                </div>
              ))}
            </div>
          </>
        ) : (
          <dl className="mt-3 space-y-2 text-xs">
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Reference</dt>
              <dd className="truncate font-mono text-foreground" title={slug}>
                {slug}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Chain</dt>
              <dd>
                <Dash label="Chain pending" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Token ID</dt>
              <dd>
                <Dash label="Token ID pending" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Contract</dt>
              <dd>
                <Dash label="Contract pending" />
              </dd>
            </div>
            <div className="flex items-center justify-between gap-2">
              <dt className="text-muted-foreground">Last synced</dt>
              <dd className="inline-flex items-center gap-1 text-muted-foreground">
                <CalendarClock className="h-3 w-3" aria-hidden="true" />
                <Dash label="Last synced pending" />
              </dd>
            </div>
          </dl>
        )}
      </CardContent>
    </Card>
  );

  const rail = (
    <div className="flex flex-col gap-4">
      {hireCard}
      {registryCard}
      {builderCard}
    </div>
  );

  return (
    // Bottom padding reserves clearance for the fixed Hire bar on tablet/mobile
    // so page content (Permissions, Pricing, Activity, Related, Footer, Back
    // button) can never scroll underneath it. Reserve = bar height (~4rem:
    // py-2.5 top + h-11 button) + safe-area inset + breathing room. Desktop has
    // no fixed bar (lg:hidden), so it uses the normal pb-8.
    <MarketplaceContainer className="py-5 pb-[calc(5.5rem_+_env(safe-area-inset-bottom))] lg:pb-8">
      <Breadcrumbs items={[{ label: "Marketplace", href: "/marketplace" }, { label: title }]} />

      {/* ============================ 1 · HERO ============================ */}
      <header className="mt-2">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-start gap-4">
            <Avatar fallback={title.charAt(0).toUpperCase()} size="lg" className="rounded-xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="truncate text-2xl font-bold tracking-tight sm:text-3xl">{title}</h1>
                {agent ? (
                  <>
                    {/* 8004scan does not classify product category — honest chip. */}
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground"
                      title="8004scan does not classify agent category"
                    >
                      Uncategorized
                    </span>
                    <span
                      className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 font-mono text-xs font-medium text-muted-foreground"
                      title="Chain and ERC-8004 token ID on the registry record"
                    >
                      {chainLabelForId(agent.chainId)} · #{agent.tokenId}
                    </span>
                  </>
                ) : (
                  // Category is unknown until the registry is connected — shown as a
                  // "Pending Category" chip rather than a bare em-dash (Sprint 2C RC1).
                  <span className="inline-flex items-center gap-1 rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
                    Pending Category
                  </span>
                )}
              </div>
              <p className="mt-1 max-w-2xl text-sm text-muted-foreground">
                {agent
                  ? (agent.description ?? "This agent has no description on the registry record.")
                  : "Agent data will appear automatically once the ERC-8004 Registry is connected."}
              </p>
            </div>
          </div>

          {/* Quick actions — Favorite · Share · Compare (§7). One responsive
              strategy: icon + label on ≥sm, icon-only on mobile. On mobile each
              button is a fixed 36px square (equal width/height, centered icon,
              equal gap); on ≥sm they expand to auto width with full labels.
              Every button keeps a persistent aria-label. */}
          <div className="flex shrink-0 items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              className="w-9 justify-center px-0 sm:w-auto sm:px-3"
              aria-pressed={favorite}
              aria-label={favorite ? "Remove from favorites" : "Add to favorites"}
              onClick={() => setFavorite((v) => !v)}
            >
              <Star
                className={favorite ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"}
                aria-hidden="true"
              />
              <span className="hidden sm:inline">{favorite ? "Favorited" : "Favorite"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-9 justify-center px-0 sm:w-auto sm:px-3"
              onClick={onShare}
              aria-label="Copy link to this agent"
            >
              {copied ? (
                <Copy className="h-4 w-4 text-primary" aria-hidden="true" />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden sm:inline">{copied ? "Copied" : "Share"}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              className="w-9 justify-center px-0 sm:w-auto sm:px-3"
              aria-label="Compare this agent"
              disabled={!agent}
              onClick={() => {
                if (agent) router.push(`/compare?compare=${encodeURIComponent(agent.slug)}`);
              }}
            >
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">Compare</span>
            </Button>
          </div>
        </div>

        {/* Trust strip + registry status line (never below the fold). */}
        <div className="mt-3 flex flex-col gap-1.5">
          {trustStrip}
          <p
            role="status"
            aria-live="polite"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground"
          >
            <Database className="h-3.5 w-3.5" aria-hidden="true" />
            {agent ? (
              <>Registry status: Synced • Last synced {formatTime(agent.updatedAt ?? "")}</>
            ) : (
              <>Registry status: Waiting • Last synced —</>
            )}
          </p>
        </div>
      </header>

      <SectionDivider />

      {/* ==================== two-column body (§4) ==================== */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* ----------------------- MAIN COLUMN ----------------------- */}
        <div className="flex min-w-0 flex-col gap-8">
          {/* 2 · TRUST & VERIFICATION (attribution) */}
          <Section
            id="trust"
            title="Trust & Verification"
            description="Every trust signal is sourced. Values populate from the ERC-8004 Registry and are shown as pending until the record is connected."
          >
            <div className="grid gap-3 sm:grid-cols-2">
              {[
                {
                  label: "Verification",
                  node: (
                    <MarketplaceVerificationBadge
                      state={agent ? agent.verification : "pending"}
                      size="sm"
                      className="px-2.5"
                    />
                  ),
                  src: "ERC-8004 Registry verifier",
                },
                {
                  label: "Builder",
                  node: <BuilderBadge state="unknown-builder" size="sm" className="px-2.5" />,
                  src: "Registry owner record",
                },
                {
                  label: "Risk",
                  node: <Pending text="Pending" className="!px-3" />,
                  src: "Audited agent risk",
                },
                {
                  label: "Registry",
                  node: (
                    <RegistryBadge
                      state={agent ? "synced" : "waiting"}
                      size="sm"
                      className="px-2.5"
                    />
                  ),
                  src: "Registry sync state",
                },
                {
                  label: "Reputation",
                  node: <ReputationBadge state="unknown" size="sm" className="px-2.5" />,
                  src: "8004scan reputation & reviews",
                },
                {
                  label: "Status",
                  node: <StatusBadge state="coming-soon" size="sm" className="px-2.5" />,
                  src: "Platform lifecycle",
                },
              ].map((row) => (
                <div
                  key={row.label}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border/60 bg-background/40 p-3"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground">{row.label}</p>
                    <p className="truncate text-xs text-muted-foreground">Source: {row.src}</p>
                  </div>
                  {row.node}
                </div>
              ))}
            </div>
          </Section>

          {/* 3 · CAPABILITIES */}
          <Section
            id="capabilities"
            title="Capabilities"
            hint={agent ? undefined : <WaitingHint text="Waiting for ERC-8004 Registry" />}
          >
            <p className="mb-3 text-sm text-muted-foreground">
              {agent
                ? "Protocols come from the 8004scan registry record for this agent."
                : "Capabilities & protocols sync with the ERC-8004 Registry."}
            </p>
            <div className="space-y-4">
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  What it does
                </h3>
                {agent ? (
                  <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
                    Capability tags are not provided by the 8004scan registry record yet.
                  </p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2" aria-hidden="true">
                    {/* Deterministic varied widths so the placeholder reads like real
                        capability tags of different lengths (RC1 polish §4). */}
                    {["5.75rem", "3.5rem", "5rem", "4.25rem", "6.5rem"].map((w, i) => (
                      <Skeleton key={i} className="h-6 rounded-md" style={{ width: w }} />
                    ))}
                  </div>
                )}
              </div>
              <div>
                <h3 className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Protocols
                </h3>
                {agent ? (
                  agent.protocols.length > 0 ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {agent.protocols.map((p) => (
                        <ProtocolBadge key={p} label={p} size="sm" />
                      ))}
                    </div>
                  ) : (
                    <p className="mt-2 text-sm text-muted-foreground">
                      No protocols listed on the registry record.
                    </p>
                  )
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2" aria-hidden="true">
                    {["4.5rem", "3rem", "3.75rem"].map((w, i) => (
                      <Skeleton key={i} className="h-6 rounded-md" style={{ width: w }} />
                    ))}
                  </div>
                )}
              </div>
            </div>
          </Section>

          {slug === AAVE_AGENT_ID ? (
            <Section
              id="activation-preview"
              title="Activation Preview"
              description="Prototype boundary for the verified Aave by HeyAnon agent. It performs read-only MCP checks and stops before wallet approval."
            >
              <AaveActivationPreview />
            </Section>
          ) : null}

          {/* 4 · PERMISSIONS (read-only matrix — allow/deny/—) */}
          <Section
            id="permissions"
            title="Permissions"
            description="Read-only. What the agent is allowed to do once hired. Scopes resolve with the Altana integration; all rows are pending until then."
          >
            <div className="rounded-lg border border-border/60">
              <Table>
                <caption className="sr-only">
                  Agent permissions — action, scope, and allow or deny state. All values pending
                  ERC-8004 Registry sync.
                </caption>
                <TableHeader>
                  <TableRow>
                    <TableHead scope="col">Action</TableHead>
                    <TableHead scope="col">Scope</TableHead>
                    <TableHead scope="col" className="text-right">
                      Access
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {PERMISSION_ROWS.map((row) => (
                    <TableRow key={row.action}>
                      <TableCell scope="row" className="font-medium text-foreground">
                        {row.action}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{row.scope}</TableCell>
                      <TableCell className="text-right">
                        <span
                          className="inline-flex"
                          aria-label="Not configured — pending ERC-8004 Registry sync"
                        >
                          <Pending text="Pending" />
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Section>

          {/* 5 · PERFORMANCE (metrics — pending, never zero/fake) */}
          <Section
            id="performance"
            title="Performance"
            description="Operating metrics are not available yet. Each shows pending until an authoritative performance source is connected — no placeholder numbers."
          >
            <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
              {PERFORMANCE_METRICS.map((m) => (
                <MetricTile key={m.label} icon={m.icon} label={m.label} />
              ))}
            </div>
          </Section>

          {/* 5b · TERMIX REPUTATION (read-only; separate from 8004scan) */}
          <TermixReputationSection result={termix} formatTime={formatTime} />

          {/* 5c · PANCAKESWAP POOL INTELLIGENCE (read-only; independent of both) */}
          <PancakeSwapPoolSection data={pancakeswap} />

          {/* 6 · PRICING (tiers — honest placeholders) */}
          <Section
            id="pricing"
            title="Pricing"
            hint={<StatusBadge state="coming-soon" size="sm" />}
            description="Pricing tiers publish with ERC-8004 Registry integration. No amounts are shown until they are real."
          >
            <div className="grid gap-3 sm:grid-cols-3">
              {["Standard", "Pro", "Enterprise"].map((tier) => (
                <div key={tier} className="rounded-lg border border-border/60 bg-background/40 p-4">
                  <p className="text-sm font-semibold text-foreground">{tier}</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-xl font-bold text-foreground">
                      <Dash label={`${tier} price pending`} />
                    </span>
                    <span className="text-xs text-muted-foreground">/ hire</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground/70">
                    Tier details pending ERC-8004 Registry sync
                  </p>
                </div>
              ))}
            </div>
          </Section>

          {/* 7 · ACTIVITY TIMELINE (newest-first, empty state honest) */}
          <Section
            id="activity"
            title="Activity"
            description="Recent ERC-8004 Registry events, updates, and hires — newest first."
          >
            {agent ? (
              <dl className="rounded-lg border border-border/60">
                <div className="flex items-center justify-between gap-3 border-b border-border/60 px-4 py-3">
                  <dt className="text-sm font-medium text-foreground">First listed</dt>
                  <dd className="text-sm text-muted-foreground">
                    {formatTime(agent.createdAt ?? "")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3 px-4 py-3">
                  <dt className="text-sm font-medium text-foreground">Last updated</dt>
                  <dd className="text-sm text-muted-foreground">
                    {formatTime(agent.updatedAt ?? "")}
                  </dd>
                </div>
              </dl>
            ) : (
              <div
                className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card/30 p-10 text-center"
                role="status"
              >
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
                  <CalendarClock className="h-6 w-6" aria-hidden="true" />
                </div>
                <h3 className="text-base font-semibold">No activity recorded yet</h3>
                <p className="mt-1 max-w-md text-sm text-muted-foreground">
                  Agent data will appear automatically once the ERC-8004 Registry is connected.
                </p>
              </div>
            )}
          </Section>

          {/* 8 · RELATED AGENTS (skeleton cards — real cards arrive with data) */}
          <Section
            id="related"
            title="Related Agents"
            description="More agents in the same category, capabilities, or protocols."
          >
            <div
              className="grid -mt-1 gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3"
              aria-hidden="true"
            >
              {Array.from({ length: 3 }).map((_, i) => (
                <div key={i} className="rounded-xl border border-border/60 bg-card/60 p-5">
                  <div className="flex items-start gap-3">
                    <Skeleton className="h-10 w-10 rounded-lg" />
                    <div className="flex-1 space-y-2">
                      <Skeleton className="h-4 w-1/3" />
                      <Skeleton className="h-3 w-2/3" />
                    </div>
                  </div>
                  <div className="mt-4 space-y-2">
                    <Skeleton className="h-3 w-full" />
                    <Skeleton className="h-3 w-5/6" />
                  </div>
                  <div className="mt-4 flex gap-2">
                    <Skeleton className="h-5 w-20 rounded-md" />
                    <Skeleton className="h-5 w-16 rounded-md" />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-3 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Related agents will appear once the ERC-8004 Registry is connected.
            </p>
          </Section>
        </div>

        {/* ----------------------- STICKY RIGHT RAIL ----------------------- */}
        <aside className="lg:sticky lg:top-24 lg:self-start">{rail}</aside>
      </div>

      {/* ============================ 9 · FOOTER ============================
          Page footer = provenance + return to marketplace (blueprint §3/§4:
          provenance is LOW and lives at the bottom). The global site footer is
          provided by the app shell; this is the in-page detail footer. */}
      <footer className="mt-12 border-t border-border/60 pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>
              All data sourced from the ERC-8004 Registry. Values shown as “—” or “Pending” are
              awaiting sync — nothing is simulated.
            </span>
          </div>
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-md border border-border bg-background/60 px-4 text-sm font-medium text-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Back to Marketplace
          </button>
        </div>
      </footer>

      {/* ============ Persistent mobile/tablet Hire bar (§6/§7/§19) ============
          Below lg the sticky right rail is not visible, so the primary action
          stays reachable via a fixed bottom bar. */}
      <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border/70 bg-background/90 backdrop-blur lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 pb-[max(0.625rem,env(safe-area-inset-bottom))]">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
              <Dash label="Pricing pending" />
              <span className="text-xs font-normal text-muted-foreground">/ hire</span>
            </div>
            <p className="truncate text-[11px] text-muted-foreground">
              Pricing pending ERC-8004 Registry integration
            </p>
          </div>
          <Button
            variant="outline"
            size="icon"
            aria-pressed={favorite}
            onClick={() => setFavorite((v) => !v)}
            aria-label={favorite ? "Remove favorite" : "Add favorite"}
          >
            <Star
              className={favorite ? "h-4 w-4 fill-primary text-primary" : "h-4 w-4"}
              aria-hidden="true"
            />
          </Button>
          <button
            type="button"
            disabled={!agent || activation?.state !== "ACTIVATABLE"}
            title={activation?.detail ?? "A resolved registry agent is required."}
            onClick={() => {
              if (agent && activation?.state === "ACTIVATABLE") {
                router.push(`/agents/${encodeURIComponent(agent.slug)}/hire`);
              }
            }}
            className="inline-flex h-11 items-center justify-center gap-1.5 rounded-md bg-primary px-5 text-sm font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {activation?.state === "ACTIVATABLE" ? "Review & Activate" : "Activation unavailable"}
          </button>
        </div>
      </div>
    </MarketplaceContainer>
  );
}
