"use client";

import { useMemo, useState } from "react";
import { PageHeader } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { Tabs } from "@/components/ui/Tabs";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Callout } from "@/components/ui/Callout";
import { RequireWallet } from "@/components/RequireWallet";
import { RetireForm } from "@/components/carbon/RetireForm";
import { OffsetForm } from "@/components/carbon/OffsetForm";
import { useRetirements, useOffsets, type OffsetItem, type RetirementItem } from "@/hooks/useCarbon";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";

export default function CarbonPage() {
  const retirements = useRetirements();
  const offsets = useOffsets();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const totalRetired = useMemo(() => retirements.items.reduce((s, r) => s + r.amount, 0n), [retirements.items]);
  const totalOffset = useMemo(() => offsets.items.reduce((s, r) => s + r.amount, 0n), [offsets.items]);
  const projects = useMemo(
    () => new Set([...retirements.items, ...offsets.items].map((r) => r.projectId.toString())).size,
    [retirements.items, offsets.items],
  );
  const batches = useMemo(() => new Set(offsets.items.map((o) => o.batchId.toLowerCase())).size, [offsets.items]);

  const offsetCols: readonly Column<OffsetItem>[] = [
    { id: "batch", header: "Batch", cell: (r) => <span className="font-mono text-xs">{shortenHex(r.batchId, 6, 6)}</span> },
    { id: "account", header: "By", cell: (r) => <AddressBadge address={r.account} /> },
    { id: "project", header: "Project", cell: (r) => `#${r.projectId.toString()}` },
    { id: "amount", header: "Amount", align: "right", cell: (r) => r.amount.toLocaleString() },
  ];

  const retireCols: readonly Column<RetirementItem>[] = [
    { id: "account", header: "Account", cell: (r) => <AddressBadge address={r.account} /> },
    { id: "project", header: "Project", cell: (r) => `#${r.projectId.toString()}` },
    { id: "amount", header: "Retired", align: "right", cell: (r) => r.amount.toLocaleString() },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Carbon"
        subtitle="Tokenized carbon credits (ERC-1155). Retire credits to claim offsets, or offset a shipment's measured footprint."
        icon="carbon"
        accentClassName="text-sustainability"
        breadcrumbs={[{ label: "Sustainability", href: "/esg" }, { label: "Carbon" }]}
        actions={<Button onClick={() => setDrawerOpen(true)}>Offset / retire</Button>}
      />

      <KpiRow
        loading={offsets.isLoading || retirements.isLoading}
        items={[
          { label: "Credits retired", value: totalRetired.toLocaleString(), hint: "tCO₂e", hintTone: "success" },
          { label: "Offset volume", value: totalOffset.toLocaleString(), hint: "against footprints" },
          { label: "Projects", value: projects.toLocaleString() },
          { label: "Batches offset", value: batches.toLocaleString() },
        ]}
      />

      <Card>
        <CardHeader title="Market activity" description="Recent offsets and credit retirements." />
        <Tabs
          items={[
            {
              id: "offsets",
              label: "Offsets",
              content: offsets.notDeployed ? (
                <Callout tone="info" title="OffsetMarketplace not deployed">Not configured on this network.</Callout>
              ) : (
                <DataTable
                  columns={offsetCols}
                  rows={offsets.items}
                  getRowKey={(r) => `${r.transactionHash}-${r.batchId}-${r.projectId}`}
                  isLoading={offsets.isLoading}
                  error={offsets.isError ? getErrorMessage(offsets.error) : null}
                  onRetry={offsets.refetch}
                  emptyTitle="No offsets yet"
                />
              ),
            },
            {
              id: "retirements",
              label: "Retirements",
              content: retirements.notDeployed ? (
                <Callout tone="info" title="CarbonCreditToken not deployed">Not configured on this network.</Callout>
              ) : (
                <DataTable
                  columns={retireCols}
                  rows={retirements.items}
                  getRowKey={(r) => `${r.transactionHash}-${r.projectId}-${r.account}`}
                  isLoading={retirements.isLoading}
                  error={retirements.isError ? getErrorMessage(retirements.error) : null}
                  onRetry={retirements.refetch}
                  emptyTitle="No retirements yet"
                />
              ),
            },
          ]}
        />
      </Card>

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Carbon actions">
        <RequireWallet>
          <div className="space-y-6">
            <OffsetForm />
            <RetireForm />
          </div>
        </RequireWallet>
      </Drawer>
    </div>
  );
}
