import Link from "next/link";
import { Card } from "@/components/ui/Card";

const FLOWS = [
  {
    href: "/supplier",
    title: "Supplier",
    body: "Register shipment batches, append provenance checkpoints, upload documents, and request AI verification.",
  },
  {
    href: "/buyer",
    title: "Buyer",
    body: "Approve MockUSDC and fund an escrow deal, then watch autonomous settlement release funds on a passing attestation.",
  },
  {
    href: "/verifier",
    title: "Verifier",
    body: "Live dashboard of every batch: provenance trail, attestation score, findings, and settlement state — updated in real time.",
  },
] as const;

export default function HomePage() {
  return (
    <div className="space-y-10">
      <section className="space-y-4">
        <span className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-3 py-1 text-xs text-muted">
          <span className="h-2 w-2 rounded-full bg-success" /> Base Sepolia · testnet
        </span>
        <h1 className="max-w-2xl text-3xl font-semibold tracking-tight sm:text-4xl">
          AI-verified supply-chain provenance with autonomous on-chain settlement.
        </h1>
        <p className="max-w-2xl text-muted">
          An AI agent inspects shipment documents, cross-checks them against an on-chain
          provenance trail, writes a signed attestation, and releases stablecoin payment for clean
          shipments. Fraudulent shipments are held for dispute.
        </p>
      </section>

      <section className="grid gap-4 sm:grid-cols-3">
        {FLOWS.map((flow) => (
          <Link key={flow.href} href={flow.href} className="group">
            <Card className="h-full transition-colors group-hover:border-brand/50">
              <h2 className="text-lg font-semibold">{flow.title}</h2>
              <p className="mt-2 text-sm text-muted">{flow.body}</p>
              <span className="mt-4 inline-block text-sm text-brand">Open {flow.title} →</span>
            </Card>
          </Link>
        ))}
      </section>
    </div>
  );
}
