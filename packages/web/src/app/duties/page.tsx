"use client";

import { PageHeader } from "@/components/page";
import { Card, CardHeader, KpiRow, type Column } from "@/components/ui";
import { useComplianceList } from "@/hooks/useComplianceApi";
import { useT3ListParams } from "@/hooks/useT3ListParams";
import { SearchParamsBoundary } from "@/components/t3/SearchParamsBoundary";
import { ComplianceList } from "@/components/t3/ComplianceList";
import { DutyCalculatorForm } from "@/components/t3/DutyCalculatorForm";
import { dutyRateSchema, toNumber, type DutyRate } from "@/components/t3/compliance-schemas";
import { downloadCsv, textIncludes, toCsv, type SortKey } from "@/components/t3/list-utils";
import { formatBps } from "@/lib/format";

function bps(value: number | string | undefined): string {
  const n = toNumber(value ?? null);
  return n === null ? "—" : formatBps(n);
}

function DutiesContent() {
  const params = useT3ListParams({ defaultSort: "hsCode", defaultDir: "asc" });
  const rates = useComplianceList("duties", "/compliance/duties", dutyRateSchema);

  const columns: Column<DutyRate>[] = [
    { id: "hsCode", header: "HS code", sortable: true, cell: (r) => <span className="font-mono">{r.hsCode ?? "—"}</span> },
    { id: "description", header: "Description", cell: (r) => <span className="text-fg">{r.description ?? "—"}</span> },
    {
      id: "route",
      header: "Route",
      className: "hidden lg:table-cell",
      cell: (r) => (r.origin || r.destination ? `${r.origin ?? "—"} → ${r.destination ?? "—"}` : "—"),
    },
    { id: "dutyRateBps", header: "Duty", align: "right", sortable: true, cell: (r) => <span className="font-mono tabular-nums">{bps(r.dutyRateBps)}</span> },
    { id: "vatRateBps", header: "VAT", align: "right", className: "hidden sm:table-cell", cell: (r) => <span className="font-mono tabular-nums">{bps(r.vatRateBps)}</span> },
  ];

  const sortKeyFor = (id: string): ((r: DutyRate) => SortKey) | undefined => {
    switch (id) {
      case "hsCode":
        return (r) => r.hsCode ?? "";
      case "dutyRateBps":
        return (r) => toNumber(r.dutyRateBps) ?? 0;
      default:
        return undefined;
    }
  };

  const onExport = (rows: readonly DutyRate[]) => {
    const csv = toCsv(
      ["hsCode", "description", "origin", "destination", "dutyRateBps", "vatRateBps", "category"],
      rows.map((r) => [r.hsCode ?? "", r.description ?? "", r.origin ?? "", r.destination ?? "", String(r.dutyRateBps ?? ""), String(r.vatRateBps ?? ""), r.category ?? ""]),
    );
    downloadCsv("duty-rates.csv", csv);
  };

  return (
    <div className="space-y-6">
      <PageHeader
        icon="fees"
        accentClassName="text-compliance"
        title="Duties & tariffs"
        subtitle="Applicable duty rates and a landed-cost calculator."
        breadcrumbs={[{ label: "Compliance", href: "/compliance" }, { label: "Duties" }]}
      />

      <KpiRow
        items={[
          { label: "Duty rates", value: rates.total.toLocaleString(), loading: rates.isLoading },
          { label: "Categories", value: new Set(rates.items.map((r) => r.category).filter(Boolean)).size.toLocaleString(), loading: rates.isLoading },
        ]}
      />

      <DutyCalculatorForm />

      <Card className="space-y-4">
        <CardHeader title="Rate schedule" description="Duty and VAT rates by HS code and trade lane." />
        <ComplianceList
          params={params}
          items={rates.items}
          isLoading={rates.isLoading}
          error={rates.error}
          onRetry={rates.refetch}
          columns={columns}
          getRowKey={(r) => r.id}
          filter={(r, q) =>
            textIncludes(r.hsCode, q) || textIncludes(r.description, q) || textIncludes(r.origin, q) || textIncludes(r.destination, q) || textIncludes(r.category, q)
          }
          sortKeyFor={sortKeyFor}
          searchPlaceholder="Search HS code, description, lane…"
          onExport={onExport}
          emptyTitle="No duty rates"
          emptyDescription="Duty rate schedules from the ProofChain API will appear here."
        />
      </Card>
    </div>
  );
}

/** Compliance › Duties & tariffs (WD §3). */
export default function DutiesPage() {
  return (
    <SearchParamsBoundary>
      <DutiesContent />
    </SearchParamsBoundary>
  );
}
