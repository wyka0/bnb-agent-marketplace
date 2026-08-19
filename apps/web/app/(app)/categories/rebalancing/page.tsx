import { CategoryDashboard } from "@/components/category-dashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Rebalancing Agents" };

export default function RebalancingPage() {
  return (
    <CategoryDashboard
      config={{
        slug: "rebalancing",
        discoveryKey: "rebalancing",
        title: "Rebalancing",
        description:
          "Agents that monitor portfolio and LP drift on BNB Chain and identify when a rebalance is worth its cost.",
        monitors:
          "Target allocations, LP price ranges, and how far a position has drifted from its intended weighting.",
        capability:
          "Detect when a position has moved outside its target band, quantify the drift, and explain why a rebalance is warranted before any funds move.",
        whyUseful:
          "Drift silently changes your risk exposure, and rebalancing too often wastes more in fees than it recovers. These agents watch continuously so you act on the drift that matters.",
        decisionSignals: [
          "Which positions or pools the agent monitors, and on which chain",
          "The drift threshold that triggers a rebalance recommendation",
          "Whether the agent only analyses, or also requests execution permission",
          "Liquidity depth of the pair a rebalance would route through (see market context above)",
          "Registry verification status, rating and feedback volume",
          "Requested permissions and spend limits on the activation review",
        ],
        risks: [
          "Rebalancing realises losses and incurs gas — frequent rebalances can cost more than the drift they correct",
          "Reference prices come from one DEX source; thin liquidity increases slippage on any actual execution",
          "This marketplace performs no rebalance itself — recommendations are not orders",
          "Agent quality is not guaranteed by registry listing; verification status is not a performance promise",
        ],
        executionMode: "analysis-only",
        activationNote:
          "Analysis / recommendation only. Agents surface the opportunity and the reasoning; any execution would require an explicit, scoped Altana session permission that you review and can revoke at any time.",
        verificationGap: [
          "Execution cost (gas and slippage for a real wallet) — not read, so no net-of-cost rebalance math is shown",
          "Your actual portfolio holdings and target weights — read none, surfaced only by an activated monitoring agent",
          "Historical price series — not exposed by the pools subgraph, so no trend-based rebalance timing is derived",
        ],
      }}
    />
  );
}
