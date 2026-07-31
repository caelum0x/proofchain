"use client";

import Link from "next/link";
import { useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { AddressLink } from "@/components/ui/TxLink";
import { Card } from "@/components/ui/Card";
import { ProposalStateBadge } from "./ProposalStateBadge";
import type { ProposalSummary } from "@/hooks/useGovernance";

/** Compact proposal card for the governance index; reads its live state. */
export function ProposalCard({ proposal }: { proposal: ProposalSummary }) {
  const gov = tryContractRef("ProofChainGovernor");
  const stateQuery = useReadContract({
    address: gov?.address,
    abi: gov?.abi,
    functionName: "state",
    args: [BigInt(proposal.id)],
    query: { enabled: Boolean(gov) },
  });

  const title = firstLine(proposal.description) || `Proposal ${shortId(proposal.id)}`;

  return (
    <Link href={`/governance/proposals/${proposal.id}`} className="group block">
      <Card className="h-full transition-colors group-hover:border-brand/50">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base font-semibold">{title}</h3>
          <ProposalStateBadge state={stateQuery.data === undefined ? undefined : Number(stateQuery.data)} />
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-muted">
          {restOfDescription(proposal.description) || "No description provided."}
        </p>
        <p className="mt-3 text-xs text-muted">
          By <AddressLink address={proposal.proposer} /> · id {shortId(proposal.id)}
        </p>
      </Card>
    </Link>
  );
}

function firstLine(text: string): string {
  return text.split("\n")[0]?.trim() ?? "";
}

function restOfDescription(text: string): string {
  const parts = text.split("\n");
  return parts.slice(1).join(" ").trim() || firstLine(text);
}

function shortId(id: string): string {
  return id.length > 12 ? `${id.slice(0, 6)}…${id.slice(-4)}` : id;
}
