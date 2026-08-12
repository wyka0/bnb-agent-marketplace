"use client";

import * as React from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Clock3,
  Database,
  Gauge,
  GitCompareArrows,
  Plus,
  ShieldCheck,
  TrendingUp,
  X,
} from "lucide-react";
import {
  MarketplaceContainer,
  MarketplaceHeader,
  MarketplaceEmptyState,
  SearchToolbar,
  SearchInput,
  StickyToolbar,
  Skeleton,
  SkeletonAgentCard,
  PendingHint,
  WaitingHint,
  MarketplaceVerificationBadge,
  BuilderBadge,
  RegistryBadge,
  StatusBadge,
  ReputationBadge,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  Button,
} from "@bnb-marketplace/ui";
import { Breadcrumbs } from "@/components/breadcrumbs";

const MAX_SLOTS = 3;

const SLOT_NAMES = ["Slot 1", "Slot 2", "Slot 3"] as const;

const PERFORMANCE_METRICS = [
  { icon: TrendingUp, label: "Tasks" },
  { icon: Database, label: "Uptime (30d)" },
  { icon: Gauge, label: "Success rate" },
  { icon: Clock3, label: "Avg. latency" },
] as const;

const PRICING_TIERS = ["Standard", "Pro", "Enterprise"] as const;

const PERMISSION_ROWS = [
  { action: "Transfer assets", scope: "Agent wallet" },
  { action: "Swap tokens", scope: "Approved routers" },
  { action: "Bridge assets", scope: "Cross-chain" },
  { action: "Call contracts", scope: "Whitelisted only" },
  { action: "Manage allowances", scope: "Per-protocol" },
] as const;

const REGISTRY_NOTE =
  "All data sourced from the ERC-8004 Registry. Values shown as “—” or “Pending” are awaiting sync — nothing is simulated.";

function Dash({ label }: { label: string }) {
  return (
    <span className="text-muted-foreground/70" aria-label={label}>
      —
    </span>
  );
}

function PendingChip({ text = "Pending" }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      <Clock3 className="h-3.5 w-3.5 animate-pulse" aria-hidden="true" />
      {text}
    </span>
  );
}

function SectionTitle({ title, hint }: { title: string; hint?: React.ReactNode }) {
  return (
    <div className="mb-3 flex flex-wrap items-center gap-3">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-foreground">{title}</h2>
      {hint}
    </div>
  );
}

function SectionDivider({ label }: { label: string }) {
  return (
    <div className="my-2 flex items-center gap-3">
      <span className="h-px flex-1 bg-border/70" />
      <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span className="h-px flex-1 bg-border/70" />
    </div>
  );
}

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

function TrustRow({ label, badge }: { label: string; badge: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {badge}
    </div>
  );
}

const COMPARE_ROWS: { label: string; render: () => React.ReactNode }[] = [
  { label: "Category", render: () => <Dash label="Category pending ERC-8004 Registry sync" /> },
  { label: "Builder", render: () => <BuilderBadge state="unknown-builder" size="sm" /> },
  {
    label: "Verification",
    render: () => <MarketplaceVerificationBadge state="pending" size="sm" />,
  },
  { label: "Risk", render: () => <PendingChip text="Pending" /> },
  { label: "Capabilities", render: () => <PendingChip text="Pending" /> },
  { label: "Protocols", render: () => <PendingChip text="Pending" /> },
  { label: "Permissions", render: () => <PendingChip text="Pending" /> },
  { label: "Performance", render: () => <PendingChip text="Pending" /> },
  { label: "Pricing", render: () => <Dash label="Pricing pending ERC-8004 Registry sync" /> },
  { label: "Registry", render: () => <RegistryBadge state="waiting" size="sm" /> },
  { label: "Status", render: () => <StatusBadge state="coming-soon" size="sm" /> },
  { label: "Reviews", render: () => <Dash label="Reviews pending registry sync" /> },
  { label: "Activity", render: () => <Dash label="Activity pending ERC-8004 Registry sync" /> },
];

function CompareSlotCard({
  name,
  selected,
  onRemove,
  onAdd,
}: {
  name: string;
  selected: boolean;
  onRemove: () => void;
  onAdd: () => void;
}) {
  return (
    <div className="relative flex flex-col rounded-xl border border-border/60 bg-card/60 p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <p className="text-sm font-semibold text-foreground">{name}</p>
        {selected ? (
          <button
            type="button"
            aria-label={`Remove ${name} from comparison`}
            onClick={onRemove}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            aria-label={`Re-add ${name}`}
            onClick={onAdd}
            className="-mr-2 -mt-2 inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/60 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <Plus className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      {selected ? (
        <>
          <div className="relative">
            <SkeletonAgentCard variant="standard" />
            <div className="pointer-events-none absolute right-3 top-3 origin-top-right scale-[0.92]">
              <PendingHint text="Pending Registry Sync" />
            </div>
          </div>
          <button
            type="button"
            disabled
            title="Add selection becomes available once the ERC-8004 Registry is connected."
            className="mt-3 inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-dashed border-border text-xs font-medium text-muted-foreground transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Plus className="h-3.5 w-3.5" aria-hidden="true" />
            Add Agent placeholder
          </button>
        </>
      ) : (
        <button
          type="button"
          disabled
          title="Add selection becomes available once the ERC-8004 Registry is connected."
          className="flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background/40 p-6 text-center text-sm text-muted-foreground transition-colors disabled:cursor-not-allowed disabled:opacity-60"
        >
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <GitCompareArrows className="h-5 w-5" aria-hidden="true" />
          </span>
          Add Agent
          <span className="text-xs text-muted-foreground/70">Available with registry sync</span>
        </button>
      )}
    </div>
  );
}

export function CompareView() {
  const [slots, setSlots] = React.useState<boolean[]>(() =>
    Array.from({ length: MAX_SLOTS }, () => true)
  );
  const [query, setQuery] = React.useState("");
  const selectedCount = slots.filter(Boolean).length;
  const activeNames = SLOT_NAMES.filter((_, i) => slots[i]);

  const removeSlot = (index: number) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? false : s)));
  };

  const addSlot = (index: number) => {
    setSlots((prev) => prev.map((s, i) => (i === index ? true : s)));
  };

  const compareTable = (
    <div className="overflow-hidden rounded-lg border border-border/60">
      <Table>
        <caption className="sr-only">
          Side-by-side comparison of selected agents. All values pending ERC-8004 Registry sync.
        </caption>
        <TableHeader>
          <TableRow>
            <TableHead scope="col" className="w-40 font-semibold text-foreground">
              Feature
            </TableHead>
            {SLOT_NAMES.map((name) => (
              <TableHead key={name} scope="col" className="min-w-36 font-semibold text-foreground">
                {name}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {COMPARE_ROWS.map((row) => (
            <TableRow key={row.label}>
              <TableCell scope="row" className="font-medium text-foreground">
                {row.label}
              </TableCell>
              {SLOT_NAMES.map((name) => (
                <TableCell key={name} className="text-muted-foreground">
                  {row.render()}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );

  const mobileStack = (
    <div className="flex flex-col gap-4 md:hidden">
      {activeNames.map((name) => (
        <div key={name} className="rounded-xl border border-border/60 bg-card/60 p-4">
          <p className="mb-3 text-sm font-semibold text-foreground">{name}</p>
          <dl className="flex flex-col gap-2">
            {COMPARE_ROWS.map((row) => (
              <div key={row.label} className="flex items-center justify-between gap-3">
                <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
                <dd>{row.render()}</dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </div>
  );

  const comparisonMatrix = (
    <section aria-labelledby="comparison-heading" className="scroll-mt-24">
      <SectionTitle
        title="Comparison"
        hint={<WaitingHint text="Waiting for ERC-8004 Registry" />}
      />
      <div className="hidden md:block">{compareTable}</div>
      {mobileStack}
    </section>
  );

  const capabilitiesSection = (
    <section aria-labelledby="capabilities-heading" className="scroll-mt-24">
      <SectionTitle
        title="Capabilities"
        hint={<WaitingHint text="Waiting for ERC-8004 Registry" />}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeNames.map((name) => (
          <div key={name} className="rounded-xl border border-border/60 bg-card/60 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">{name}</p>
            <div className="mb-3">
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                What it does
              </p>
              <div className="mt-2 flex flex-wrap gap-2" aria-hidden="true">
                {["5.5rem", "4rem", "4.75rem", "3.25rem", "5rem"].map((w, i) => (
                  <Skeleton key={i} className="h-6 rounded-md" style={{ width: w }} />
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Protocols
              </p>
              <div className="mt-2 flex flex-wrap gap-2" aria-hidden="true">
                {["4rem", "3.25rem", "3.75rem"].map((w, i) => (
                  <Skeleton key={i} className="h-6 rounded-md" style={{ width: w }} />
                ))}
              </div>
            </div>
            <div className="mt-3 pb-1">
              <PendingChip text="Pending Registry Sync" />
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const permissionsSection = (
    <section aria-labelledby="permissions-heading" className="scroll-mt-24">
      <SectionTitle
        title="Permissions"
        hint={<WaitingHint text="Read-only until registry sync" />}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeNames.map((name) => (
          <div key={name} className="overflow-hidden rounded-lg border border-border/60">
            <p className="border-b border-border/60 bg-background/40 px-4 py-3 text-sm font-medium text-foreground">
              {name}
            </p>
            <Table>
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
                      <PendingChip />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ))}
      </div>
    </section>
  );

  const performanceSection = (
    <section aria-labelledby="performance-heading" className="scroll-mt-24">
      <SectionTitle title="Performance" hint={<WaitingHint text="Pending metric sync" />} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeNames.map((name) => (
          <div key={name} className="rounded-xl border border-border/60 bg-card/60 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">{name}</p>
            <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
              {PERFORMANCE_METRICS.map((m) => (
                <MetricTile key={m.label} icon={m.icon} label={m.label} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const pricingSection = (
    <section aria-labelledby="pricing-heading" className="scroll-mt-24">
      <SectionTitle title="Pricing" hint={<StatusBadge state="coming-soon" size="sm" />} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeNames.map((name) => (
          <div key={name} className="rounded-xl border border-border/60 bg-card/60 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">{name}</p>
            <div className="grid gap-3 sm:grid-cols-3">
              {PRICING_TIERS.map((tier) => (
                <div
                  key={tier}
                  className="min-h-[108px] rounded-lg border border-border/60 bg-background/40 p-4"
                >
                  <p className="text-sm font-semibold text-foreground">{tier}</p>
                  <div className="mt-2 flex items-baseline gap-1">
                    <span className="text-xl font-bold text-foreground">
                      <Dash label={`${tier} price pending`} />
                    </span>
                    <span className="text-xs text-muted-foreground">/ hire</span>
                  </div>
                  <p className="mt-2 text-xs text-muted-foreground/70">Coming Soon</p>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  const trustSection = (
    <section aria-labelledby="trust-heading" className="scroll-mt-24">
      <SectionTitle
        title="Trust & Verification"
        hint={<WaitingHint text="Waiting for ERC-8004 Registry" />}
      />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {activeNames.map((name) => (
          <div key={name} className="rounded-xl border border-border/60 bg-card/60 p-4">
            <p className="mb-3 text-sm font-medium text-foreground">{name}</p>
            <div className="flex flex-col gap-4">
              <TrustRow
                label="Verification"
                badge={<MarketplaceVerificationBadge state="pending" size="sm" />}
              />
              <TrustRow
                label="Builder"
                badge={<BuilderBadge state="unknown-builder" size="sm" />}
              />
              <TrustRow label="Registry" badge={<RegistryBadge state="waiting" size="sm" />} />
              <TrustRow label="Risk" badge={<PendingChip text="Pending" />} />
              <TrustRow label="Status" badge={<StatusBadge state="coming-soon" size="sm" />} />
              <TrustRow label="Reputation" badge={<ReputationBadge state="unknown" size="sm" />} />
            </div>
          </div>
        ))}
      </div>
    </section>
  );

  return (
    <MarketplaceContainer className="py-5">
      <Breadcrumbs items={[{ label: "Marketplace", href: "/marketplace" }, { label: "Compare" }]} />

      <MarketplaceHeader
        title="Compare Agents"
        subtitle="Compare multiple ERC-8004 agents side-by-side. Live data appears automatically once the Registry is connected."
        className="py-4"
      />

      <StickyToolbar className="mb-4" offset={64}>
        <SearchToolbar
          actions={
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-sm text-muted-foreground">
              <GitCompareArrows className="h-4 w-4" aria-hidden="true" />
              {selectedCount} / {MAX_SLOTS} selected
            </span>
          }
        >
          <SearchInput value={query} onChange={setQuery} placeholder="Search agents to compare…" />
          <div className="hidden md:block">
            <WaitingHint text="Waiting for ERC-8004 Registry" />
          </div>
        </SearchToolbar>
      </StickyToolbar>

      {/* Compare slots */}
      <section aria-labelledby="slots-heading" className="mb-8 scroll-mt-24">
        <SectionTitle title="Compare slots" hint={<WaitingHint text="Pending Registry Sync" />} />
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {SLOT_NAMES.map((name, index) => (
            <CompareSlotCard
              key={name}
              name={name}
              selected={slots[index] ?? false}
              onRemove={() => removeSlot(index)}
              onAdd={() => addSlot(index)}
            />
          ))}
        </div>
      </section>

      {selectedCount > 0 ? (
        <div className="flex flex-col gap-6 lg:gap-8">
          {comparisonMatrix}
          <SectionDivider label="Details" />
          {capabilitiesSection}
          {permissionsSection}
          {performanceSection}
          {pricingSection}
          {trustSection}
        </div>
      ) : (
        <MarketplaceEmptyState
          icon={GitCompareArrows}
          tone="primary"
          title="No agents selected"
          description="Select up to three agents from the Marketplace to compare them. Slots accept selections once the ERC-8004 Registry is connected."
          action={
            <Button asChild>
              <Link href="/marketplace">Browse Marketplace</Link>
            </Button>
          }
        />
      )}

      <footer className="mt-12 border-t border-border/60 pt-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{REGISTRY_NOTE}</span>
          </div>
          <Button variant="outline" asChild>
            <Link href="/marketplace">
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              Back to Marketplace
            </Link>
          </Button>
        </div>
      </footer>
    </MarketplaceContainer>
  );
}
