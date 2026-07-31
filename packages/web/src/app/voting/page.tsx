"use client";

import { useMemo } from "react";
import { useProposals, useGovToken } from "@/hooks/useGovernance";
import { PageHeader, KpiRow, AsyncBoundary } from "@/components/page";
import { CardGrid } from "@/components/ui/CardGrid";
import { Callout } from "@/components/ui/Callout";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProposalCard } from "@/components/governance/ProposalCard";
import { DelegatePanel } from "@/components/t6/DelegatePanel";
import { RequireWallet } from "@/components/RequireWallet";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

const PROOF_DECIMALS = 18;

/**
 * Voting hub: the holder-facing view of governance. Surfaces the connected
 * account's voting power (with a delegate panel to activate it) and the full
 * proposal list to cast votes on. Detailed tallies live on each proposal page.
 */
export default function VotingPage() {
  const { proposals, isLoading, isError, error, refetch, notDeployed } = useProposals();
  const gov = useGovToken();

  const votingPower = useMemo(
    () => formatTokenAmount(gov.votes, PROOF_DECIMALS),
    [gov.votes],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        icon="voting"
        title="Voting"
        subtitle="Cast votes on protocol proposals. Voting power comes from delegated PROOF at each proposal's snapshot."
        breadcrumbs={[{ label: "Governance" }, { label: "Voting" }]}
      />

      <KpiRow
        items={[
          { label: "Proposals", value: proposals.length, loading: isLoading },
          {
            label: "Your voting power",
            value: gov.token ? votingPower : "—",
            hintTone: gov.isSelfDelegated ? "success" : "warn",
            hint: gov.isSelfDelegated ? "Active" : gov.hasDelegated ? "Delegated out" : "Inactive",
            loading: gov.isLoading,
          },
          {
            label: "PROOF balance",
            value: gov.token ? formatTokenAmount(gov.balance, PROOF_DECIMALS) : "—",
            loading: gov.isLoading,
          },
        ]}
      />

      {notDeployed ? (
        <Callout tone="warn" title="Governor not deployed">
          The ProofChainGovernor contract is not configured on this network.
        </Callout>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <AsyncBoundary
              isLoading={isLoading}
              error={isError ? getErrorMessage(error) : null}
              onRetry={refetch}
              isEmpty={proposals.length === 0}
              emptyTitle="No proposals yet"
              emptyDescription="Proposals appear here with their live state once created on the Governor."
              loading={
                <div className="grid gap-4 sm:grid-cols-2">
                  {Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-32" />
                  ))}
                </div>
              }
            >
              <CardGrid
                items={proposals}
                getKey={(p) => p.id}
                minColWidth={280}
                renderItem={(p) => <ProposalCard proposal={p} />}
              />
            </AsyncBoundary>
          </div>

          <div>
            <RequireWallet>
              <DelegatePanel />
            </RequireWallet>
          </div>
        </div>
      )}
    </div>
  );
}
