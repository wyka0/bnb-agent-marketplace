import { Boxes, Cpu, Handshake, Layers, TestTubes } from "lucide-react";
import { PartnerCard } from "./partner-card";
import { SectionTitle } from "./section-title";

const PARTNERS = [
  {
    name: "BNB Chain",
    role: "The high-throughput Layer 1 where agents live, transact, and are registered on the ERC-8004 standard.",
    icon: Layers,
  },
  {
    name: "8004scan",
    role: "The ERC-8004 agent registry indexer powering agent discovery, search, and registry data.",
    icon: Cpu,
  },
  {
    name: "Altana",
    role: "Non-custodial agent wallets with session keys, spend caps, and x402 payments for hiring agents.",
    icon: Handshake,
  },
  {
    name: "PancakeSwap",
    role: "BNB Chain's leading DEX providing liquidity, swap, and yield infrastructure for trading agents.",
    icon: Boxes,
  },
  {
    name: "TermiX",
    role: "MCP tool server bridging on-chain BSC operations into agent workflows.",
    icon: TestTubes,
  },
] as const;

export function EcosystemPartners() {
  return (
    <section className="container py-20 lg:py-24">
      <SectionTitle
        eyebrow="Partners"
        title="Ecosystem partners"
        description="Built on the official BNB Chain agent infrastructure, integrated with the ecosystem's core protocols."
      />
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {PARTNERS.map((partner) => (
          <PartnerCard key={partner.name} {...partner} />
        ))}
      </div>
    </section>
  );
}
