"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ClaimState } from "@proofchain/shared";
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
import { useClaims } from "@/hooks/useClaims";
import { useUsdc } from "@/hooks/useUsdc";
import { useT3ListParams } from "@/hooks/useT3ListParams";
import { SearchParamsBoundary } from "@/components/t3/SearchParamsBoundary";
import { ListToolbar } from "@/components/t3/ListToolbar";
import { NotAvailable } from "@/components/t3/NotAvailable";
import { FileClaimForm } from "@/components/insurance/FileClaimForm";
import {
  CLAIM_STATUS_OPTIONS,
  claimLabel,
  claimSortKey,
  claimTone,
  matchesClaim,
} from "@/components/t3/insurance-view";
import { PAGE_SIZE, downloadCsv, paginate, sortRows, toCsv } from "@/components/t3/list-utils";
import { formatTokenAmount, shortenHex } from "@/lib/format";
import { getResolvedAddress } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";
import type { ClaimRecord } from "@/lib/insurance";

function ClaimsContent() {
  const router = useRouter();
  const params = useT3ListParams({ defaultSort: "amount", defaultDir: "desc" });
  const { claims, isLoading, isError, error, refetch } = useClaims();
  const usdc = useUsdc();
  const [fileOpen, setFileOpen] = useState(false);

  const deployed = Boolean(getResolvedAddress("ClaimsProcessor"));

  const filtered = useMemo(
    () => claims.filter((c) => matchesClaim(c, params.state.q, params.state.status)),
    [claims, params.state.q, params.state.status],
  );
  const sorted = useMemo(
    () => sortRows(filtered, claimSortKey, params.state.sort, params.state.dir),
    [filtered, params.state.sort, params.state.dir],
  );
  const pageRows = useMemo(() => paginate(sorted, params.state.page), [sorted, params.state.page]);

  const filed = claims.filter((c) => c.state === ClaimState.Filed).length;
  const approved = claims.filter((c) => c.state === ClaimState.Approved).length;
  const paid = claims.filter((c) => c.state === ClaimState.Paid).length;
  const totalClaimed = claims.reduce((acc, c) => acc + (c.amount ?? 0n), 0n);

  const columns: Column<ClaimRecord>[] = [
    { id: "claimId", header: "Claim", sortable: true, cell: (c) => <span className="font-mono text-sm">{shortenHex(c.claimId, 6, 6)}</span> },
    {
      id: "policyId",
      header: "Policy",
      className: "hidden sm:table-cell",
      cell: (c) => (c.policyId ? <span className="font-mono text-xs text-muted">{shortenHex(c.policyId)}</span> : "—"),
    },
    { id: "claimant", header: "Claimant", cell: (c) => (c.claimant ? <AddressBadge address={c.claimant} explorer={false} /> : "—") },
    {
      id: "amount",
      header: "Amount",
      align: "right",
      sortable: true,
      cell: (c) => (
        <span className="font-mono tabular-nums">
          {formatTokenAmount(c.amount ?? 0n, usdc.decimals)} {usdc.symbol}
        </span>
      ),
    },
    { id: "state", header: "Status", sortable: true, cell: (c) => <Badge tone={claimTone(c.state)}>{claimLabel(c.state)}</Badge> },
  ];

  const onExport = () => {
    const csv = toCsv(
      ["claimId", "policyId", "claimant", "amount", "status"],
      sorted.map((c) => [
        c.claimId,
        c.policyId ?? "",
        c.claimant ?? "",
        formatTokenAmount(c.amount ?? 0n, usdc.decimals),
        claimLabel(c.state),
      ]),
    );
    downloadCsv("claims.csv", csv);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="claims"
        accentClassName="text-compliance"
        title="Claims"
        subtitle="File claims and track them through arbiter review and settlement."
        breadcrumbs={[{ label: "Insurance", href: "/insurance" }, { label: "Claims" }]}
        actions={
          <Button onClick={() => setFileOpen(true)} disabled={!deployed}>
            File claim
          </Button>
        }
      />

      {!deployed ? (
        <NotAvailable resource="Claims" />
      ) : (
        <>
          <KpiRow
            items={[
              { label: "Total claims", value: claims.length.toLocaleString(), loading: isLoading },
              { label: "Filed", value: filed.toLocaleString(), hint: "awaiting review", hintTone: "warn", loading: isLoading },
              { label: "Approved", value: approved.toLocaleString(), hint: "payable", hintTone: "brand", loading: isLoading },
              {
                label: "Total claimed",
                value: `${formatTokenAmount(totalClaimed, usdc.decimals)} ${usdc.symbol}`,
                hint: `${paid} paid`,
                loading: isLoading,
              },
            ]}
          />

          <ListToolbar
            params={params}
            statusOptions={CLAIM_STATUS_OPTIONS}
            searchPlaceholder="Search claim, policy, claimant…"
            onExport={sorted.length > 0 ? onExport : undefined}
          />

          <DataTable
            columns={columns}
            rows={pageRows}
            getRowKey={(c) => c.claimId}
            onRowClick={(c) => router.push(`/insurance/claims/${c.claimId}`)}
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={() => void refetch()}
            sort={params.state.sort ? { id: params.state.sort, dir: params.state.dir } : null}
            onSortChange={params.setSort}
            emptyTitle="No claims match"
            emptyDescription="Adjust filters or file a claim against one of your policies."
          />

          <Pagination page={params.state.page} limit={PAGE_SIZE} total={sorted.length} onPageChange={params.setPage} />
        </>
      )}

      <Dialog open={fileOpen} onClose={() => setFileOpen(false)} title="File a claim">
        <FileClaimForm
          decimals={usdc.decimals}
          symbol={usdc.symbol}
          onFiled={() => {
            setFileOpen(false);
            void refetch();
          }}
        />
      </Dialog>
    </div>
  );
}

/** Insurance › Claims list (WD §3): KPI row, URL-driven filters, table, paging. */
export default function ClaimsPage() {
  return (
    <SearchParamsBoundary>
      <ClaimsContent />
    </SearchParamsBoundary>
  );
}
