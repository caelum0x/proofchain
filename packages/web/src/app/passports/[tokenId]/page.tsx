"use client";

import { useParams } from "next/navigation";
import type { Hex } from "viem";
import { isBytes32 } from "@/lib/hashing";
import { ErrorState } from "@/components/ui/States";
import { BatchDetail } from "@/components/t1/BatchDetail";

/**
 * Provenance → Passports → detail. A digital product passport is keyed by its
 * batch id (bytes32), so the passport view reuses the shared batch DetailShell.
 */
export default function PassportDetailPage() {
  const params = useParams<{ tokenId: string }>();
  const raw = Array.isArray(params.tokenId) ? params.tokenId[0] : params.tokenId;
  const tokenId = raw && isBytes32(raw) ? (raw as Hex) : undefined;

  if (!tokenId) {
    return (
      <ErrorState
        title="Invalid passport id"
        message="A passport is identified by its 32-byte batch id. Use the scan page to look one up."
      />
    );
  }

  return (
    <BatchDetail batchId={tokenId} backHref="/passports" sectionLabel="Passports" />
  );
}
