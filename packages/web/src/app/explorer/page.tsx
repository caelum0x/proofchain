"use client";

import { useMemo, useState } from "react";
import { useReadContract } from "wagmi";
import { useBatches } from "@/hooks/useBatches";
import { useBatchStatuses } from "@/hooks/useBatchStatuses";
import { settlementEscrowAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Pagination } from "@/components/ui/Pagination";
import { ExplorerTable } from "@/components/explorer/ExplorerTable";

const PAGE_SIZE = 10;
const DEFAULT_THRESHOLD = 7000;

/**
 * Batch explorer: every registered batch with its live provenance/attestation/
 * settlement status. Batches are discovered from chain events; the visible page
 * is enriched with a status multicall. Search filters by batch id or supplier.
 */
export default function ExplorerPage() {
  const { batches, isLoading, isError, error, refetch } = useBatches();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);

  const thresholdQuery = useReadContract({
    address: contractAddresses.settlementEscrow,
    abi: settlementEscrowAbi,
    functionName: "passThreshold",
    query: { enabled: Boolean(contractAddresses.settlementEscrow) },
  });
  const passThreshold = thresholdQuery.data ?? DEFAULT_THRESHOLD;

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return batches;
    return batches.filter(
      (b) =>
        b.batchId.toLowerCase().includes(q) ||
        b.supplier.toLowerCase().includes(q),
    );
  }, [batches, search]);

  const pageItems = useMemo(
    () => filtered.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE),
    [filtered, page],
  );

  const pageBatchIds = useMemo(() => pageItems.map((b) => b.batchId), [pageItems]);
  const { statuses } = useBatchStatuses(pageBatchIds);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Batch Explorer</h1>
          <p className="mt-1 text-sm text-muted">
            Every registered batch, its AI attestation verdict, and settlement state.
          </p>
        </div>
        <Badge tone="success">
          <span className="mr-1 inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-success" />
          Live
        </Badge>
      </div>

      <Card>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(0);
            }}
            placeholder="Search by batch id or supplier…"
            className="max-w-sm"
            aria-label="Search batches"
          />
          <p className="text-xs text-muted">
            {filtered.length} batch{filtered.length === 1 ? "" : "es"}
          </p>
        </div>

        <ExplorerTable
          batches={pageItems}
          statuses={statuses}
          passThreshold={passThreshold}
          isLoading={isLoading}
          isError={isError}
          error={isError ? getErrorMessage(error) : null}
          onRetry={() => void refetch()}
        />

        {!isLoading && !isError && filtered.length > PAGE_SIZE ? (
          <div className="mt-4">
            <Pagination
              page={page}
              limit={PAGE_SIZE}
              total={filtered.length}
              onPageChange={setPage}
            />
          </div>
        ) : null}
      </Card>
    </div>
  );
}
