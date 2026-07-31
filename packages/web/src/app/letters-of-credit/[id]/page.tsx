"use client";

import { use, type ReactNode } from "react";
import Link from "next/link";
import type { Hex } from "viem";
import { isBytes32 } from "@/lib/hashing";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import { useTimeline } from "@/hooks/useTimeline";
import { useUsdc } from "@/hooks/useUsdc";
import { getErrorMessage } from "@/lib/errors";
import { formatBps } from "@/lib/format";
import { DealState, type DealStateValue } from "@/lib/types";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page/PageHeader";
import { AsyncBoundary } from "@/components/page/AsyncBoundary";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge, type SemanticStatus } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { EmptyState } from "@/components/ui/States";
import { DealActions } from "@/components/DealActions";
import { DealTimeline } from "@/components/t2/DealTimeline";
import { Money } from "@/components/t2/Money";
import { Bytes32Cell } from "@/components/t2/Bytes32Cell";

function lcStatus(state: DealStateValue): { label: string; tone: SemanticStatus } {
  switch (state) {
    case DealState.Funded:
      return { label: "Live", tone: "brand" };
    case DealState.Released:
      return { label: "Honoured", tone: "success" };
    case DealState.Disputed:
      return { label: "Under review", tone: "danger" };
    case DealState.Refunded:
      return { label: "Cancelled", tone: "warn" };
    default:
      return { label: "Draft", tone: "neutral" };
  }
}

export default function LetterOfCreditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const batchId = isBytes32(id) ? (id as Hex) : undefined;

  const breadcrumbs = [
    { label: "Trade Finance" },
    { label: "Letters of Credit", href: "/letters-of-credit" },
    { label: "Credit" },
  ];

  if (!batchId) {
    return (
      <div className="space-y-6">
        <PageHeader title="Letter of credit" breadcrumbs={breadcrumbs} icon="certificate" accentClassName="text-finance" />
        <EmptyState title="Invalid credit reference" description="A credit reference must be a 32-byte 0x… value." />
      </div>
    );
  }

  return <LcDetail batchId={batchId} breadcrumbs={breadcrumbs} />;
}

function LcDetail({ batchId, breadcrumbs }: { batchId: Hex; breadcrumbs: { label: string; href?: string }[] }) {
  const detail = useBatchDetail(batchId);
  const timeline = useTimeline(batchId);
  const usdc = useUsdc();

  const deal = detail.deal;
  const status = deal ? lcStatus(deal.state) : null;
  const attested = Boolean(detail.attestation);
  const score = detail.attestation?.score;
  const threshold = detail.passThreshold ?? 7000;

  const header = (
    <PageHeader
      icon="certificate"
      accentClassName="text-finance"
      title="Letter of credit"
      subtitle={<Bytes32Cell value={batchId} lead={10} tail={8} />}
      breadcrumbs={breadcrumbs}
      actions={status ? <StatusBadge status={status.tone}>{status.label}</StatusBadge> : null}
    />
  );

  const rail = (
    <>
      <Card>
        <CardHeader title="Credit terms" />
        {deal && deal.state !== DealState.None ? (
          <dl className="space-y-3 text-sm">
            <Row label="Applicant">
              <AddressBadge address={deal.buyer} />
            </Row>
            <Row label="Beneficiary">
              <AddressBadge address={deal.supplier} />
            </Row>
            <Row label="Credit amount">
              <Money amount={deal.amount} decimals={usdc.decimals} symbol={usdc.symbol} strong />
            </Row>
            <Row label="Settlement token">
              <AddressBadge address={deal.token} />
            </Row>
          </dl>
        ) : (
          <p className="text-sm text-muted">This credit has not been issued (escrow not funded) yet.</p>
        )}
      </Card>

      {deal && deal.state !== DealState.None ? (
        <Card>
          <CardHeader title="Presentation" description="Honour the credit once documents are attested." />
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
          <CardHeader
            title="Document compliance"
            description="The delivery attestation stands in for a document presentation."
            action={
              attested ? (
                <StatusBadge status={score !== undefined && score >= threshold ? "success" : "danger"}>
                  {score !== undefined ? formatBps(score) : "—"}
                </StatusBadge>
              ) : (
                <StatusBadge status="neutral">Awaiting</StatusBadge>
              )
            }
          />
          {attested ? (
            <p className="text-sm text-fg/90">
              Delivery attested at {score !== undefined ? formatBps(score) : "—"} against a {formatBps(threshold)} threshold.
              A passing score authorises the credit to be honoured automatically.
            </p>
          ) : (
            <p className="text-sm text-muted">
              No compliant presentation yet. The credit is honoured once the delivery attestation passes the threshold.
            </p>
          )}
        </Card>

        <Card>
          <CardHeader title="Lifecycle" description="Issuance → funding → presentation → settlement." />
          <AsyncBoundary
            isLoading={timeline.isLoading}
            error={timeline.isError ? getErrorMessage(timeline.error) : null}
            onRetry={() => void timeline.refetch()}
          >
            <DealTimeline items={timeline.items} />
          </AsyncBoundary>
        </Card>

        <p className="text-xs text-muted">
          Back to <Link href="/letters-of-credit" className="text-brand hover:underline">all credits</Link>.
        </p>
      </AsyncBoundary>
    </DetailShell>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="min-w-0 text-right text-fg">{children}</dd>
    </div>
  );
}
