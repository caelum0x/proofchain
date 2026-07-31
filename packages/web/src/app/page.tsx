import Link from "next/link";
import type { Metadata } from "next";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Icon, type IconName } from "@/components/ui/Icon";
import { LiveStats } from "@/components/LiveStats";

export const metadata: Metadata = {
  title: "ProofChain — AI-verified provenance & supply-chain finance",
  description:
    "AI-verified provenance, autonomous on-chain settlement, and supply-chain finance on Base Sepolia.",
};

const HOW_IT_WORKS = [
  {
    step: "01",
    icon: "batches" as IconName,
    title: "Register provenance",
    body: "Suppliers register shipment batches and append IoT/carrier checkpoints, anchoring an immutable provenance trail on-chain.",
  },
  {
    step: "02",
    icon: "verifier" as IconName,
    title: "AI attestation",
    body: "An autonomous agent inspects documents, cross-checks the provenance trail, and writes a signed on-chain attestation with a risk score.",
  },
  {
    step: "03",
    icon: "escrow" as IconName,
    title: "Settle & finance",
    body: "Passing shipments release stablecoin escrow automatically. Attested receivables can be financed, insured, and tokenized as RWAs.",
  },
] as const;

const SECTIONS: readonly { href: string; icon: IconName; title: string; body: string }[] = [
  { href: "/explorer", icon: "explorer", title: "Explorer", body: "Browse every batch, provenance trail, attestation, and settlement." },
  { href: "/finance", icon: "finance", title: "Invoice financing", body: "List attested receivables; lenders fund them at a risk-graded discount." },
  { href: "/finance/pools", icon: "treasury", title: "Lending pools", body: "Deposit capital into pools that auto-fund eligible receivables." },
  { href: "/insurance", icon: "insurance", title: "Insurance", body: "Underwrite and buy shipment/credit cover; file claims on losses." },
  { href: "/disputes", icon: "disputes", title: "Disputes", body: "Staked arbiters vote to resolve disputed deals fairly." },
  { href: "/governance", icon: "governance", title: "Governance", body: "PROOF holders propose and vote on protocol parameters." },
  { href: "/carbon", icon: "carbon", title: "Carbon & ESG", body: "Tokenized carbon offsets and ESG scores per batch and org." },
  { href: "/marketplace", icon: "marketplace", title: "Marketplace", body: "Order book and English auctions for tokenized assets." },
];

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="space-y-5">
        <StatusBadge status="success" dot>
          Base Sepolia · Industrial 5.0 supply-chain finance
        </StatusBadge>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight text-fg sm:text-5xl">
          AI-verified provenance, autonomous settlement, and on-chain supply-chain finance.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          ProofChain turns trusted provenance into programmable money: an AI agent attests every
          shipment, escrow settles itself, and attested receivables become financeable, insurable,
          tokenized real-world assets.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link href="/explorer">
            <Button>
              Open the explorer
              <Icon name="arrow-right" size={16} />
            </Button>
          </Link>
          <Link href="/onboarding">
            <Button variant="secondary">Get started</Button>
          </Link>
          <Link href="/dashboard">
            <Button variant="ghost">View analytics</Button>
          </Link>
        </div>
      </section>

      {/* Live network stats */}
      <section className="space-y-4">
        <div>
          <h2 className="text-lg font-semibold text-fg">Live network</h2>
          <p className="text-sm text-muted">Aggregate activity across every ProofChain module.</p>
        </div>
        <LiveStats />
      </section>

      {/* How it works */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-fg">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <Card key={item.step} className="h-full space-y-3">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-brand">
                  <Icon name={item.icon} size={18} />
                </span>
                <span className="font-mono text-sm font-semibold text-brand">{item.step}</span>
              </div>
              <h3 className="text-base font-semibold text-fg">{item.title}</h3>
              <p className="text-sm text-muted">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Platform sections */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold text-fg">Explore the platform</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((section) => (
            <Link key={section.href} href={section.href} className="group focus-ring rounded-lg">
              <Card className="h-full space-y-3 transition-colors group-hover:border-brand/50">
                <span className="grid h-9 w-9 place-items-center rounded-lg bg-surface-2 text-brand">
                  <Icon name={section.icon} size={18} />
                </span>
                <h3 className="text-base font-semibold text-fg">{section.title}</h3>
                <p className="text-sm text-muted">{section.body}</p>
                <span className="inline-flex items-center gap-1 text-sm text-brand">
                  Open <Icon name="arrow-right" size={14} />
                </span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
