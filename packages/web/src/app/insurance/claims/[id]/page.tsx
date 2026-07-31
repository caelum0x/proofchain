"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import type { Hex } from "viem";
import { ClaimState } from "@proofchain/shared";
import { DetailShell } from "@/components/shells";
import { PageHeader } from "@/components/page";
import {
  AddressBadge,
  Badge,
  Callout,
  Card,
  CardHeader,
  CopyButton,
  ErrorState,
  LoadingState,
  StatusBadge,
  Timeline,
  TxButton,
  type TimelineEvent,
} from "@/components/ui";
import { useInsuranceClaim } from "@/hooks/useInsuranceClaim";
import { useUsdc } from "@/hooks/useUsdc";
import { NotAvailable } from "@/components/t3/NotAvailable";
import { claimLabel, claimTimeline, claimTone } from "@/components/t3/insurance-view";
import { contractRef } from "@/lib/contracts";
import { isBytes32 } from "@/lib/hashing";
import { formatTimestamp, formatTokenAmount, shortenHex } from "@/lib/format";

export default function ClaimDetailPage() {
  const routeParams = useParams<{ id: string }>();
  const rawId = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  const validId = typeof rawId === "string" && isBytes32(rawId);
  const claimId = validId ? (rawId as Hex) : undefined;

  const usdc = useUsdc();
  const { claim, isArbiter, deployed, isLoading, error, refetch } = useInsuranceClaim(claimId);

  const header = (
    <PageHeader
      icon="claims"
      accentClassName="text-compliance"
      title="Claim"
      subtitle={claimId ? <span className="font-mono text-xs">{shortenHex(claimId, 8, 8)}</span> : "Invalid claim id"}
      breadcrumbs={[
        { label: "Insurance", href: "/insurance" },
        { label: "Claims", href: "/insurance/claims" },
        { label: claimId ? shortenHex(claimId) : "—" },
      ]}
    />
  );

  if (!deployed) return <Shell header={header}><NotAvailable resource="Claims" /></Shell>;
  if (!validId)
    return (
      <Shell header={header}>
        <Callout tone="danger" title="Invalid claim id">
          A claim id must be a 32-byte hex value (0x…).
        </Callout>
      </Shell>
    );
  if (isLoading) return <Shell header={header}><LoadingState label="Reading claim…" /></Shell>;
  if (error) return <Shell header={header}><ErrorState message={error} onRetry={refetch} /></Shell>;
  if (!claim)
    return (
      <Shell header={header}>
        <Callout tone="warn" title="Claim not found">
          No claim exists for this id on the configured network.
        </Callout>
      </Shell>
    );

  const timeline: TimelineEvent[] = claimTimeline(claim).map((e) => ({ id: e.id, title: e.title, tone: e.tone }));

  const rail = (
    <>
      <Card>
        <CardHeader title="Status" />
        <div className="flex items-center justify-between">
          <Badge tone={claimTone(claim.state)}>{claimLabel(claim.state)}</Badge>
          <span className="text-xs text-muted">Filed {formatTimestamp(claim.filedAt)}</span>
        </div>
      </Card>

      <Card className="space-y-3">
        <CardHeader title="Arbiter actions" />
        {!isArbiter ? (
          <p className="text-sm text-muted">Only accounts with the arbiter role can review this claim.</p>
        ) : claim.state === ClaimState.Filed ? (
          <div className="flex flex-col gap-2">
            <TxButton
              className="w-full"
              write={() => ({ ...contractRef("ClaimsProcessor"), functionName: "approveClaim", args: [claim.claimId] })}
              successLabel="Claim approved"
              pendingLabel="Approving…"
              onConfirmed={refetch}
            >
              Approve claim
            </TxButton>
            <TxButton
              variant="danger"
              className="w-full"
              write={() => ({ ...contractRef("ClaimsProcessor"), functionName: "rejectClaim", args: [claim.claimId] })}
              successLabel="Claim rejected"
              pendingLabel="Rejecting…"
              onConfirmed={refetch}
            >
              Reject claim
            </TxButton>
          </div>
        ) : claim.state === ClaimState.Approved ? (
          <TxButton
            className="w-full"
            write={() => ({ ...contractRef("ClaimsProcessor"), functionName: "payout", args: [claim.claimId] })}
            successLabel="Claim paid out"
            pendingLabel="Paying out…"
            onConfirmed={refetch}
          >
            Pay out claim
          </TxButton>
        ) : (
          <p className="text-sm text-muted">No further action required.</p>
        )}
      </Card>

      <Card>
        <CardHeader title="Metadata" />
        <dl className="space-y-2 text-sm">
          <MetaRow label="Claim id">
            <span className="flex items-center gap-1 font-mono text-xs">
              {shortenHex(claim.claimId, 6, 6)}
              <CopyButton value={claim.claimId} label="" />
            </span>
          </MetaRow>
          <MetaRow label="Policy">
            {claim.policyId ? (
              <Link href={`/insurance/policies/${claim.policyId}`} className="font-mono text-xs text-brand hover:underline">
                {shortenHex(claim.policyId)}
              </Link>
            ) : (
              "—"
            )}
          </MetaRow>
          <MetaRow label="Claimant">
            {claim.claimant ? <AddressBadge address={claim.claimant} explorer={false} /> : "—"}
          </MetaRow>
        </dl>
      </Card>
    </>
  );

  return (
    <DetailShell header={header} rail={rail}>
      <Card>
        <CardHeader title="Claim amount" description="Loss claimed against the covered policy." />
        <div className="flex items-baseline justify-between">
          <StatusBadge status={claim.state === ClaimState.Paid ? "success" : "info"}>
            {claimLabel(claim.state)}
          </StatusBadge>
          <span className="font-mono text-2xl font-semibold tabular-nums text-fg">
            {formatTokenAmount(claim.amount ?? 0n, usdc.decimals)} {usdc.symbol}
          </span>
        </div>
      </Card>

      <Card>
        <CardHeader title="Lifecycle" description="Claim events from filing to settlement." />
        <Timeline events={timeline} />
      </Card>
    </DetailShell>
  );
}

function Shell({ header, children }: { readonly header: React.ReactNode; readonly children: React.ReactNode }) {
  return (
    <div className="space-y-6">
      {header}
      {children}
    </div>
  );
}

function MetaRow({ label, children }: { readonly label: string; readonly children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-muted">{label}</dt>
      <dd className="text-fg">{children}</dd>
    </div>
  );
}
