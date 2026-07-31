"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import type { Hex } from "viem";
import { isBytes32 } from "@/lib/hashing";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import { useTimeline } from "@/hooks/useTimeline";
import { useVerdict } from "@/hooks/useVerdict";
import {
  dealStateLabel,
  dealStateTone,
  explorerAddressUrl,
  formatBps,
  formatTokenAmount,
  shortenHex,
} from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AddressLink } from "@/components/ui/TxLink";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ProvenanceTrail } from "@/components/ProvenanceTrail";
import { Timeline } from "@/components/Timeline";
import { FindingsList } from "@/components/FindingsList";
import { DealActions } from "@/components/DealActions";

const USDC_DECIMALS = 6;

export default function DealDetailPage() {
  const params = useParams<{ batchId: string }>();
  const raw = Array.isArray(params.batchId) ? params.batchId[0] : params.batchId;
  const batchId = raw && isBytes32(raw) ? (raw as Hex) : undefined;

  const detail = useBatchDetail(batchId);
  const timeline = useTimeline(batchId);
  const verdict = useVerdict(detail.attestation?.verdictURI, true);

  if (!batchId) {
    return (
      <ErrorState
        title="Invalid batch id"
        message="The URL does not contain a valid 32-byte batch id."
      />
    );
  }

  const attested = Boolean(detail.attestation);
  const score = detail.attestation?.score;
  const threshold = detail.passThreshold ?? 7000;
  const passed = score !== undefined && score >= threshold;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Deal detail</h1>
          <a
            href={explorerAddressUrl(batchId)}
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono text-xs text-brand hover:underline"
          >
            {shortenHex(batchId, 10, 8)}
          </a>
        </div>
        {detail.deal ? (
          <Badge tone={dealStateTone(detail.deal.state)}>{dealStateLabel(detail.deal.state)}</Badge>
        ) : null}
      </div>

      {detail.isLoading ? (
        <LoadingState label="Loading on-chain state…" />
      ) : detail.isError ? (
        <ErrorState message={getErrorMessage(detail.error)} onRetry={() => detail.refetch()} />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader title="Provenance" />
              <ProvenanceTrail batch={detail.batch} checkpoints={detail.checkpoints} />
            </Card>

            <Card>
              <CardHeader
                title="Attestation"
                action={
                  attested ? (
                    <Badge tone={passed ? "success" : "danger"}>
                      {score !== undefined ? formatBps(score) : "—"} ·{" "}
                      {passed ? "PASS" : "FAIL"}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Not attested</Badge>
                  )
                }
              />
              {!attested ? (
                <p className="text-sm text-muted">
                  No attestation yet. Request verification from the Supplier screen.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted">
                    Threshold {formatBps(threshold)} · agent{" "}
                    {detail.attestation ? (
                      <AddressLink address={detail.attestation.agent} />
                    ) : null}
                  </p>
                  {verdict.isLoading ? (
                    <p className="text-sm text-muted">Loading findings…</p>
                  ) : verdict.isError ? (
                    <p className="text-sm text-danger">Could not load verdict document.</p>
                  ) : verdict.verdict ? (
                    <FindingsList findings={verdict.verdict.findings} />
                  ) : (
                    <p className="text-sm text-muted">No linked verdict document.</p>
                  )}
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Settlement" />
              {detail.deal && detail.deal.state !== 0 ? (
                <div className="space-y-3">
                  <dl className="grid grid-cols-2 gap-3 text-sm">
                    <Info label="Buyer">
                      <AddressLink address={detail.deal.buyer} />
                    </Info>
                    <Info label="Supplier">
                      <AddressLink address={detail.deal.supplier} />
                    </Info>
                    <Info label="Amount">
                      {formatTokenAmount(detail.deal.amount, USDC_DECIMALS)}
                    </Info>
                    <Info label="Token">
                      <AddressLink address={detail.deal.token} />
                    </Info>
                  </dl>
                  <DealActions
                    batchId={batchId}
                    deal={detail.deal}
                    isAttested={attested}
                    onDone={() => {
                      detail.refetch();
                      void timeline.refetch();
                    }}
                  />
                </div>
              ) : (
                <p className="text-sm text-muted">No deal funded for this batch yet.</p>
              )}
            </Card>
          </div>

          <Card>
            <CardHeader title="Timeline" description="Registered → checkpoints → attested → settled" />
            {timeline.isLoading ? (
              <LoadingState label="Loading events…" />
            ) : timeline.isError ? (
              <ErrorState
                message={getErrorMessage(timeline.error)}
                onRetry={() => void timeline.refetch()}
              />
            ) : (
              <Timeline items={timeline.items} />
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}
