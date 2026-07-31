"use client";

import Link from "next/link";
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
import { MetadataLink } from "@/components/directory/MetadataLink";

const USDC_DECIMALS = 6;

/**
 * Read-only batch detail for the public explorer: provenance trail, AI
 * attestation verdict + findings, settlement state, and the full event
 * timeline. Write actions live on the authenticated /deals page.
 */
export default function ExplorerBatchPage() {
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
  const dealActive = detail.deal && detail.deal.state !== 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Link href="/explorer" className="text-xs text-muted hover:text-fg">
              Explorer
            </Link>
            <span className="text-xs text-muted">/</span>
          </div>
          <h1 className="mt-1 text-2xl font-semibold">Batch detail</h1>
          <a
            href={explorerAddressUrl(batchId)}
            target="_blank"
            rel="noreferrer noopener"
            className="font-mono text-xs text-brand hover:underline"
          >
            {shortenHex(batchId, 10, 8)}
          </a>
        </div>
        <div className="flex items-center gap-2">
          {attested ? (
            <Badge tone={passed ? "success" : "danger"}>
              {score !== undefined ? formatBps(score) : "—"} · {passed ? "PASS" : "FAIL"}
            </Badge>
          ) : (
            <Badge tone="neutral">Not attested</Badge>
          )}
          {detail.deal && detail.deal.state !== 0 ? (
            <Badge tone={dealStateTone(detail.deal.state)}>
              {dealStateLabel(detail.deal.state)}
            </Badge>
          ) : null}
        </div>
      </div>

      {detail.isLoading ? (
        <LoadingState label="Loading on-chain state…" />
      ) : detail.isError ? (
        <ErrorState message={getErrorMessage(detail.error)} onRetry={() => detail.refetch()} />
      ) : !detail.batch ? (
        <ErrorState
          title="Batch not found"
          message="No provenance record exists for this batch id on the configured network."
        />
      ) : (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="space-y-6">
            <Card>
              <CardHeader
                title="Provenance"
                action={
                  detail.batch.supplier ? (
                    <Link
                      href={`/suppliers/${detail.batch.supplier}`}
                      className="text-xs text-brand hover:underline"
                    >
                      Supplier profile →
                    </Link>
                  ) : null
                }
              />
              <ProvenanceTrail batch={detail.batch} checkpoints={detail.checkpoints} />
              {detail.batch.metadataURI ? (
                <p className="mt-4 text-xs text-muted">
                  Metadata:{" "}
                  <MetadataLink
                    uri={detail.batch.metadataURI}
                    className="text-brand hover:underline"
                  />
                </p>
              ) : null}
            </Card>

            <Card>
              <CardHeader title="AI attestation" />
              {!attested ? (
                <p className="text-sm text-muted">
                  No attestation yet. The verification agent writes a signed verdict once a
                  supplier requests verification.
                </p>
              ) : (
                <div className="space-y-3">
                  <p className="text-xs text-muted">
                    Score {score !== undefined ? formatBps(score) : "—"} · threshold{" "}
                    {formatBps(threshold)} · agent{" "}
                    {detail.attestation ? <AddressLink address={detail.attestation.agent} /> : null}
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
              {dealActive && detail.deal ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Buyer">
                    <AddressLink address={detail.deal.buyer} />
                  </Info>
                  <Info label="Supplier">
                    <AddressLink address={detail.deal.supplier} />
                  </Info>
                  <Info label="Amount">
                    {formatTokenAmount(detail.deal.amount, USDC_DECIMALS)} USDC
                  </Info>
                  <Info label="State">{dealStateLabel(detail.deal.state)}</Info>
                </dl>
              ) : (
                <p className="text-sm text-muted">No escrow deal funded for this batch yet.</p>
              )}
              <p className="mt-4 text-xs">
                <Link href={`/deals/${batchId}`} className="text-brand hover:underline">
                  Open deal workspace →
                </Link>
              </p>
            </Card>
          </div>

          <Card>
            <CardHeader
              title="Timeline"
              description="Registered → checkpoints → attested → settled"
            />
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
