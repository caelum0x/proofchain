"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { ClaimState, PolicyState } from "@proofchain/shared";
import { PageHeader } from "@/components/page";
import {
  Badge,
  Button,
  Card,
  CardHeader,
  DataTable,
  KpiRow,
  Meter,
  type Column,
} from "@/components/ui";
import { usePolicies } from "@/hooks/usePolicies";
import { useClaims } from "@/hooks/useClaims";
import { useInsurancePool } from "@/hooks/useInsurancePool";
import { useUsdc } from "@/hooks/useUsdc";
import { NotAvailable } from "@/components/t3/NotAvailable";
import { claimLabel, claimTone, policyLabel, policyTone } from "@/components/t3/insurance-view";
import { formatBps, formatTokenAmount, shortenHex } from "@/lib/format";
import { getResolvedAddress } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";
import type { PolicyRecord, ClaimRecord } from "@/lib/insurance";

/** Insurance overview (WD §3): pool health + recent policies and claims. */
export default function InsurancePage() {
  const router = useRouter();
  const pool = useInsurancePool();
  const usdc = useUsdc();
  const policiesQ = usePolicies();
  const claimsQ = useClaims();

  const deployed = Boolean(getResolvedAddress("InsurancePool") && getResolvedAddress("PolicyManager"));
  const fmt = (v: bigint) => `${formatTokenAmount(v, usdc.decimals)} ${usdc.symbol}`;

  const activePolicies = policiesQ.policies.filter((p) => p.state === PolicyState.Active).length;
  const openClaims = claimsQ.claims.filter((c) => c.state === ClaimState.Filed || c.state === ClaimState.Approved).length;

  const recentPolicies = policiesQ.policies.slice(0, 5);
  const recentClaims = claimsQ.claims.slice(0, 5);

  const policyCols: Column<PolicyRecord>[] = [
    { id: "policyId", header: "Policy", cell: (p) => <span className="font-mono text-xs">{shortenHex(p.policyId, 5, 5)}</span> },
    {
      id: "coverage",
      header: "Coverage",
      align: "right",
      cell: (p) => <span className="font-mono tabular-nums">{fmt(p.coverage ?? 0n)}</span>,
    },
    { id: "state", header: "Status", cell: (p) => <Badge tone={policyTone(p.state)}>{policyLabel(p.state)}</Badge> },
  ];
  const claimCols: Column<ClaimRecord>[] = [
    { id: "claimId", header: "Claim", cell: (c) => <span className="font-mono text-xs">{shortenHex(c.claimId, 5, 5)}</span> },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      cell: (c) => <span className="font-mono tabular-nums">{fmt(c.amount ?? 0n)}</span>,
    },
    { id: "state", header: "Status", cell: (c) => <Badge tone={claimTone(c.state)}>{claimLabel(c.state)}</Badge> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="insurance"
        accentClassName="text-compliance"
        title="Insurance"
        subtitle="Underwrite shipment and credit cover, buy policies, and settle claims."
        breadcrumbs={[{ label: "Insurance" }]}
        actions={
          <>
            <Link href="/insurance/pools">
              <Button variant="secondary">Pools</Button>
            </Link>
            <Link href="/insurance/policies">
              <Button>Policies</Button>
            </Link>
          </>
        }
      />

      {!deployed ? (
        <NotAvailable resource="Insurance" />
      ) : (
        <>
          <KpiRow
            items={[
              { label: "Pool capital", value: fmt(pool.totalCapital), loading: pool.isLoading },
              { label: "Active policies", value: activePolicies.toLocaleString(), hintTone: "success", loading: policiesQ.isLoading },
              { label: "Open claims", value: openClaims.toLocaleString(), hint: "filed / approved", hintTone: "warn", loading: claimsQ.isLoading },
              { label: "Reserved", value: formatBps(pool.reservedRatioBps), hint: "of capital", loading: pool.isLoading },
            ]}
          />

          <Card className="space-y-4">
            <CardHeader title="Pool health" description="Reserved capital as a share of total underwriting capital." />
            <Meter value={pool.reservedRatioBps / 100} min={0} max={100} low={50} high={80} invert showValue label="Reserved" />
            <div className="grid grid-cols-3 gap-4 border-t border-border pt-4 text-sm">
              <Figure label="Total" value={fmt(pool.totalCapital)} />
              <Figure label="Available" value={fmt(pool.availableCapital)} />
              <Figure label="Reserved" value={fmt(pool.reservedCapital)} />
            </div>
          </Card>

          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <CardHeader title="Recent policies" />
                <Link href="/insurance/policies" className="text-sm text-brand hover:underline">
                  View all
                </Link>
              </div>
              <DataTable
                columns={policyCols}
                rows={recentPolicies}
                getRowKey={(p) => p.policyId}
                onRowClick={(p) => router.push(`/insurance/policies/${p.policyId}`)}
                isLoading={policiesQ.isLoading}
                error={policiesQ.isError ? getErrorMessage(policiesQ.error) : null}
                onRetry={() => void policiesQ.refetch()}
                emptyTitle="No policies yet"
                emptyDescription="Buy cover on a batch to see it here."
              />
            </Card>

            <Card className="space-y-3">
              <div className="flex items-center justify-between">
                <CardHeader title="Recent claims" />
                <Link href="/insurance/claims" className="text-sm text-brand hover:underline">
                  View all
                </Link>
              </div>
              <DataTable
                columns={claimCols}
                rows={recentClaims}
                getRowKey={(c) => c.claimId}
                onRowClick={(c) => router.push(`/insurance/claims/${c.claimId}`)}
                isLoading={claimsQ.isLoading}
                error={claimsQ.isError ? getErrorMessage(claimsQ.error) : null}
                onRetry={() => void claimsQ.refetch()}
                emptyTitle="No claims yet"
                emptyDescription="Claims filed against policies appear here."
              />
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Figure({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 font-mono font-semibold tabular-nums text-fg">{value}</dd>
    </div>
  );
}
