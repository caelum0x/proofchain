"use client";

import { useParams } from "next/navigation";
import { useProposal } from "@/hooks/useGovernance";
import { ProposalStateBadge } from "@/components/governance/ProposalStateBadge";
import { CastVotePanel } from "@/components/governance/CastVotePanel";
import { DescribeProposalForm } from "@/components/governance/DescribeProposalForm";
import { GovTokenPanel } from "@/components/governance/GovTokenPanel";
import { RequireWallet } from "@/components/RequireWallet";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page";
import { Card, CardHeader } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
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
    return (
      <ErrorState
        title="Invalid proposal id"
        message="The URL does not contain a valid numeric proposal id."
      />
    );
  }

  const forVotes = proposal.votesFor ?? 0n;
  const againstVotes = proposal.votesAgainst ?? 0n;
  const abstainVotes = proposal.votesAbstain ?? 0n;
  const total = forVotes + againstVotes + abstainVotes;
  const pct = (v: bigint) => (total > 0n ? Number((v * 10000n) / total) / 100 : 0);

  const header = (
    <PageHeader
      icon="proposals"
      title={`Proposal #${id.length > 10 ? `${id.slice(0, 6)}…` : id}`}
      subtitle="On-chain governance proposal"
      breadcrumbs={[
        { label: "Governance" },
        { label: "Proposals", href: "/governance" },
        { label: `#${id.length > 8 ? id.slice(0, 6) : id}` },
      ]}
      actions={<ProposalStateBadge state={proposal.state} />}
    />
  );

  if (proposal.isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingState label="Loading proposal…" />
      </div>
    );
  }
  if (proposal.isError) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState message={getErrorMessage(proposal.error)} onRetry={proposal.refetch} />
      </div>
    );
  }

  return (
    <DetailShell
      header={header}
      rail={
        <>
          <Card>
            <CardHeader title="Details" />
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Proposer</dt>
                <dd className="mt-0.5">
                  {proposal.proposer ? <AddressBadge address={proposal.proposer} /> : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Snapshot block</dt>
                <dd className="mt-0.5 font-mono text-fg">
                  {proposal.snapshot ? String(proposal.snapshot) : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs uppercase tracking-wide text-muted">Deadline block</dt>
                <dd className="mt-0.5 font-mono text-fg">
                  {proposal.deadline ? String(proposal.deadline) : "—"}
                </dd>
              </div>
              {proposal.metadataUri ? (
                <div>
                  <dt className="text-xs uppercase tracking-wide text-muted">Metadata</dt>
                  <dd className="mt-0.5">
                    <a
                      href={proposal.metadataUri}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="text-brand hover:underline"
                    >
                      View document
                    </a>
                  </dd>
                </div>
              ) : null}
            </dl>
          </Card>

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
        </>
      }
    >
      <Card>
        <CardHeader title="Vote tally" description={`${formatTokenAmount(total, PROOF_DECIMALS)} PROOF cast`} />
        <div className="space-y-4">
          <Tally label="For" value={forVotes} pct={pct(forVotes)} tone="success" />
          <Tally label="Against" value={againstVotes} pct={pct(againstVotes)} tone="danger" />
          <Tally label="Abstain" value={abstainVotes} pct={pct(abstainVotes)} tone="neutral" />
        </div>
      </Card>

      {!proposal.metadataUri ? (
        <Card>
          <CardHeader
            title="Add metadata"
            description="Attach a human-readable description URI to this proposal."
          />
          <RequireWallet>
            <DescribeProposalForm proposalId={id} onDone={proposal.refetch} />
          </RequireWallet>
        </Card>
      ) : null}
    </DetailShell>
  );
}

function Tally({
  label,
  value,
  pct,
  tone,
}: {
  label: string;
  value: bigint;
  pct: number;
  tone: "success" | "danger" | "neutral";
}) {
  const bar: Record<typeof tone, string> = {
    success: "bg-success",
    danger: "bg-danger",
    neutral: "bg-muted",
  };
  return (
    <div>
      <div className="flex items-center justify-between text-sm">
        <span className="text-fg">{label}</span>
        <span className="font-mono text-muted">
          {formatTokenAmount(value, PROOF_DECIMALS)} ({pct.toFixed(1)}%)
        </span>
      </div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-surface-2">
        <div className={`h-full ${bar[tone]}`} style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </div>
  );
}
