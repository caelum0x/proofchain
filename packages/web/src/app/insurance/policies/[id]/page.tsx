"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import type { Hex } from "viem";
import { useAccount } from "wagmi";
import { PolicyState } from "@proofchain/shared";
import { DetailShell } from "@/components/shells";
import { PageHeader } from "@/components/page";
import {
  AddressBadge,
  Badge,
  Button,
  Callout,
  Card,
  CardHeader,
  CopyButton,
  Dialog,
  ErrorState,
  LoadingState,
  Timeline,
  TxButton,
  type TimelineEvent,
} from "@/components/ui";
import { useInsurancePolicy } from "@/hooks/useInsurancePolicy";
import { useUsdc } from "@/hooks/useUsdc";
import { FileClaimForm } from "@/components/insurance/FileClaimForm";
import { NotAvailable } from "@/components/t3/NotAvailable";
import { policyLabel, policyTimeline, policyTone } from "@/components/t3/insurance-view";
import { contractRef } from "@/lib/contracts";
import { isBytes32 } from "@/lib/hashing";
import { formatTimestamp, formatTokenAmount, shortenHex } from "@/lib/format";

export default function PolicyDetailPage() {
  const routeParams = useParams<{ id: string }>();
  const rawId = Array.isArray(routeParams.id) ? routeParams.id[0] : routeParams.id;
  const validId = typeof rawId === "string" && isBytes32(rawId);
  const policyId = validId ? (rawId as Hex) : undefined;

  const { address: account } = useAccount();
  const usdc = useUsdc();
  const { policy, deployed, isLoading, error, refetch } = useInsurancePolicy(policyId);
  const [claimOpen, setClaimOpen] = useState(false);

  const header = (
    <PageHeader
      icon="certificate"
      accentClassName="text-compliance"
      title="Policy"
      subtitle={policyId ? <span className="font-mono text-xs">{shortenHex(policyId, 8, 8)}</span> : "Invalid policy id"}
      breadcrumbs={[
        { label: "Insurance", href: "/insurance" },
        { label: "Policies", href: "/insurance/policies" },
        { label: policyId ? shortenHex(policyId) : "—" },
      ]}
    />
  );

  if (!deployed) {
    return (
      <div className="space-y-6">
        {header}
        <NotAvailable resource="Policies" />
      </div>
    );
  }
  if (!validId) {
    return (
      <div className="space-y-6">
        {header}
        <Callout tone="danger" title="Invalid policy id">
          A policy id must be a 32-byte hex value (0x…).
        </Callout>
      </div>
    );
  }
  if (isLoading) {
    return (
      <div className="space-y-6">
        {header}
        <LoadingState label="Reading policy…" />
      </div>
    );
  }
  if (error) {
    return (
      <div className="space-y-6">
        {header}
        <ErrorState message={error} onRetry={refetch} />
      </div>
    );
  }
  if (!policy) {
    return (
      <div className="space-y-6">
        {header}
        <Callout tone="warn" title="Policy not found">
          No policy exists for this id on the configured network.
        </Callout>
      </div>
    );
  }

  const isHolder = Boolean(account && policy.holder && account.toLowerCase() === policy.holder.toLowerCase());
  const canCancel = isHolder && policy.state === PolicyState.Active;
  const canClaim = isHolder && policy.state === PolicyState.Active;

  const timeline: TimelineEvent[] = policyTimeline(policy).map((e) => ({
    id: e.id,
    title: e.title,
    description: e.description,
    tone: e.tone,
  }));

  const rail = (
    <>
      <Card>
        <CardHeader title="Status" />
        <div className="flex items-center justify-between">
          <Badge tone={policyTone(policy.state)}>{policyLabel(policy.state)}</Badge>
          <span className="text-xs text-muted">Issued {formatTimestamp(policy.issuedAt)}</span>
        </div>
      </Card>

      <Card className="space-y-3">
        <CardHeader title="Actions" />
        {canClaim ? (
          <Button variant="secondary" className="w-full" onClick={() => setClaimOpen(true)}>
            File a claim
          </Button>
        ) : null}
        {canCancel ? (
          <TxButton
            variant="danger"
            className="w-full"
            write={() => ({ ...contractRef("PolicyManager"), functionName: "cancelPolicy", args: [policy.policyId] })}
            successLabel="Policy cancelled"
            pendingLabel="Cancelling…"
            onConfirmed={refetch}
          >
            Cancel policy
          </TxButton>
        ) : null}
        {!canClaim && !canCancel ? (
          <p className="text-sm text-muted">No actions available for this policy.</p>
        ) : null}
      </Card>

      <Card>
        <CardHeader title="Metadata" />
        <dl className="space-y-2 text-sm">
          <MetaRow label="Policy id">
            <span className="flex items-center gap-1 font-mono text-xs">
              {shortenHex(policy.policyId, 6, 6)}
              <CopyButton value={policy.policyId} label="" />
            </span>
          </MetaRow>
          <MetaRow label="Batch">
            {policy.batchId ? (
              <Link href={`/invoices/${policy.batchId}`} className="font-mono text-xs text-brand hover:underline">
                {shortenHex(policy.batchId)}
              </Link>
            ) : (
              "—"
            )}
          </MetaRow>
          <MetaRow label="Holder">
            {policy.holder ? <AddressBadge address={policy.holder} explorer={false} /> : "—"}
          </MetaRow>
          {policy.token ? (
            <MetaRow label="Token">
              <AddressBadge address={policy.token} explorer={false} />
            </MetaRow>
          ) : null}
        </dl>
      </Card>
    </>
  );

  return (
    <>
      <DetailShell header={header} rail={rail}>
        <Card>
          <CardHeader title="Cover" description="Coverage and premium for this policy." />
          <dl className="grid grid-cols-2 gap-4">
            <Figure label="Coverage" value={`${formatTokenAmount(policy.coverage ?? 0n, usdc.decimals)} ${usdc.symbol}`} />
            <Figure label="Premium paid" value={`${formatTokenAmount(policy.premium ?? 0n, usdc.decimals)} ${usdc.symbol}`} />
          </dl>
        </Card>

        <Card>
          <CardHeader title="Lifecycle" description="Policy events from issue to settlement." />
          <Timeline events={timeline} />
        </Card>
      </DetailShell>

      <Dialog open={claimOpen} onClose={() => setClaimOpen(false)} title="File a claim">
        <FileClaimForm
          decimals={usdc.decimals}
          symbol={usdc.symbol}
          defaultPolicyId={policy.policyId}
          onFiled={() => {
            setClaimOpen(false);
            refetch();
          }}
        />
      </Dialog>
    </>
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

function Figure({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-1 text-lg font-semibold tabular-nums text-fg">{value}</dd>
    </div>
  );
}
