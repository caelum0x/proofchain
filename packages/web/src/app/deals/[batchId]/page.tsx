"use client";

import { useParams } from "next/navigation";
import type { ReactNode } from "react";
import type { Hex } from "viem";
import { isBytes32 } from "@/lib/hashing";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import { useTimeline } from "@/hooks/useTimeline";
import { useVerdict } from "@/hooks/useVerdict";
import { useUsdc } from "@/hooks/useUsdc";
import { dealStateLabel, dealStateTone, formatBps, type ToneName } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page/PageHeader";
import { AsyncBoundary } from "@/components/page/AsyncBoundary";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge, type SemanticStatus } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { EmptyState } from "@/components/ui/States";
import { ProvenanceTrail } from "@/components/ProvenanceTrail";
import { FindingsList } from "@/components/FindingsList";
import { DealActions } from "@/components/DealActions";
import { DealTimeline } from "@/components/t2/DealTimeline";
import { Money } from "@/components/t2/Money";
import { Bytes32Cell } from "@/components/t2/Bytes32Cell";

function toStatus(tone: ToneName): SemanticStatus {
  return tone === "brand" ? "brand" : tone;
}

export default function DealDetailPage() {
  const params = useParams<{ batchId: string }>();
  const raw = Array.isArray(params.batchId) ? params.batchId[0] : params.batchId;
  const batchId = raw && isBytes32(raw) ? (raw as Hex) : undefined;

  if (!batchId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Deal" breadcrumbs={[{ label: "Settlement" }, { label: "Deals", href: "/deals" }, { label: "Invalid" }]} />
        <EmptyState title="Invalid batch id" description="The URL does not contain a valid 32-byte batch id." />
      </div>
    );
  }

  return <DealDetail batchId={batchId} />;
}

function DealDetail({ batchId }: { batchId: Hex }) {
  const detail = useBatchDetail(batchId);
  const timeline = useTimeline(batchId);
  const verdict = useVerdict(detail.attestation?.verdictURI, true);
  const usdc = useUsdc();

  const attested = Boolean(detail.attestation);
  const score = detail.attestation?.score;
  const threshold = detail.passThreshold ?? 7000;
  const passed = score !== undefined && score >= threshold;
  const deal = detail.deal;

  const header = (
    <PageHeader
      icon="deals"
      accentClassName="text-finance"
      title="Deal detail"
      subtitle={<Bytes32Cell value={batchId} lead={10} tail={8} />}
      breadcrumbs={[{ label: "Settlement" }, { label: "Deals", href: "/deals" }, { label: "Detail" }]}
      actions={deal ? <StatusBadge status={toStatus(dealStateTone(deal.state))}>{dealStateLabel(deal.state)}</StatusBadge> : null}
    />
  );

  const rail = (
    <>
      <Card>
        <CardHeader title="Parties" />
        {deal && deal.state !== 0 ? (
          <dl className="space-y-3 text-sm">
            <Rail label="Buyer">
              <AddressBadge address={deal.buyer} />
            </Rail>
            <Rail label="Supplier">
              <AddressBadge address={deal.supplier} />
            </Rail>
            <Rail label="Amount">
              <Money amount={deal.amount} decimals={usdc.decimals} symbol={usdc.symbol} strong />
            </Rail>
            <Rail label="Token">
              <AddressBadge address={deal.token} />
            </Rail>
          </dl>
        ) : (
          <p className="text-sm text-muted">No deal funded for this batch yet.</p>
        )}
      </Card>

      {deal && deal.state !== 0 ? (
        <Card>
          <CardHeader title="Actions" description="Settlement is permissionless once attested." />
          <DealActions
            batchId={batchId}
            deal={deal}
            isAttested={attested}
            onDone={() => {
              detail.refetch();
              void timeline.refetch();
            }}
          />
        </Card>
      ) : null}

      <Card>
        <CardHeader title="Timeline" description="Registered → checkpoints → attested → settled" />
        <AsyncBoundary
          isLoading={timeline.isLoading}
          error={timeline.isError ? getErrorMessage(timeline.error) : null}
          onRetry={() => void timeline.refetch()}
        >
          <DealTimeline items={timeline.items} />
        </AsyncBoundary>
      </Card>
    </>
  );

  return (
    <DetailShell header={header} rail={rail}>
      <AsyncBoundary
        isLoading={detail.isLoading}
        error={detail.isError ? getErrorMessage(detail.error) : null}
        onRetry={() => detail.refetch()}
      >
        <Card>
          <CardHeader title="Provenance" description="Origin and recorded checkpoints." />
          <ProvenanceTrail batch={detail.batch} checkpoints={detail.checkpoints} />
        </Card>

        <Card>
          <CardHeader
            title="Attestation"
            action={
              attested ? (
                <StatusBadge status={passed ? "success" : "danger"}>
                  {score !== undefined ? formatBps(score) : "—"} · {passed ? "PASS" : "FAIL"}
                </StatusBadge>
              ) : (
                <StatusBadge status="neutral">Not attested</StatusBadge>
              )
            }
          />
          {!attested ? (
            <p className="text-sm text-muted">No attestation yet. Request verification from the Supplier screen.</p>
          ) : (
            <div className="space-y-3">
              <p className="flex flex-wrap items-center gap-1 text-xs text-muted">
                Threshold {formatBps(threshold)} · agent{" "}
                {detail.attestation ? <AddressBadge address={detail.attestation.agent} explorer={false} /> : null}
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
      </AsyncBoundary>
    </DetailShell>
  );
}

function Rail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-fg">{children}</dd>
    </div>
  );
}
