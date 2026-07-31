"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { Hex } from "viem";
import { isBytes32 } from "@/lib/hashing";
import { useBatchDetail } from "@/hooks/useBatchDetail";
import { useVerdict } from "@/hooks/useVerdict";
import { getErrorMessage } from "@/lib/errors";
import { formatBps, formatTimestamp, shortenHex } from "@/lib/format";
import { PageHeader } from "@/components/page/PageHeader";
import { AsyncBoundary } from "@/components/page/AsyncBoundary";
import { DetailShell } from "@/components/shells/DetailShell";
import { Card, CardHeader } from "@/components/ui/Card";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Meter } from "@/components/ui/Meter";
import { Button } from "@/components/ui/Button";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { FindingsList } from "@/components/FindingsList";
import { attestationStatus } from "@/components/t1/provenanceFormat";

/** Provenance → Attestations → detail: the signed verdict + findings for a batch. */
export default function AttestationDetailPage() {
  const params = useParams<{ batchId: string }>();
  const raw = Array.isArray(params.batchId) ? params.batchId[0] : params.batchId;
  const batchId = raw && isBytes32(raw) ? (raw as Hex) : undefined;

  const detail = useBatchDetail(batchId);
  const verdict = useVerdict(detail.attestation?.verdictURI, true);

  if (!batchId) {
    return (
      <ErrorState
        title="Invalid batch id"
        message="The URL does not contain a valid 32-byte batch id."
      />
    );
  }

  const attestation = detail.attestation;
  const threshold = detail.passThreshold ?? 7000;
  const att = attestationStatus(Boolean(attestation), attestation?.score, threshold);

  const header = (
    <PageHeader
      icon="attestation"
      accentClassName="text-compliance"
      breadcrumbs={[{ label: "Attestations", href: "/attestations" }, { label: shortenHex(batchId, 6, 4) }]}
      title="Attestation"
      subtitle={<span className="font-mono text-xs text-muted">{shortenHex(batchId, 10, 8)}</span>}
      actions={
        <div className="flex items-center gap-2">
          <StatusBadge status={att.status}>{att.label}</StatusBadge>
          <Link href={`/batches/${batchId}`}>
            <Button variant="secondary" size="sm">
              View batch
            </Button>
          </Link>
        </div>
      }
    />
  );

  const rail = (
    <Card>
      <CardHeader title="Score" description={`Threshold ${formatBps(threshold)}`} />
      {attestation ? (
        <div className="space-y-4">
          <Meter value={attestation.score} min={0} max={10000} low={threshold} high={threshold} showValue={false} />
          <p className="text-3xl font-semibold tracking-tight text-fg">{formatBps(attestation.score)}</p>
          <dl className="space-y-2 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Agent</dt>
              <dd><AddressBadge address={attestation.agent} /></dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Attested</dt>
              <dd className="text-fg">{attestation.attestedAt ? formatTimestamp(attestation.attestedAt) : "—"}</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Verdict hash</dt>
              <dd className="font-mono text-xs text-fg">{shortenHex(attestation.verdictHash, 6, 4)}</dd>
            </div>
          </dl>
        </div>
      ) : (
        <p className="text-sm text-muted">This batch has not been attested yet.</p>
      )}
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
        loading={<LoadingState label="Loading attestation…" />}
      >
        <Card>
          <CardHeader title="Findings" description="Structured issues raised by the verification agent." />
          {!attestation ? (
            <p className="text-sm text-muted">
              No attestation exists yet. The agent writes a signed verdict once verification is requested.
            </p>
          ) : (
            <AsyncBoundary
              isLoading={verdict.isLoading}
              error={verdict.isError ? "Could not load the verdict document." : null}
              isEmpty={!verdict.verdict}
              emptyTitle="No verdict document"
              emptyDescription="This attestation has no off-chain verdict document to display."
            >
              {verdict.verdict ? (
                <div className="space-y-4">
                  <div className="flex flex-wrap gap-2 text-xs text-muted">
                    <StatusBadge status={verdict.verdict.passed ? "success" : "danger"}>
                      {verdict.verdict.passed ? "PASS" : "FAIL"}
                    </StatusBadge>
                    <span>model {verdict.verdict.model}</span>
                    <span>{verdict.verdict.findings.length} findings</span>
                  </div>
                  <FindingsList findings={verdict.verdict.findings} />
                </div>
              ) : null}
            </AsyncBoundary>
          )}
        </Card>
      </AsyncBoundary>
    </DetailShell>
  );
}
