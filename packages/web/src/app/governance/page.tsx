"use client";

import { useProposals } from "@/hooks/useGovernance";
import { ProposalCard } from "@/components/governance/ProposalCard";
import { GovTokenPanel } from "@/components/governance/GovTokenPanel";
import { RequireWallet } from "@/components/RequireWallet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { getErrorMessage } from "@/lib/errors";

export default function GovernancePage() {
  const { proposals, isLoading, isError, error, refetch, notDeployed } = useProposals();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Governance</h1>
        <p className="mt-1 text-sm text-muted">
          PROOF holders propose and vote on protocol parameters — fees, thresholds, and emissions.
          Delegate your tokens to activate voting power.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {notDeployed ? (
            <EmptyState title="Governor not deployed" description="The ProofChainGovernor is not configured on this network." />
          ) : isLoading ? (
            <LoadingState label="Loading proposals…" />
          ) : isError ? (
            <ErrorState message={getErrorMessage(error)} onRetry={refetch} />
          ) : proposals.length === 0 ? (
            <EmptyState
              title="No proposals yet"
              description="Proposals created on the Governor will appear here with their live vote tally and state."
            />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {proposals.map((proposal) => (
                <ProposalCard key={proposal.id} proposal={proposal} />
              ))}
            </div>
          )}
        </div>

        <div>
          <RequireWallet>
            <GovTokenPanel />
          </RequireWallet>
        </div>
      </div>
    </div>
  );
}
