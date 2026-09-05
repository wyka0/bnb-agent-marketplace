import { CategoryDashboard } from "@/components/category-dashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Yield Optimization Agents" };

export default function YieldPage() {
  return (
    <CategoryDashboard
      config={{
        slug: "yield",
        discoveryKey: "yield-optimisation",
        title: "Yield Optimization",
        description:
          "Agents that compare real yield opportunities across BNB Chain pools and vaults, using verifiable PancakeSwap liquidity data.",
        monitors:
          "Pool liquidity, trading turnover, and token exposure across the pools and vaults an agent covers.",
        capability:
          "Compare pools on verifiable liquidity and trading activity, surface where capital is actually working, and auto-compound or reallocate where the agent supports it.",
        whyUseful:
          "Advertised yields are often stale or unverifiable. Comparing real liquidity and turnover shows which pools are genuinely active before you commit capital.",
        decisionSignals: [
          "Which protocols and pools the agent covers",
          "Verifiable pool liquidity (TVL) and cumulative trading volume (see market context above)",
          "Turnover ratio — volume per dollar of liquidity, a fee-activity proxy, not a yield figure",
          "Whether any quoted yield is verifiable on-chain or merely advertised",
          "Token exposure and impermanent-loss risk for LP strategies",
          "Registry verification status, rating and feedback volume",
        ],
        risks: [
          "APR/APY is NOT published by the PancakeSwap V2 subgraph, so no yield figure is shown or estimated here",
          "High turnover indicates fee activity, not profit — impermanent loss can exceed fees earned",
          "TVL and volume are cumulative snapshots, not forward-looking returns",
          "Providing liquidity exposes you to both assets in the pair, not just one",
        ],
        executionMode: "analysis-only",
        activationNote:
          "Analysis / recommendation only. Yield figures are shown only where a source can verify them; the V2 subgraph exposes liquidity, volume, price and swap counts but no APR/APY, so yield is reported as unavailable rather than estimated.",
        verificationGap: [
          "APR/APY — the PancakeSwap V2 subgraph does not publish fees earned or emissions, so no yield figure exists here by design",
          "Auto-compounding or vault yields — no vault position is read on this page",
          "Impermanent loss — needs a price path between entry and exit, which the pool snapshot does not provide",
        ],
      }}
    />
  );
}
