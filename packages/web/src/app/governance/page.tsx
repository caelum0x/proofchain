"use client";

import Link from "next/link";
import { useProposals } from "@/hooks/useGovernance";
import { PageHeader, KpiRow, AsyncBoundary } from "@/components/page";
import { CardGrid } from "@/components/ui/CardGrid";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { Skeleton } from "@/components/ui/Skeleton";
import { ProposalCard } from "@/components/governance/ProposalCard";
import { GovTokenPanel } from "@/components/governance/GovTokenPanel";
import { RequireWallet } from "@/components/RequireWallet";
import { getErrorMessage } from "@/lib/errors";

/**
 * Governance index (WD §3): PROOF holders propose and vote on protocol
 * parameters. Proposal cards headline; the token/delegation panel sits in the rail.
 */
export default function GovernancePage() {
  const { proposals, isLoading, isError, error, refetch, notDeployed } = useProposals();

  return (
    <div className="space-y-6">
      <PageHeader
        icon="governance"
        title="Governance"
        subtitle="PROOF holders propose and vote on protocol parameters — fees, thresholds, and emissions."
        breadcrumbs={[{ label: "Governance" }, { label: "Proposals" }]}
        actions={
          <Link href="/voting">
            <Button variant="secondary" size="sm">
              Go to voting
            </Button>
          </Link>
        }
      />

      <KpiRow
        items={[
          { label: "Proposals", value: proposals.length, loading: isLoading },
          { label: "Governance token", value: "PROOF" },
          { label: "Voting model", value: "Token-weighted" },
        ]}
      />

      {notDeployed ? (
        <Callout tone="warn" title="Governor not deployed">
          The ProofChainGovernor is not configured on this network.
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
              emptyDescription="Proposals created on the Governor appear here with their live vote tally and state."
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
              <GovTokenPanel />
            </RequireWallet>
          </div>
        </div>
      )}
    </div>
  );
}
