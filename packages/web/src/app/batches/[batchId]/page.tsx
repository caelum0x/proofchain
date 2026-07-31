"use client";

import { useParams } from "next/navigation";
import type { Hex } from "viem";
import { isBytes32 } from "@/lib/hashing";
import { ErrorState } from "@/components/ui/States";
import { BatchDetail } from "@/components/t1/BatchDetail";

/** Provenance → Batch detail: the shared batch DetailShell for a single batch. */
export default function BatchDetailPage() {
  const params = useParams<{ batchId: string }>();
  const raw = Array.isArray(params.batchId) ? params.batchId[0] : params.batchId;
  const batchId = raw && isBytes32(raw) ? (raw as Hex) : undefined;

  if (!batchId) {
    return (
      <ErrorState
        title="Invalid batch id"
        message="The URL does not contain a valid 32-byte batch id."
      />
    );
  }

  return (
    <BatchDetail batchId={batchId} backHref="/batches" sectionLabel="Batches" />
  );
}
