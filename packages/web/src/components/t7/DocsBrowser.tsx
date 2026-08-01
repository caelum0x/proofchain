"use client";

import Link from "next/link";
import { env } from "@/lib/env";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Card, CardHeader } from "@/components/ui/Card";
import { CodeBlock } from "@/components/ui/CodeBlock";
import { Accordion, type AccordionItem } from "@/components/ui/Accordion";
import { Callout } from "@/components/ui/Callout";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon, type IconName } from "@/components/ui/Icon";

interface Concept {
  readonly icon: IconName;
  readonly title: string;
  readonly body: string;
}

const CONCEPTS: readonly Concept[] = [
  { icon: "batches", title: "Provenance", body: "Suppliers register batches and append checkpoints, anchoring an immutable trail on-chain." },
  { icon: "verifier", title: "AI attestation", body: "An autonomous agent inspects documents and writes a signed attestation with a risk score." },
  { icon: "escrow", title: "Settlement", body: "Passing shipments release stablecoin escrow automatically; failures refund the buyer." },
  { icon: "finance", title: "Trade finance", body: "Attested receivables become financeable, insurable, tokenized real-world assets." },
];

const FAQ: readonly AccordionItem[] = [
  { id: "network", title: "Which network does ProofChain run on?", content: `ProofChain runs on Ethereum Sepolia (chain ${env.chainId}). It is a testnet, so funds have no real value.` },
  { id: "wallet", title: "Do I need to share my private key?", content: "Never. The dApp only requests signatures through your wallet. No page ever sees your private key." },
  { id: "cost", title: "Does it cost anything?", content: "Only testnet gas, which you can get for free from a Ethereum Sepolia faucet linked in onboarding." },
  { id: "data", title: "Where does the data come from?", content: "Reads come from the ProofChain API (aggregates) and directly from contract events via your RPC for freshness." },
];

/**
 * Documentation browser (WD §6, MarketingShell): tabbed reference covering the
 * model, architecture, contracts, and API — built from design-system primitives.
 */
export function DocsBrowser() {
  const apiExample = `# Health check
curl ${env.apiUrl}/health

# Aggregate network analytics
curl ${env.apiUrl}/analytics/overview`;

  const flowExample = `Supplier → register batch  (ProvenanceRegistry)
Carrier  → add checkpoint  (ProvenanceRegistry)
Agent    → attest + score  (AttestationRegistry)
Buyer    → fund escrow      (SettlementEscrow)
Protocol → release / refund (SettlementEscrow)`;

  const items: readonly TabItem[] = [
    {
      id: "overview",
      label: "Overview",
      content: (
        <div className="space-y-6">
          <p className="max-w-2xl text-muted">
            ProofChain turns trusted provenance into programmable money. The lifecycle spans four
            stages, each backed by an on-chain contract.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            {CONCEPTS.map((c) => (
              <Card key={c.title} className="flex gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-surface-2 text-brand">
                  <Icon name={c.icon} size={18} />
                </span>
                <div>
                  <h3 className="text-sm font-semibold text-fg">{c.title}</h3>
                  <p className="mt-1 text-sm text-muted">{c.body}</p>
                </div>
              </Card>
            ))}
          </div>
        </div>
      ),
    },
    {
      id: "architecture",
      label: "Architecture",
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader title="Lifecycle flow" description="How a shipment moves from registration to settlement." />
            <CodeBlock title="lifecycle" code={flowExample} copyable={false} />
          </Card>
          <Callout tone="info" title="Composable modules">
            Trade finance, insurance, compliance, logistics, sustainability, and governance all read
            the same provenance + attestation state, so verified shipments unlock every downstream
            module.
          </Callout>
        </div>
      ),
    },
    {
      id: "contracts",
      label: "Contracts",
      content: (
        <div className="space-y-6">
          <p className="max-w-2xl text-muted">
            Core contracts are deployed on Ethereum Sepolia. Live addresses are resolved from your
            environment and shown across the app (for example on the Admin address book).
          </p>
          <div className="flex flex-wrap gap-2">
            {["ProvenanceRegistry", "AttestationRegistry", "SettlementEscrow", "FinancingMarketplace"].map((name) => (
              <StatusBadge key={name} status="neutral" dot={false}>
                {name}
              </StatusBadge>
            ))}
          </div>
          <Callout tone="neutral" title="Address book">
            See every configured contract address on the{" "}
            <Link href="/admin" className="text-brand hover:underline">
              Admin
            </Link>{" "}
            page.
          </Callout>
        </div>
      ),
    },
    {
      id: "api",
      label: "API",
      content: (
        <div className="space-y-6">
          <Card>
            <CardHeader title="REST endpoints" description={`Base URL: ${env.apiUrl}`} />
            <CodeBlock title="curl" language="bash" code={apiExample} />
          </Card>
          <Callout tone="info">
            Every response uses a <code className="font-mono">{`{ success, data, error }`}</code>{" "}
            envelope and is validated with zod on the client.
          </Callout>
        </div>
      ),
    },
    {
      id: "faq",
      label: "FAQ",
      content: <Accordion items={FAQ} defaultOpen={["network"]} />,
    },
  ];

  return (
    <div className="space-y-8">
      <header className="space-y-3">
        <StatusBadge status="brand" dot>
          Documentation
        </StatusBadge>
        <h1 className="text-3xl font-semibold tracking-tight text-fg sm:text-4xl">ProofChain docs</h1>
        <p className="max-w-2xl text-lg text-muted">
          Everything you need to understand the protocol: the model, architecture, contracts, and the
          backend API.
        </p>
      </header>
      <Tabs items={items} />
    </div>
  );
}
