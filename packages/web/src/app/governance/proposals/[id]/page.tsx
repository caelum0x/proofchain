"use client";

import { useParams } from "next/navigation";
import { useProposal } from "@/hooks/useGovernance";
import { ProposalStateBadge } from "@/components/governance/ProposalStateBadge";
import { CastVotePanel } from "@/components/governance/CastVotePanel";
import { DescribeProposalForm } from "@/components/governance/DescribeProposalForm";
import { GovTokenPanel } from "@/components/governance/GovTokenPanel";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { AddressLink } from "@/components/ui/TxLink";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

const PROOF_DECIMALS = 18;

export default function ProposalDetailPage() {
  const params = useParams<{ id: string }>();
  const raw = Array.isArray(params.id) ? params.id[0] : params.id;
  const id = raw && /^\d+$/.test(raw) ? raw : undefined;

  const proposal = useProposal(id);

  if (!id) {
    return <ErrorState title="Invalid proposal id" message="The URL does not contain a valid numeric proposal id." />;
  }

  const forVotes = proposal.votesFor ?? 0n;
  const againstVotes = proposal.votesAgainst ?? 0n;
  const abstainVotes = proposal.votesAbstain ?? 0n;
  const total = forVotes + againstVotes + abstainVotes;
  const pct = (v: bigint) => (total > 0n ? Number((v * 10000n) / total) / 100 : 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Proposal</h1>
          <p className="font-mono text-xs text-muted">id {id}</p>
        </div>
        <ProposalStateBadge state={proposal.state} />
      </div>

      {proposal.isLoading ? (
        <LoadingState label="Loading proposal…" />
      ) : proposal.isError ? (
        <ErrorState message={getErrorMessage(proposal.error)} onRetry={proposal.refetch} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Overview" />
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <Info label="Proposer">
                  {proposal.proposer ? <AddressLink address={proposal.proposer} /> : "—"}
                </Info>
                <Info label="Snapshot block">{proposal.snapshot ? String(proposal.snapshot) : "—"}</Info>
                <Info label="Deadline block">{proposal.deadline ? String(proposal.deadline) : "—"}</Info>
                <Info label="Metadata">
                  {proposal.metadataUri ? (
                    <a href={proposal.metadataUri} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">
                      View
                    </a>
                  ) : (
                    "None"
                  )}
                </Info>
              </dl>
            </Card>

            <Card>
              <CardHeader title="Vote tally" />
              <div className="space-y-3">
                <Tally label="For" value={forVotes} pct={pct(forVotes)} tone="bg-success" decimals={PROOF_DECIMALS} />
                <Tally label="Against" value={againstVotes} pct={pct(againstVotes)} tone="bg-danger" decimals={PROOF_DECIMALS} />
                <Tally label="Abstain" value={abstainVotes} pct={pct(abstainVotes)} tone="bg-muted" decimals={PROOF_DECIMALS} />
              </div>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader title="Cast your vote" />
              <RequireWallet>
                <CastVotePanel
                  proposalId={id}
                  state={proposal.state}
                  hasVoted={proposal.hasVoted}
                  onDone={proposal.refetch}
                />
              </RequireWallet>
            </Card>

            <RequireWallet>
              <GovTokenPanel />
            </RequireWallet>

            {!proposal.metadataUri ? (
              <Card>
                <CardHeader title="Add metadata" description="Attach a human-readable description URI to this proposal." />
                <RequireWallet>
                  <DescribeProposalForm proposalId={id} onDone={proposal.refetch} />
                </RequireWallet>
              </Card>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}

function Tally({
  label,
  value,
  pct,
  tone,
  decimals,
}: {
  label: string;
  value: bigint;
  pct: number;
  tone: string;
  decimals: number;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted">
          {formatTokenAmount(value, decimals)} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full ${tone}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
