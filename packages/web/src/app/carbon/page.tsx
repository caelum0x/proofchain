"use client";

import { useRetirements, useOffsets } from "@/hooks/useCarbon";
import { RetireForm } from "@/components/carbon/RetireForm";
import { OffsetForm } from "@/components/carbon/OffsetForm";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressLink } from "@/components/ui/TxLink";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";
import type { OffsetItem, RetirementItem } from "@/hooks/useCarbon";

export default function CarbonPage() {
  const retirements = useRetirements();
  const offsets = useOffsets();

  const retireCols: readonly Column<RetirementItem>[] = [
    { id: "account", header: "Account", cell: (r) => <AddressLink address={r.account} /> },
    { id: "project", header: "Project", cell: (r) => `#${r.projectId.toString()}` },
    { id: "amount", header: "Retired", align: "right", cell: (r) => r.amount.toString() },
  ];

  const offsetCols: readonly Column<OffsetItem>[] = [
    { id: "batch", header: "Batch", cell: (r) => <span className="font-mono text-xs">{shortenHex(r.batchId, 6, 6)}</span> },
    { id: "account", header: "By", cell: (r) => <AddressLink address={r.account} /> },
    { id: "project", header: "Project", cell: (r) => `#${r.projectId.toString()}` },
    { id: "amount", header: "Amount", align: "right", cell: (r) => r.amount.toString() },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Carbon</h1>
        <p className="mt-1 text-sm text-muted">
          Tokenized carbon offsets (ERC-1155) per project. Retire credits to claim offsets, or offset a
          shipment&apos;s measured footprint directly.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Recent offsets" description="Credits retired against batch footprints." />
            {offsets.notDeployed ? (
              <p className="text-sm text-muted">OffsetMarketplace is not deployed on this network.</p>
            ) : offsets.isError ? (
              <p className="field-error">{getErrorMessage(offsets.error)}</p>
            ) : (
              <DataTable
                columns={offsetCols}
                rows={offsets.items}
                getRowKey={(r) => `${r.transactionHash}-${r.batchId}-${r.projectId}`}
                isLoading={offsets.isLoading}
                emptyTitle="No offsets yet"
              />
            )}
          </Card>

          <Card>
            <CardHeader title="Recent retirements" />
            {retirements.notDeployed ? (
              <p className="text-sm text-muted">CarbonCreditToken is not deployed on this network.</p>
            ) : retirements.isError ? (
              <p className="field-error">{getErrorMessage(retirements.error)}</p>
            ) : (
              <DataTable
                columns={retireCols}
                rows={retirements.items}
                getRowKey={(r) => `${r.transactionHash}-${r.projectId}-${r.account}`}
                isLoading={retirements.isLoading}
                emptyTitle="No retirements yet"
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <RequireWallet>
            <OffsetForm />
            <RetireForm />
          </RequireWallet>
        </div>
      </div>
    </div>
  );
}
