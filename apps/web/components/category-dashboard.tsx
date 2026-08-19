import Link from "next/link";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { getBscCategoryPage } from "@/lib/eight004scan/discovery/service.ts";
import type { BscCategoryPageData } from "@/lib/eight004scan/discovery/service.ts";
import type { DiscoveryCategoryKey } from "@/lib/eight004scan/discovery/classifier.ts";
import type { LeaderboardAgent } from "@/lib/eight004scan/leaderboard-types";
import { getPancakeSwapPools } from "@/lib/pancakeswap/client.ts";
import { buildCategoryMarketContext } from "@/lib/categories/market-context.ts";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Badge,
  EmptyState,
} from "@bnb-marketplace/ui";

/**
 * X.53/X.54 Main Track category dashboard.
 *
 * Every value shown here is derived from a real 8004scan record or a real
 * PancakeSwap V2 subgraph read, or is an explicit unavailable state. Nothing is
 * fabricated: no invented APYs, health factors, grid parameters, positions, or
 * performance figures. Category membership is not an 8004scan field, so each
 * listed agent carries the exact registry metadata excerpt that justified its
 * classification, plus the snapshot timestamp.
 *
 * X.54 adds, at equal depth for all four categories: live market context where
 * the source genuinely supports it, an explicit ANALYSIS vs EXECUTION capability
 * label, and a stated list of metrics that are intentionally unavailable.
 */

/** Whether the marketplace can actually execute for this category today. */
export type CategoryExecutionMode = "analysis-only";

export interface CategoryDashboardConfig {
  /** Route slug (also the visible provenance chip). */
  slug: string;
  /** Discovery key shared with the marketplace classifier. */
  discoveryKey: DiscoveryCategoryKey;
  title: string;
  description: string;
  /** What an agent in this category is expected to do (capability, not metrics). */
  capability: string;
  /** What the agent monitors / reads. */
  monitors: string;
  /** Why a user would want it. */
  whyUseful: string;
  /** The decision information a user needs before activating. */
  decisionSignals: readonly string[];
  /** Risks and hard limitations, stated plainly. */
  risks: readonly string[];
  /** Execution capability of THIS marketplace for this category. */
  executionMode: CategoryExecutionMode;
  /** Honest statement of what activation does and does not do. */
  activationNote: string;
  /** What cannot currently be verified, with the exact missing source. */
  verificationGap: readonly string[];
}

/** Real registry facts per category, derived from the matched records. */
interface EvidenceSummary {
  matched: number;
  verified: number;
  x402: number;
  protocols: string[];
  scored: number;
  registryScoreTotal: number;
}

function summarizeEvidence(discovered: { agent: LeaderboardAgent }[]): EvidenceSummary {
  const protocols = new Set<string>();
  let verified = 0;
  let x402 = 0;
  let scored = 0;
  let registryScoreTotal = 0;
  for (const { agent } of discovered) {
    for (const protocol of agent.protocols) protocols.add(protocol);
    if (agent.verification === "verified") verified += 1;
    if (agent.x402Supported) x402 += 1;
    if (agent.registryScore !== null) {
      scored += 1;
      registryScoreTotal += agent.registryScore;
    }
  }
  return {
    matched: discovered.length,
    verified,
    x402,
    protocols: [...protocols].sort(),
    scored,
    registryScoreTotal,
  };
}

function formatTimestamp(value: string | null): string {
  if (!value) return "unavailable";
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? "unavailable" : parsed.toISOString().replace("T", " ").slice(0, 19) + " UTC";
}

function stateMessage(data: BscCategoryPageData, title: string): { title: string; description: string } | null {
  switch (data.state) {
    case "missing-key":
      return {
        title: "Registry credential not configured",
        description:
          "The 8004scan API key is not configured on the server, so no agent data can be read. No placeholder agents are shown.",
      };
    case "unauthorized":
    case "forbidden":
      return {
        title: "Registry access rejected",
        description: "The agent registry rejected this request. No agent data is shown rather than guessing.",
      };
    case "rate-limited":
      return {
        title: "Registry rate limit reached",
        description: "The agent registry is rate limiting requests. Please retry shortly.",
      };
    case "server-error":
    case "network-error":
    case "error":
      return {
        title: "Registry temporarily unavailable",
        description: "The agent registry could not be reached. No agent data is shown rather than guessing.",
      };
    case "ready":
      return data.bucket && data.bucket.matched > 0
        ? null
        : {
            title: `No ${title} agents matched on BNB Chain yet`,
            description:
              "The registry query succeeded but no live record matched this category's documented phrase table. This is a real result, not a loading state.",
          };
    default:
      return null;
  }
}

export async function CategoryDashboard({ config }: { config: CategoryDashboardConfig }) {
  // Two independent bounded reads; a failure in one must not blank the other.
  const [data, poolData] = await Promise.all([
    getBscCategoryPage(config.discoveryKey),
    getPancakeSwapPools({ limit: 5 }),
  ]);
  const market = buildCategoryMarketContext(config.discoveryKey, poolData);
  const bucket = data.bucket;
  const notice = stateMessage(data, config.title);
  const discovered = bucket?.discovered ?? [];
  const evidence = summarizeEvidence(discovered);

  return (
    <div className="container py-8">
      <Breadcrumbs
        items={[{ label: "Categories", href: "/categories" }, { label: config.title }]}
      />

      <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{config.title}</h1>
          <p className="mt-1 max-w-2xl text-muted-foreground">{config.description}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2">
          <Badge variant="secondary">{config.slug}</Badge>
          {/* Unambiguous capability label: never imply execution that does not exist. */}
          <Badge variant="outline">Analysis / recommendation only</Badge>
        </div>
      </div>

      {/* Auditable counts only: every figure below comes from the registry. */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader>
            <CardDescription>Agents in this category</CardDescription>
            <CardTitle className="text-2xl">{bucket ? bucket.matched : "Unavailable"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Registry search hits</CardDescription>
            <CardTitle className="text-2xl">{bucket?.hits ?? "Unavailable"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Records screened</CardDescription>
            <CardTitle className="text-2xl">{bucket ? bucket.retrieved : "Unavailable"}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Chain</CardDescription>
            <CardTitle className="text-2xl">BNB Chain 56</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Capability: what it monitors, why it helps, what it can actually do. */}
      <div className="mb-6 grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">What these agents monitor</CardTitle>
            <CardDescription>{config.monitors}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{config.capability}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Why you would use one</CardTitle>
            <CardDescription>{config.whyUseful}</CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{config.activationNote}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Risks and limitations</CardTitle>
            <CardDescription>Read before activating.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {config.risks.map((risk) => (
                <li key={risk}>{risk}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      {/* Derived, real capability evidence from the matched registry records. */}
      {evidence.matched > 0 ? (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Card>
            <CardHeader>
              <CardDescription>Matched records</CardDescription>
              <CardTitle className="text-2xl">{evidence.matched}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Verification status</CardDescription>
              <CardTitle className="text-2xl">
                {evidence.verified} of {evidence.matched} verified
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>x402 payment support</CardDescription>
              <CardTitle className="text-2xl">
                {evidence.x402} of {evidence.matched}
              </CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardDescription>Protocols claimed</CardDescription>
              <CardTitle className="text-base leading-snug">
                {evidence.protocols.length > 0 ? evidence.protocols.join(", ") : "None listed"}
              </CardTitle>
            </CardHeader>
          </Card>
        </div>
      ) : null}

      {/* Live market context — real subgraph values or an honest unavailable state. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Current market context</CardTitle>
          <CardDescription>
            {market.state === "ready"
              ? `Live PancakeSwap V2 pool data · ${market.source} · chain ${market.chainId} · retrieved ${formatTimestamp(market.retrievedAt)}`
              : "Live market data is unavailable; no substitute values are shown."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {market.state === "ready" ? (
            <>
              <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {market.signals.map((signal) => (
                  <div key={signal.label} className="rounded-md border p-3">
                    <dt className="text-xs uppercase tracking-wide text-muted-foreground">{signal.label}</dt>
                    <dd className="mt-1 text-sm font-medium">
                      {signal.value ?? <span className="text-muted-foreground">Unavailable</span>}
                    </dd>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {signal.value === null && signal.unavailableReason ? signal.unavailableReason : signal.help}
                    </p>
                  </div>
                ))}
              </dl>

              {market.pools.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <caption className="sr-only">Observed PancakeSwap V2 pools</caption>
                    <thead>
                      <tr className="text-left text-xs uppercase tracking-wide text-muted-foreground">
                        <th scope="col" className="py-2 pr-4">Pool</th>
                        <th scope="col" className="py-2 pr-4">Liquidity (TVL)</th>
                        <th scope="col" className="py-2 pr-4">Cumulative volume</th>
                        <th scope="col" className="py-2 pr-4">Swaps</th>
                        <th scope="col" className="py-2 pr-4">Turnover</th>
                        <th scope="col" className="py-2">APR / APY</th>
                      </tr>
                    </thead>
                    <tbody>
                      {market.pools.map((pool) => (
                        <tr key={pool.poolId} className="border-t">
                          <td className="py-2 pr-4 font-medium">{pool.symbol}</td>
                          <td className="py-2 pr-4">${pool.tvlUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                          <td className="py-2 pr-4">${pool.cumulativeVolumeUsd.toLocaleString("en-US", { maximumFractionDigits: 0 })}</td>
                          <td className="py-2 pr-4">{pool.totalTransactions.toLocaleString("en-US")}</td>
                          <td className="py-2 pr-4">{pool.turnoverRatio === null ? "Unavailable" : `${pool.turnoverRatio.toFixed(2)}x`}</td>
                          <td className="py-2 text-muted-foreground">Unavailable</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-xs text-muted-foreground">
                    Volume is cumulative lifetime volume, not 24h. APR/APY is not published by this source and is never estimated.
                  </p>
                </div>
              ) : null}
            </>
          ) : (
            <EmptyState title="Market context unavailable" description={market.message} />
          )}

          {/* Always state what is deliberately not shown. */}
          <div className="rounded-md border border-dashed p-3">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Intentionally not shown
            </p>
            <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
              {market.unavailable.map((metric) => (
                <li key={metric.label}>
                  <span className="font-medium">{metric.label}:</span> {metric.reason}
                </li>
              ))}
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Decision signals to check on the agent page before activating. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Before you activate</CardTitle>
          <CardDescription>Verify each of these on the agent page.</CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {config.decisionSignals.map((signal) => (
              <li key={signal}>{signal}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Analysis vs Recommendation vs Execution — made explicit. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">Capability breakdown</CardTitle>
          <CardDescription>
            What this page and the agents above provide — each labelled unambiguously.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-md border p-3">
              <dt className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                Analysis
              </dt>
              <dd className="mt-1 text-sm font-medium">Available now</dd>
              <p className="mt-1 text-xs text-muted-foreground">
                Every value on this page is a real registry or subgraph read, or an explicit unavailable state.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <dt className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-emerald-500" aria-hidden="true" />
                Recommendation
              </dt>
              <dd className="mt-1 text-sm font-medium">Available now</dd>
              <p className="mt-1 text-xs text-muted-foreground">
                The recommendation below is derived only from the real signals on this page. It is guidance, not an order.
              </p>
            </div>
            <div className="rounded-md border p-3">
              <dt className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
                <span className="h-2 w-2 rounded-full bg-destructive" aria-hidden="true" />
                Execution
              </dt>
              <dd className="mt-1 text-sm font-medium">Not available</dd>
              <p className="mt-1 text-xs text-muted-foreground">
                This marketplace performs no transactions for this category. Execution would require a scoped, revocable Altana session permission you review and approve.
              </p>
            </div>
          </dl>
        </CardContent>
      </Card>

      {/* Data-derived recommendation — built only from the real signals above. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">What these agents recommend</CardTitle>
          <CardDescription>
            Derived from the market context above. Never a metric and never an execution promise.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">{market.recommendation}</p>
        </CardContent>
      </Card>

      {/* What cannot be verified, with the exact missing source. */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="text-lg">What cannot be verified yet</CardTitle>
          <CardDescription>
            Each limitation names the exact source that is missing — nothing is estimated around it.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
            {config.verificationGap.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </CardContent>
      </Card>

      {/* Provenance: never present a snapshot as permanently live data. */}
      <p className="mb-6 text-xs text-muted-foreground">
        Agent source: 8004scan registry ({config.discoveryKey} keyword “{bucket?.searchKeyword ?? "unavailable"}”) ·
        retrieved {formatTimestamp(data.fetchedAt)} · registry indexed {formatTimestamp(data.lastIndexed)} · category is
        inferred from registry metadata, not a registry field.
      </p>

      {notice ? (
        <Card>
          <CardContent className="pt-6">
            <EmptyState title={notice.title} description={notice.description} />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {discovered.map(({ agent, match }) => (
            <Card key={agent.slug}>
              <CardHeader>
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <CardTitle className="text-lg">{agent.name}</CardTitle>
                    <CardDescription>
                      {agent.description ?? "No description provided by the registry record."}
                    </CardDescription>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <Badge variant={agent.verification === "verified" ? "secondary" : "outline"}>
                      {agent.verification}
                    </Badge>
                    {agent.x402Supported ? <Badge variant="outline">x402</Badge> : null}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <dl className="grid gap-3 text-sm sm:grid-cols-4 lg:grid-cols-5">
                  <div>
                    <dt className="text-muted-foreground">Registry score</dt>
                    <dd>{agent.registryScore ?? "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Registry health</dt>
                    <dd>{agent.healthScore ?? "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Avg rating</dt>
                    <dd>{agent.averageScore ?? "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Feedbacks</dt>
                    <dd>{agent.totalFeedbacks ?? "Unavailable"}</dd>
                  </div>
                  <div>
                    <dt className="text-muted-foreground">Protocols</dt>
                    <dd>{agent.protocols.length > 0 ? agent.protocols.join(", ") : "Unavailable"}</dd>
                  </div>
                </dl>

                {/* The exact registry text that justified this classification. */}
                <p className="rounded-md bg-muted/50 p-3 text-xs text-muted-foreground">
                  Classified as {match.label} from the agent {match.evidence} · “{match.evidenceText}” · source:{" "}
                  {match.source}
                </p>

                <Link
                  href={`/agents/${encodeURIComponent(agent.slug)}`}
                  className="inline-flex text-sm font-medium underline underline-offset-4"
                >
                  Open agent · review capability, permissions and activation
                </Link>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
