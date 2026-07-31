"use client";

import { useMemo } from "react";
import { useRouter } from "next/navigation";
import { getErrorMessage } from "@/lib/errors";
import { DealState, type DealStateValue } from "@/lib/types";
import { formatTokenAmount } from "@/lib/format";
import { useSettlementDeals, type SettlementDealRecord } from "@/hooks/settlementDeals";
import { useUsdc } from "@/hooks/useUsdc";
import { useTradeUrlState } from "@/hooks/tradeUrlState";
import { PageHeader, Toolbar, FilterBar } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { StatusBadge, type SemanticStatus } from "@/components/ui/StatusBadge";
import { Callout } from "@/components/ui/Callout";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Bytes32Cell } from "@/components/t2/Bytes32Cell";
import { Money } from "@/components/t2/Money";
import { NotDeployedState } from "@/components/t2/NotDeployedState";
import { SearchParamsBoundary } from "@/components/t2/SearchParamsBoundary";

/** Documentary-credit status derived from the backing escrow deal state. */
function lcStatus(state: DealStateValue): { label: string; tone: SemanticStatus } {
  switch (state) {
    case DealState.Funded:
      return { label: "Live", tone: "brand" };
    case DealState.Released:
      return { label: "Honoured", tone: "success" };
    case DealState.Disputed:
      return { label: "Under review", tone: "danger" };
    case DealState.Refunded:
      return { label: "Cancelled", tone: "warn" };
    default:
      return { label: "Draft", tone: "neutral" };
  }
}

const STATE_OPTIONS = [
  { value: "", label: "All credits" },
  { value: String(DealState.Funded), label: "Live" },
  { value: String(DealState.Released), label: "Honoured" },
  { value: String(DealState.Disputed), label: "Under review" },
  { value: String(DealState.Refunded), label: "Cancelled" },
];

export default function LettersOfCreditPage() {
  return (
    <SearchParamsBoundary>
      <LettersOfCreditContent />
    </SearchParamsBoundary>
  );
}

function LettersOfCreditContent() {
  const router = useRouter();
  const url = useTradeUrlState();
  const { deals, isLoading, isError, error, refetch, deployed } = useSettlementDeals();
  const usdc = useUsdc();

  const q = url.get("q").toLowerCase();
  const stateFilter = url.get("state");

  const rows = useMemo(() => {
    let out = deals.slice();
    if (stateFilter) out = out.filter((d) => String(d.state) === stateFilter);
    if (q) {
      out = out.filter(
        (d) => d.batchId.toLowerCase().includes(q) || (d.buyer?.toLowerCase().includes(q) ?? false) || (d.supplier?.toLowerCase().includes(q) ?? false),
      );
    }
    return out;
  }, [deals, stateFilter, q]);

  const stats = useMemo(() => {
    const live = deals.filter((d) => d.state === DealState.Funded);
    const exposure = live.reduce((s, d) => s + d.amount, 0n);
    return {
      total: deals.length,
      live: live.length,
      exposure,
      honoured: deals.filter((d) => d.state === DealState.Released).length,
    };
  }, [deals]);

  const columns: readonly Column<SettlementDealRecord>[] = [
    { id: "ref", header: "Credit ref", cell: (d) => <Bytes32Cell value={d.batchId} href={`/letters-of-credit/${d.batchId}`} /> },
    {
      id: "applicant",
      header: "Applicant",
      className: "hidden md:table-cell",
      cell: (d) => (d.buyer ? <AddressBadge address={d.buyer} explorer={false} /> : <span className="text-faint">—</span>),
    },
    {
      id: "beneficiary",
      header: "Beneficiary",
      className: "hidden lg:table-cell",
      cell: (d) => (d.supplier ? <AddressBadge address={d.supplier} explorer={false} /> : <span className="text-faint">—</span>),
    },
    { id: "amount", header: "Amount", align: "right", cell: (d) => <Money amount={d.amount} decimals={usdc.decimals} symbol={usdc.symbol} /> },
    {
      id: "status",
      header: "Status",
      align: "right",
      cell: (d) => {
        const s = lcStatus(d.state);
        return <StatusBadge status={s.tone}>{s.label}</StatusBadge>;
      },
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="certificate"
        accentClassName="text-finance"
        title="Letters of credit"
        subtitle="Documentary credits: buyer funds are held in escrow and released to the beneficiary on compliant, attested delivery."
        breadcrumbs={[{ label: "Trade Finance" }, { label: "Letters of Credit" }]}
      />

      {!deployed ? (
        <NotDeployedState contract="SettlementEscrow" />
      ) : (
        <>
          <KpiRow
            loading={isLoading}
            items={[
              { label: "Credits", value: stats.total },
              { label: "Live", value: stats.live, hintTone: "brand" },
              { label: "Exposure", value: `${formatTokenAmount(stats.exposure, usdc.decimals)} ${usdc.symbol}`, hint: "Funds held live" },
              { label: "Honoured", value: stats.honoured, hintTone: "success" },
            ]}
          />

          <Callout tone="info" title="How the credit settles">
            Each credit is collateralised by an on-chain escrow. The credit is honoured automatically once the delivery
            attestation passes the threshold — the digital equivalent of a compliant document presentation.
          </Callout>

          <Toolbar>
            <FilterBar>
              <Input
                type="search"
                placeholder="Search ref, applicant or beneficiary…"
                aria-label="Search letters of credit"
                defaultValue={url.get("q")}
                onChange={(e) => url.set("q", e.target.value)}
                className="w-72"
              />
              <Select
                aria-label="Filter by status"
                options={STATE_OPTIONS}
                value={stateFilter}
                onChange={(e) => url.set("state", e.target.value || null)}
                className="w-44"
              />
            </FilterBar>
          </Toolbar>

          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(d) => d.batchId}
            onRowClick={(d) => router.push(`/letters-of-credit/${d.batchId}`)}
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={() => void refetch()}
            emptyTitle={stateFilter || q ? "No matching credits" : "No letters of credit yet"}
            emptyDescription="Escrow-backed documentary credits will appear here."
          />
        </>
      )}
    </div>
  );
}
