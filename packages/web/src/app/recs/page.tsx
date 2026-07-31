"use client";

import { useMemo, useState } from "react";
import { PageHeader, Toolbar, SearchParamsBoundary } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Meter } from "@/components/ui/Meter";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Callout } from "@/components/ui/Callout";
import { RequireWallet } from "@/components/RequireWallet";
import { RetireForm } from "@/components/carbon/RetireForm";
import { useRecs, type RecItem } from "@/hooks/sustainabilityRecs";
import { useT4ListState } from "@/hooks/t4UrlListState";
import { getErrorMessage } from "@/lib/errors";

function RecsPageContent() {
  const { recs, isLoading, isError, error, notDeployed, refetch } = useRecs();
  const url = useT4ListState();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rows = useMemo(() => {
    const query = url.q.trim();
    if (!query) return recs;
    return recs.filter((r) => r.projectId.toString().includes(query));
  }, [recs, url.q]);

  const totals = useMemo(() => {
    return recs.reduce(
      (acc, r) => ({ issued: acc.issued + r.issued, retired: acc.retired + r.retired, active: acc.active + r.active }),
      { issued: 0n, retired: 0n, active: 0n },
    );
  }, [recs]);

  const columns: readonly Column<RecItem>[] = [
    { id: "projectId", header: "Certificate", cell: (r) => <span className="font-mono text-xs">REC-{r.projectId.toString()}</span> },
    { id: "issued", header: "Issued", align: "right", cell: (r) => r.issued.toLocaleString() },
    { id: "retired", header: "Retired", align: "right", cell: (r) => r.retired.toLocaleString() },
    { id: "active", header: "Active", align: "right", cell: (r) => <span className="font-medium text-fg">{r.active.toLocaleString()}</span> },
    {
      id: "retiredPct",
      header: "Retired %",
      className: "hidden md:table-cell w-40",
      cell: (r) => {
        const pct = r.issued > 0n ? Number((r.retired * 100n) / r.issued) : 0;
        return <Meter value={pct} label={`${pct}%`} invert high={80} low={30} />;
      },
    },
    { id: "holders", header: "Holders", align: "right", cell: (r) => r.holders.toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Renewable Energy Certificates"
        subtitle="Each on-chain carbon project is a certificate series: issued supply, retired volume, and the tradable active balance."
        icon="leaf"
        accentClassName="text-sustainability"
        breadcrumbs={[{ label: "Sustainability", href: "/esg" }, { label: "RECs" }]}
        actions={<Button onClick={() => setDrawerOpen(true)}>Retire certificate</Button>}
      />

      <KpiRow
        loading={isLoading}
        items={[
          { label: "Certificates", value: recs.length.toLocaleString(), hint: "projects" },
          { label: "Issued", value: totals.issued.toLocaleString() },
          { label: "Retired", value: totals.retired.toLocaleString(), hintTone: "success" },
          { label: "Active", value: totals.active.toLocaleString(), hint: "tradable" },
        ]}
      />

      <Callout tone="info" title="How RECs map on-chain">
        RECs are modeled over the ERC-1155 <span className="font-mono">CarbonCreditToken</span>. A certificate is retired the same way carbon credits are — retiring permanently removes it from circulation.
      </Callout>

      <Toolbar>
        <Input aria-label="Search certificates" placeholder="Search by project id…" className="max-w-xs" value={url.q} onChange={(e) => url.setParams({ q: e.target.value })} />
      </Toolbar>

      {notDeployed ? (
        <Callout tone="info" title="CarbonCreditToken not deployed">The certificate registry is not configured on this network.</Callout>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.projectId.toString()}
          isLoading={isLoading}
          error={isError ? getErrorMessage(error) : null}
          onRetry={refetch}
          emptyTitle="No certificates yet"
          emptyDescription="Certificates appear as carbon credits are minted on-chain."
        />
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Retire a certificate">
        <RequireWallet>
          <RetireForm />
        </RequireWallet>
      </Drawer>
    </div>
  );
}

export default function RecsPage() {
  return (
    <SearchParamsBoundary>
      <RecsPageContent />
    </SearchParamsBoundary>
  );
}
