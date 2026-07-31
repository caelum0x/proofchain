"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Toolbar, SearchParamsBoundary } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Pagination } from "@/components/ui/Pagination";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { CopyButton } from "@/components/ui/CopyButton";
import { Callout } from "@/components/ui/Callout";
import { RequireWallet } from "@/components/RequireWallet";
import { PushCheckpointForm } from "@/components/t4/PushCheckpointForm";
import { useCheckpoints, type CheckpointItem } from "@/hooks/logisticsCheckpoints";
import { useT4ListState } from "@/hooks/t4UrlListState";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";

const PAGE_SIZE = 12;
const ZERO_HASH = "0x0000000000000000000000000000000000000000000000000000000000000000";

/** A proof of delivery is a checkpoint that carries an evidence hash (dataHash != 0). */
function hasEvidence(cp: CheckpointItem): boolean {
  return cp.dataHash.toLowerCase() !== ZERO_HASH;
}

function ProofOfDeliveryPageContent() {
  const router = useRouter();
  const { checkpoints, isLoading, isError, error, notDeployed, refetch } = useCheckpoints();
  const url = useT4ListState();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const proofs = useMemo(() => checkpoints.filter(hasEvidence), [checkpoints]);

  const rows = useMemo(() => {
    const q = url.q.trim().toLowerCase();
    if (!q) return proofs;
    return proofs.filter((c) => c.location.toLowerCase().includes(q) || c.batchId.toLowerCase().includes(q));
  }, [proofs, url.q]);

  const distinctShipments = useMemo(() => new Set(proofs.map((c) => c.batchId.toLowerCase())).size, [proofs]);
  const distinctKeepers = useMemo(() => new Set(proofs.map((c) => c.keeper.toLowerCase())).size, [proofs]);

  const page = Math.min(url.page, Math.max(0, Math.ceil(rows.length / PAGE_SIZE) - 1));
  const paged = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);

  const columns: readonly Column<CheckpointItem>[] = [
    { id: "batchId", header: "Shipment", cell: (c) => <span className="font-mono text-xs">{shortenHex(c.batchId, 5, 5)}</span> },
    { id: "location", header: "Delivered at", cell: (c) => c.location || "—" },
    {
      id: "evidence",
      header: "Evidence",
      cell: (c) => (
        <span className="inline-flex items-center gap-1 font-mono text-xs">
          {shortenHex(c.dataHash, 5, 5)}
          <CopyButton value={c.dataHash} />
        </span>
      ),
    },
    { id: "keeper", header: "Confirmed by", cell: (c) => <AddressBadge address={c.keeper} /> },
    { id: "block", header: "Block", align: "right", cell: (c) => <span className="font-mono text-xs text-muted">#{c.blockNumber.toString()}</span> },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Proof of Delivery"
        subtitle="Delivery confirmations recorded on-chain with tamper-evident evidence hashes."
        icon="delivery"
        accentClassName="text-logistics"
        breadcrumbs={[{ label: "Logistics", href: "/logistics" }, { label: "Proof of Delivery" }]}
        actions={<Button onClick={() => setDrawerOpen(true)}>Record delivery</Button>}
      />

      <KpiRow
        loading={isLoading}
        items={[
          { label: "Delivery proofs", value: proofs.length.toLocaleString() },
          { label: "Shipments", value: distinctShipments.toLocaleString(), hint: "with proof" },
          { label: "Confirmers", value: distinctKeepers.toLocaleString(), hint: "distinct keepers" },
          { label: "Filtered", value: rows.length.toLocaleString(), hint: url.q ? `“${url.q}”` : "all" },
        ]}
      />

      <Toolbar>
        <Input
          aria-label="Search delivery proofs"
          placeholder="Search by shipment or location…"
          className="max-w-xs"
          value={url.q}
          onChange={(e) => url.setParams({ q: e.target.value })}
        />
      </Toolbar>

      {notDeployed ? (
        <Callout tone="info" title="CheckpointOracle not deployed">
          Proof of delivery is unavailable on this network.
        </Callout>
      ) : (
        <>
          <DataTable
            columns={columns}
            rows={paged}
            getRowKey={(c) => `${c.transactionHash}-${c.logIndex}`}
            onRowClick={(c) => router.push(`/freight/${c.batchId}`)}
            isLoading={isLoading}
            error={isError ? getErrorMessage(error) : null}
            onRetry={refetch}
            emptyTitle="No delivery proofs yet"
            emptyDescription="Record a delivery with an evidence reference to create the first proof."
          />
          {rows.length > PAGE_SIZE ? (
            <Pagination page={page} limit={PAGE_SIZE} total={rows.length} onPageChange={url.setPage} />
          ) : null}
        </>
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Record a delivery">
        <RequireWallet>
          <PushCheckpointForm onDone={() => { setDrawerOpen(false); refetch(); }} />
        </RequireWallet>
      </Drawer>
    </div>
  );
}

export default function ProofOfDeliveryPage() {
  return (
    <SearchParamsBoundary>
      <ProofOfDeliveryPageContent />
    </SearchParamsBoundary>
  );
}
