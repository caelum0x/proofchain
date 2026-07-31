"use client";

import Link from "next/link";
import type { Hex } from "viem";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import { useTimeline } from "@/hooks/useTimeline";
import { useVerdict } from "@/hooks/useVerdict";
import {
  explorerAddressUrl,
  formatBps,
  formatTimestamp,
  formatTokenAmount,
  shortenHex,
} from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page/PageHeader";
import { AsyncBoundary } from "@/components/page/AsyncBoundary";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Button } from "@/components/ui/Button";
import { Timeline, type TimelineEvent } from "@/components/ui/Timeline";
import { LoadingState } from "@/components/ui/States";
import { ProvenanceTrail } from "@/components/ProvenanceTrail";
import { FindingsList } from "@/components/FindingsList";
import { DealState } from "@/lib/types";
import { attestationStatus, dealStatus, activityTone } from "./provenanceFormat";

const USDC_DECIMALS = 6;

interface BatchDetailProps {
  readonly batchId: Hex;
  readonly backHref: string;
  readonly sectionLabel: string;
}

/**
 * The shared batch DetailShell — provenance trail, AI attestation + findings,
 * settlement state, and a live event timeline in the rail. Reused by the public
 * Explorer detail and the Provenance → Batches detail so both stay in lockstep.
 */
export function BatchDetail({ batchId, backHref, sectionLabel }: BatchDetailProps) {
  const detail = useBatchDetail(batchId);
  const timeline = useTimeline(batchId);
  const verdict = useVerdict(detail.attestation?.verdictURI, true);

  const attested = Boolean(detail.attestation);
  const score = detail.attestation?.score;
  const threshold = detail.passThreshold ?? 7000;
  const att = attestationStatus(attested, score, threshold);
  const deal = detail.deal && detail.deal.state !== DealState.None ? detail.deal : null;
  const dealView = deal ? dealStatus(deal.state) : null;

  const events: readonly TimelineEvent[] = timeline.items.map((item, i) => ({
    id: `${item.kind}-${i}`,
    title: item.title,
    description: item.description,
    timestamp: item.timestamp ? formatTimestamp(item.timestamp) : undefined,
    tone: activityTone(item.kind),
  }));

  const header = (
    <PageHeader
      icon="batches"
      accentClassName="text-dpp"
      breadcrumbs={[
        { label: sectionLabel, href: backHref },
        { label: shortenHex(batchId, 6, 4) },
      ]}
      title="Batch detail"
      subtitle={
        <a
          href={explorerAddressUrl(batchId)}
          target="_blank"
          rel="noreferrer noopener"
          className="font-mono text-xs text-brand hover:underline"
        >
          {shortenHex(batchId, 10, 8)}
        </a>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <StatusBadge status={att.status}>{att.label}</StatusBadge>
          {dealView ? <StatusBadge status={dealView.status}>{dealView.label}</StatusBadge> : null}
          <Link href={`/deals/${batchId}`}>
            <Button variant="secondary" size="sm">
              Open deal workspace
            </Button>
          </Link>
        </div>
      }
    />
  );

  const rail = (
    <Card>
      <CardHeader title="Timeline" description="Registered → checkpoints → attested → settled" />
      <AsyncBoundary
        isLoading={timeline.isLoading}
        error={timeline.isError ? getErrorMessage(timeline.error) : null}
        onRetry={() => void timeline.refetch()}
        isEmpty={events.length === 0}
        emptyTitle="No events yet"
        emptyDescription="Lifecycle events will appear here as they occur on-chain."
        loading={<LoadingState label="Loading events…" />}
      >
        <Timeline events={events} />
      </AsyncBoundary>
    </Card>
  );

  return (
    <DetailShell header={header} rail={rail}>
      <AsyncBoundary
        isLoading={detail.isLoading}
        error={detail.isError ? getErrorMessage(detail.error) : null}
        onRetry={() => detail.refetch()}
        isEmpty={!detail.batch}
        emptyTitle="Batch not found"
        emptyDescription="No provenance record exists for this batch id on the configured network."
        loading={<LoadingState label="Loading on-chain state…" />}
      >
        {detail.batch ? (
          <>
            <Card>
              <CardHeader
                title="Provenance"
                action={
                  <Link
                    href={`/suppliers/${detail.batch.supplier}`}
                    className="text-xs text-brand hover:underline"
                  >
                    Supplier profile →
                  </Link>
                }
              />
              <ProvenanceTrail batch={detail.batch} checkpoints={detail.checkpoints} />
              {detail.batch.metadataURI ? (
                <p className="mt-4 break-all text-xs text-muted">
                  Metadata: <span className="font-mono text-fg/80">{detail.batch.metadataURI}</span>
                </p>
              ) : null}
            </Card>

            <Card>
              <CardHeader title="AI attestation" />
              {!attested ? (
                <p className="text-sm text-muted">
                  No attestation yet. The verification agent writes a signed verdict once a supplier
                  requests verification.
                </p>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-xs text-muted">
                    <StatusBadge status={att.status}>{att.label}</StatusBadge>
                    <span>threshold {formatBps(threshold)}</span>
                    {detail.attestation ? (
                      <span className="inline-flex items-center gap-1">
                        agent <AddressBadge address={detail.attestation.agent} />
                      </span>
                    ) : null}
                  </div>
                  <AsyncBoundary
                    isLoading={verdict.isLoading}
                    error={verdict.isError ? "Could not load the verdict document." : null}
                    isEmpty={!verdict.verdict}
                    emptyTitle="No linked verdict"
                    emptyDescription="This attestation has no off-chain verdict document."
                  >
                    {verdict.verdict ? <FindingsList findings={verdict.verdict.findings} /> : null}
                  </AsyncBoundary>
                </div>
              )}
            </Card>

            <Card>
              <CardHeader title="Settlement" />
              {deal ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Buyer</dt>
                    <dd className="mt-0.5">
                      <AddressBadge address={deal.buyer} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Supplier</dt>
                    <dd className="mt-0.5">
                      <AddressBadge address={deal.supplier} />
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">Amount</dt>
                    <dd className="mt-0.5 font-mono text-fg">
                      {formatTokenAmount(deal.amount, USDC_DECIMALS)} USDC
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs uppercase tracking-wide text-muted">State</dt>
                    <dd className="mt-0.5">
                      {dealView ? <StatusBadge status={dealView.status}>{dealView.label}</StatusBadge> : null}
                    </dd>
                  </div>
                </dl>
              ) : (
                <p className="text-sm text-muted">No escrow deal funded for this batch yet.</p>
              )}
            </Card>
          </>
        ) : null}
      </AsyncBoundary>
    </DetailShell>
  );
}
