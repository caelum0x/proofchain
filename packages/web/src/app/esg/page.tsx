"use client";

import { useMemo, useState } from "react";
import type { Hex } from "viem";
import { PageHeader, Toolbar } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Callout } from "@/components/ui/Callout";
import { EmptyState, LoadingState } from "@/components/ui/States";
import { RequireWallet } from "@/components/RequireWallet";
import { EsgScoreBadge } from "@/components/esg/EsgScoreBadge";
import { SetEsgForm } from "@/components/esg/SetEsgForm";
import { useEsgRecords, useEsgRecord, type EsgRecordItem } from "@/hooks/useEsg";
import { normalizeBytes32, isBytes32 } from "@/lib/hashing";
import { getErrorMessage } from "@/lib/errors";
import { formatBps, formatTimestamp, shortenHex } from "@/lib/format";

export default function EsgPage() {
  const list = useEsgRecords();
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState<Hex | undefined>(undefined);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const detail = useEsgRecord(subject);

  const onLookup = () => {
    setLookupError(null);
    const trimmed = input.trim();
    if (!trimmed) return setLookupError("Enter a batch/org id or reference.");
    try {
      setSubject(normalizeBytes32(trimmed));
    } catch (e) {
      setLookupError(getErrorMessage(e));
    }
  };

  const avgScore = useMemo(() => {
    if (list.records.length === 0) return 0;
    return Math.round(list.records.reduce((s, r) => s + r.score, 0) / list.records.length);
  }, [list.records]);
  const passing = useMemo(() => list.records.filter((r) => r.score >= 7000).length, [list.records]);

  const columns: readonly Column<EsgRecordItem>[] = [
    { id: "subject", header: "Subject", cell: (r) => <span className="font-mono text-xs">{shortenHex(r.subject, 6, 6)}</span> },
    { id: "score", header: "Score", cell: (r) => <EsgScoreBadge score={r.score} /> },
    { id: "attestor", header: "Attestor", cell: (r) => <AddressBadge address={r.attestor} /> },
    {
      id: "uri",
      header: "Evidence",
      cell: (r) =>
        r.uri ? (
          <a href={r.uri} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">View</a>
        ) : "—",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="ESG Scores"
        subtitle="Environmental, social, and governance attestations per batch and organization, backed by on-chain emissions."
        icon="leaf"
        accentClassName="text-sustainability"
        breadcrumbs={[{ label: "Sustainability", href: "/esg" }, { label: "ESG Scores" }]}
        actions={<Button onClick={() => setDrawerOpen(true)}>Set ESG record</Button>}
      />

      <KpiRow
        loading={list.isLoading}
        items={[
          { label: "Attestations", value: list.records.length.toLocaleString() },
          { label: "Average score", value: formatBps(avgScore), hintTone: avgScore >= 7000 ? "success" : avgScore >= 4000 ? "warn" : "danger" },
          { label: "Passing (≥70%)", value: passing.toLocaleString(), hintTone: "success" },
          { label: "Attestors", value: new Set(list.records.map((r) => r.attestor.toLowerCase())).size.toLocaleString() },
        ]}
      />

      <Card>
        <CardHeader title="Look up a subject" description="Enter a batch/org id (0x…) or a reference to hash." />
        <Toolbar
          actions={<Button variant="secondary" onClick={onLookup}>Look up</Button>}
        >
          <div className="w-full max-w-md">
            <Field label="Subject" htmlFor="esg-lookup" error={lookupError ?? undefined}>
              <Input id="esg-lookup" placeholder="0x… or reference" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onLookup()} />
            </Field>
          </div>
        </Toolbar>

        {subject ? (
          detail.isLoading ? (
            <LoadingState label="Reading ESG record…" />
          ) : detail.record ? (
            <dl className="grid grid-cols-2 gap-4 text-sm md:grid-cols-3">
              <Info label="Subject">{isBytes32(input.trim()) ? shortenHex(subject, 6, 6) : `${input.trim()} → ${shortenHex(subject, 6, 6)}`}</Info>
              <Info label="Score"><EsgScoreBadge score={detail.record.score} /></Info>
              <Info label="Attestor"><AddressBadge address={detail.record.attestor} /></Info>
              <Info label="Updated">{formatTimestamp(detail.record.updatedAt)}</Info>
              <Info label="Emissions (g CO₂e)">{detail.emissions !== undefined ? detail.emissions.toString() : "—"}</Info>
              <Info label="Evidence">
                {detail.record.uri ? (
                  <a href={detail.record.uri} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">Open</a>
                ) : "—"}
              </Info>
            </dl>
          ) : (
            <EmptyState title="No ESG record" description="This subject has no ESG attestation yet." />
          )
        ) : null}
      </Card>

      {list.notDeployed ? (
        <Callout tone="info" title="ESGRegistry not deployed">Not configured on this network.</Callout>
      ) : (
        <DataTable
          columns={columns}
          rows={list.records}
          getRowKey={(r) => r.subject}
          isLoading={list.isLoading}
          error={list.isError ? getErrorMessage(list.error) : null}
          onRetry={list.refetch}
          emptyTitle="No ESG attestations yet"
          emptyDescription="Published ESG records will appear here."
        />
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title="Set ESG attestation">
        <RequireWallet>
          <SetEsgForm onDone={() => { setDrawerOpen(false); list.refetch(); detail.refetch(); }} />
        </RequireWallet>
      </Drawer>
    </div>
  );
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 text-fg">{children}</dd>
    </div>
  );
}
