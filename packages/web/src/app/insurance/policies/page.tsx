"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/page";
import {
  AddressBadge,
  Badge,
  Button,
  DataTable,
  Dialog,
  KpiRow,
  Pagination,
  type Column,
} from "@/components/ui";
import { usePolicies } from "@/hooks/usePolicies";
import { useInsurancePool } from "@/hooks/useInsurancePool";
import { useUsdc } from "@/hooks/useUsdc";
import { useT3ListParams } from "@/hooks/useT3ListParams";
import { SearchParamsBoundary } from "@/components/t3/SearchParamsBoundary";
import { ListToolbar } from "@/components/t3/ListToolbar";
import { NotAvailable } from "@/components/t3/NotAvailable";
import { BuyPolicyForm } from "@/components/insurance/BuyPolicyForm";
import {
  POLICY_STATUS_OPTIONS,
  matchesPolicy,
  policyLabel,
  policySortKey,
  policyTone,
} from "@/components/t3/insurance-view";
import { PAGE_SIZE, downloadCsv, paginate, sortRows, toCsv } from "@/components/t3/list-utils";
import { PolicyState } from "@proofchain/shared";
import { formatBps, formatTokenAmount, shortenHex } from "@/lib/format";
import { getResolvedAddress } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";
import type { PolicyRecord } from "@/lib/insurance";

function PoliciesContent() {
  const router = useRouter();
  const params = useT3ListParams({ defaultSort: "coverage", defaultDir: "desc" });
  const { policies, isLoading, isError, error, refetch } = usePolicies();
  const pool = useInsurancePool();
  const usdc = useUsdc();
  const [buyOpen, setBuyOpen] = useState(false);

  const deployed = Boolean(getResolvedAddress("PolicyManager") && getResolvedAddress("InsurancePool"));

  const filtered = useMemo(
    () => policies.filter((p) => matchesPolicy(p, params.state.q, params.state.status)),
    [policies, params.state.q, params.state.status],
  );
  const sorted = useMemo(
    () => sortRows(filtered, policySortKey, params.state.sort, params.state.dir),
    [filtered, params.state.sort, params.state.dir],
  );
  const pageRows = useMemo(() => paginate(sorted, params.state.page), [sorted, params.state.page]);

  const activeCount = policies.filter((p) => p.state === PolicyState.Active).length;
  const totalCoverage = policies.reduce((acc, p) => acc + (p.coverage ?? 0n), 0n);

  const columns: Column<PolicyRecord>[] = [
    {
      id: "policyId",
      header: "Policy",
      sortable: true,
      cell: (p) => <span className="font-mono text-sm">{shortenHex(p.policyId, 6, 6)}</span>,
    },
    {
      id: "batchId",
      header: "Batch",
      cell: (p) => (p.batchId ? <span className="font-mono text-xs text-muted">{shortenHex(p.batchId)}</span> : "—"),
    },
    {
      id: "holder",
      header: "Holder",
      cell: (p) => (p.holder ? <AddressBadge address={p.holder} explorer={false} /> : "—"),
    },
    {
      id: "coverage",
      header: "Coverage",
      align: "right",
      sortable: true,
      cell: (p) => (
        <span className="font-mono tabular-nums">
          {formatTokenAmount(p.coverage ?? 0n, usdc.decimals)} {usdc.symbol}
        </span>
      ),
    },
    {
      id: "premium",
      header: "Premium",
      align: "right",
      sortable: true,
      className: "hidden md:table-cell",
      cell: (p) => (
        <span className="font-mono tabular-nums text-muted">
          {formatTokenAmount(p.premium ?? 0n, usdc.decimals)}
        </span>
      ),
    },
    {
      id: "state",
      header: "Status",
      sortable: true,
      cell: (p) => <Badge tone={policyTone(p.state)}>{policyLabel(p.state)}</Badge>,
    },
  ];

  const onExport = () => {
    const csv = toCsv(
      ["policyId", "batchId", "holder", "coverage", "premium", "status"],
      sorted.map((p) => [
        p.policyId,
        p.batchId ?? "",
        p.holder ?? "",
        formatTokenAmount(p.coverage ?? 0n, usdc.decimals),
        formatTokenAmount(p.premium ?? 0n, usdc.decimals),
        policyLabel(p.state),
      ]),
    );
    downloadCsv("policies.csv", csv);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="certificate"
        accentClassName="text-compliance"
        title="Policies"
        subtitle="Every cover issued against a batch by the PolicyManager."
        breadcrumbs={[{ label: "Insurance", href: "/insurance" }, { label: "Policies" }]}
        actions={
          <Button onClick={() => setBuyOpen(true)} disabled={!deployed}>
            Buy policy
          </Button>
        }
      />

      {!deployed ? (
        <NotAvailable resource="Policies" />
      ) : (
        <>
          <KpiRow
            items={[
              { label: "Total policies", value: policies.length.toLocaleString(), loading: isLoading },
              { label: "Active", value: activeCount.toLocaleString(), hint: "in force", hintTone: "success", loading: isLoading },
              {
                label: "Total coverage",
                value: `${formatTokenAmount(totalCoverage, usdc.decimals)} ${usdc.symbol}`,
                loading: isLoading,
              },
              {
                label: "Pool reserved",
                value: formatBps(pool.reservedRatioBps),
                hint: "of capital",
                hintTone: pool.reservedRatioBps > 8000 ? "warn" : "neutral",
                loading: pool.isLoading,
              },
            ]}
          />

          <ListToolbar
            params={params}
            statusOptions={POLICY_STATUS_OPTIONS}
            searchPlaceholder="Search policy, batch, holder…"
            onExport={sorted.length > 0 ? onExport : undefined}
          />

          <DataTable
            columns={columns}
            rows={pageRows}
            getRowKey={(p) => p.policyId}
            onRowClick={(p) => router.push(`/insurance/policies/${p.policyId}`)}
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={() => void refetch()}
            sort={params.state.sort ? { id: params.state.sort, dir: params.state.dir } : null}
            onSortChange={params.setSort}
            emptyTitle="No policies match"
            emptyDescription="Adjust filters or buy cover on a batch to get started."
          />

          <Pagination
            page={params.state.page}
            limit={PAGE_SIZE}
            total={sorted.length}
            onPageChange={params.setPage}
          />
        </>
      )}

      <Dialog open={buyOpen} onClose={() => setBuyOpen(false)} title="Buy a policy" description="Insure a shipment against loss or dispute.">
        <BuyPolicyForm
          onIssued={() => {
            setBuyOpen(false);
            void refetch();
          }}
        />
      </Dialog>
    </div>
  );
}

/** Insurance › Policies list (WD §3): KPI row, URL-driven filters, table, paging. */
export default function PoliciesPage() {
  return (
    <SearchParamsBoundary>
      <PoliciesContent />
    </SearchParamsBoundary>
  );
}
