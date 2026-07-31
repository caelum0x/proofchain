import Link from "next/link";
import { Card } from "@/components/ui/Card";
import { LiveStats } from "@/components/LiveStats";

const HOW_IT_WORKS = [
  {
    step: "01",
    title: "Register provenance",
    body: "Suppliers register shipment batches and append IoT/carrier checkpoints, anchoring an immutable provenance trail on-chain.",
  },
  {
    step: "02",
    title: "AI attestation",
    body: "An autonomous agent inspects documents, cross-checks the provenance trail, and writes a signed on-chain attestation with a risk score.",
  },
  {
    step: "03",
    title: "Settle & finance",
    body: "Passing shipments release stablecoin escrow automatically. Attested receivables can be financed, insured, and tokenized as RWAs.",
  },
] as const;

const SECTIONS = [
  { href: "/explorer", title: "Explorer", body: "Browse every batch, provenance trail, attestation, and settlement." },
  { href: "/finance", title: "Invoice financing", body: "List attested receivables; lenders fund them at a risk-graded discount." },
  { href: "/finance/pools", title: "Lending pools", body: "Deposit capital into pools that auto-fund eligible receivables." },
  { href: "/insurance", title: "Insurance", body: "Underwrite and buy shipment/credit cover; file claims on losses." },
  { href: "/disputes", title: "Disputes", body: "Staked arbiters vote to resolve disputed deals fairly." },
  { href: "/governance", title: "Governance", body: "PROOF holders propose and vote on protocol parameters." },
  { href: "/carbon", title: "Carbon & ESG", body: "Tokenized carbon offsets and ESG scores per batch and org." },
  { href: "/marketplace", title: "Marketplace", body: "Order book and English auctions for tokenized assets." },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-16">
      {/* Hero */}
      <section className="space-y-5">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <span className="h-2 w-2 rounded-full bg-success" /> Base Sepolia · Industrial 5.0 supply-chain finance
        </span>
        <h1 className="max-w-3xl text-4xl font-semibold tracking-tight sm:text-5xl">
          AI-verified provenance, autonomous settlement, and on-chain supply-chain finance.
        </h1>
        <p className="max-w-2xl text-lg text-muted">
          ProofChain turns trusted provenance into programmable money: an AI agent attests every
          shipment, escrow settles itself, and attested receivables become financeable, insurable,
          tokenized real-world assets.
        </p>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/explorer"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-brand-fg transition-colors hover:bg-brand/90"
          >
            Open the explorer
          </Link>
          <Link
            href="/supplier"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            Register a batch
          </Link>
          <Link
            href="/dashboard"
            className="rounded-lg border border-border bg-surface px-4 py-2 text-sm font-medium text-fg transition-colors hover:bg-surface-2"
          >
            View analytics
          </Link>
        </div>
      </section>

      {/* Live network stats */}
      <section className="space-y-4">
        <div className="flex items-end justify-between">
          <div>
            <h2 className="text-lg font-semibold">Live network</h2>
            <p className="text-sm text-muted">Aggregate activity across every ProofChain module.</p>
          </div>
        </div>
        <LiveStats />
      </section>

      {/* How it works */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold">How it works</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          {HOW_IT_WORKS.map((item) => (
            <Card key={item.step} className="h-full">
              <span className="text-sm font-semibold text-brand">{item.step}</span>
              <h3 className="mt-2 text-base font-semibold">{item.title}</h3>
              <p className="mt-2 text-sm text-muted">{item.body}</p>
            </Card>
          ))}
        </div>
      </section>

      {/* Platform sections */}
      <section className="space-y-6">
        <h2 className="text-lg font-semibold">Explore the platform</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {SECTIONS.map((section) => (
            <Link key={section.href} href={section.href} className="group">
              <Card className="h-full transition-colors group-hover:border-brand/50">
                <h3 className="text-base font-semibold">{section.title}</h3>
                <p className="mt-2 text-sm text-muted">{section.body}</p>
                <span className="mt-4 inline-block text-sm text-brand">Open →</span>
              </Card>
            </Link>
          ))}
        </div>
      </section>
    </div>
  );
}
