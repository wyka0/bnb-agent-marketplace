import { CategoryDashboard } from "@/components/category-dashboard";

export const dynamic = "force-dynamic";

export const metadata = { title: "Grid Trading Agents" };

export default function GridTradingPage() {
  return (
    <CategoryDashboard
      config={{
        slug: "grid-trading",
        discoveryKey: "grid-trading",
        title: "Grid Trading",
        description:
          "Agents that run range-bound grid strategies on BNB Chain pairs, with their parameters and risks stated up front.",
        monitors:
          "A specific trading pair, the price range a grid covers, and how actively that pair trades.",
        capability:
          "Place laddered buy/sell levels across a price range, aiming to capture volatility while the market stays range-bound.",
        whyUseful:
          "Grids profit from repeated two-way movement rather than direction, so they suit choppy markets — but only where trading activity is genuinely high enough to fill levels.",
        decisionSignals: [
          "The traded pair and the price range the grid covers",
          "Number of grid levels and the capital required per level",
          "Swap activity on the pair — grids need frequent two-way fills (see market context above)",
          "Behaviour when price exits the range — the primary grid risk",
          "Whether execution is automated, and what permission that would need",
          "Registry verification status, rating and feedback volume",
        ],
        risks: [
          "A grid loses money when price trends strongly out of its range and leaves inventory on one side",
          "Grid range must come from a verified price-history source; this page will not infer a range",
          "Every filled level costs gas and fees, which erodes small per-level margins",
          "This marketplace does NOT place grid orders — no automated execution exists here",
        ],
        executionMode: "analysis-only",
        activationNote:
          "Analysis / recommendation only. This marketplace does not run automated grid execution. Agents are surfaced with their stated strategy so you can evaluate them; order placement is not claimed and would require an explicit scoped permission.",
        verificationGap: [
          "Grid range — a verified price history is not available, so no range is derived and no levels are proposed on this page",
          "Grid performance — no backtest exists anywhere in this marketplace, so no win rate, P&L or drawdown is shown",
          "Order placement — no trading bridge is wired for this category, so no grid order is ever placed here",
        ],
      }}
    />
  );
}
