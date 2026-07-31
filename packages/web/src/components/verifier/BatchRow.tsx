"use client";

import { useState } from "react";
import Link from "next/link";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import { useVerdict } from "@/hooks/useVerdict";
import type { BatchRegisteredEvent } from "@/lib/types";
import {
  dealStateLabel,
  dealStateTone,
  formatBps,
  formatTimestamp,
  shortenHex,
} from "@/lib/format";
import { DealState } from "@/lib/types";
import { Badge } from "@/components/ui/Badge";
import { AddressLink } from "@/components/ui/TxLink";
import { FindingsList } from "@/components/FindingsList";
import { ProvenanceTrail } from "@/components/ProvenanceTrail";
import { Spinner } from "@/components/ui/Spinner";

/**
 * A single live row in the verifier dashboard. Reads the batch's attestation,
 * checkpoints, and deal, and lazily loads the pinned verdict (findings) when the
 * row is expanded.
 */
export function BatchRow({ event }: { event: BatchRegisteredEvent }) {
  const [open, setOpen] = useState(false);
  const detail = useBatchDetail(event.batchId);
  const verdict = useVerdict(detail.attestation?.verdictURI, open);

  const score = detail.attestation?.score;
  const threshold = detail.passThreshold ?? 7000;
  const passed = score !== undefined && score >= threshold;

  return (
    <>
      <tr className="border-t border-border align-middle hover:bg-surface-2/30">
        <td className="px-3 py-3">
          <Link href={`/deals/${event.batchId}`} className="font-mono text-xs text-brand hover:underline">
            {shortenHex(event.batchId)}
          </Link>
          <div className="mt-0.5 text-[11px] text-muted">
            {detail.batch ? formatTimestamp(detail.batch.createdAt) : "—"}
          </div>
        </td>
        <td className="px-3 py-3">
          <AddressLink address={event.supplier} />
        </td>
        <td className="px-3 py-3 text-center text-sm">
          {detail.isLoading ? <Spinner className="mx-auto h-4 w-4 text-muted" /> : detail.checkpoints.length}
        </td>
        <td className="px-3 py-3">
          {score === undefined ? (
            <Badge tone="neutral">Not attested</Badge>
          ) : (
            <Badge tone={passed ? "success" : "danger"}>
              {formatBps(score)} · {passed ? "PASS" : "FAIL"}
            </Badge>
          )}
        </td>
        <td className="px-3 py-3">
          <Badge tone={detail.deal ? dealStateTone(detail.deal.state) : "neutral"}>
            {detail.deal ? dealStateLabel(detail.deal.state) : dealStateLabel(DealState.None)}
          </Badge>
        </td>
        <td className="px-3 py-3 text-right">
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="text-xs text-brand hover:underline"
            aria-expanded={open}
          >
            {open ? "Hide" : "Details"}
          </button>
        </td>
      </tr>
      {open ? (
        <tr className="border-t border-border bg-surface/40">
          <td colSpan={6} className="px-3 py-4">
            <div className="grid gap-6 md:grid-cols-2">
              <div>
                <p className="mb-2 text-sm font-medium">Provenance trail</p>
                <ProvenanceTrail
                  batch={detail.batch}
                  checkpoints={detail.checkpoints}
                  loading={detail.isLoading}
                />
              </div>
              <div>
                <p className="mb-2 text-sm font-medium">Findings</p>
                {!detail.attestation ? (
                  <p className="text-sm text-muted">Awaiting attestation.</p>
                ) : verdict.isLoading ? (
                  <p className="text-sm text-muted">Loading verdict…</p>
                ) : verdict.isError ? (
                  <p className="text-sm text-danger">Could not load verdict document.</p>
                ) : verdict.verdict ? (
                  <FindingsList findings={verdict.verdict.findings} />
                ) : (
                  <p className="text-sm text-muted">No verdict document linked.</p>
                )}
              </div>
            </div>
          </td>
        </tr>
      ) : null}
    </>
  );
}
