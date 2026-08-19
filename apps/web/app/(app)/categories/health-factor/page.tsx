import { CategoryDashboard } from "@/components/category-dashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Health Factor Monitoring Agents" };

export default function HealthFactorPage() {
  return (
    <CategoryDashboard
      config={{
        slug: "health-factor",
        discoveryKey: "health-factor-monitoring",
        title: "Health Factor Monitoring",
        description:
          "Agents that watch lending positions on BNB Chain and warn before collateral health approaches liquidation.",
        monitors:
          "Supplied collateral, outstanding debt, and the resulting health factor on a specific lending market.",
        capability:
          "Track collateral and debt for your account, compute the position health factor, and alert or act before the liquidation threshold is reached.",
        whyUseful:
          "Liquidations happen fast during volatility and are irreversible. Continuous monitoring gives you warning while you can still add collateral or repay.",
        decisionSignals: [
          "Which lending protocols and markets the agent monitors",
          "The health-factor threshold at which it alerts, and how it notifies you",
          "Whether it can act (repay / add collateral) or only alert",
          "How liquidation distance is calculated and how often it refreshes",
          "Registry verification status, rating and feedback volume",
        ],
        risks: [
          "No live lending position is available on this page — no health factor is shown, and none is invented",
          "A health factor is account-specific and market-specific; a value from one market does not transfer to another",
          "Alerting depends on data freshness — a stale feed can under-report liquidation risk",
          "Monitoring alone does not prevent liquidation unless you or a permitted agent acts in time",
        ],
        executionMode: "analysis-only",
        activationNote:
          "Analysis / recommendation only. No wallet position is read here, so this marketplace never displays a synthetic health factor. Activate a monitoring agent so it can read your own position and compute a real value.",
        verificationGap: [
          "Lending position — no wallet address is read on this page, so no collateral, debt or health factor exists here",
          "Lending market data — no verified lending subgraph, RPC position reader or health-factor tool is wired to this category",
          "Liquidation trigger execution — no transaction bridge exists for this category, so nothing here can add collateral or repay",
        ],
      }}
    />
  );
}
