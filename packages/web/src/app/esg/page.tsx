"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { useEsgRecords, useEsgRecord } from "@/hooks/useEsg";
import { EsgScoreBadge } from "@/components/esg/EsgScoreBadge";
import { SetEsgForm } from "@/components/esg/SetEsgForm";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { AddressLink } from "@/components/ui/TxLink";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { normalizeBytes32, isBytes32 } from "@/lib/hashing";
import { formatTimestamp, shortenHex } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import type { EsgRecordItem } from "@/hooks/useEsg";

export default function EsgPage() {
  const list = useEsgRecords();
  const [input, setInput] = useState("");
  const [subject, setSubject] = useState<Hex | undefined>(undefined);
  const [lookupError, setLookupError] = useState<string | null>(null);
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

  const columns: readonly Column<EsgRecordItem>[] = [
    {
      id: "subject",
      header: "Subject",
      cell: (r) => <span className="font-mono text-xs">{shortenHex(r.subject, 6, 6)}</span>,
    },
    { id: "score", header: "Score", cell: (r) => <EsgScoreBadge score={r.score} /> },
    { id: "attestor", header: "Attestor", cell: (r) => <AddressLink address={r.attestor} /> },
    {
      id: "uri",
      header: "Evidence",
      cell: (r) =>
        r.uri ? (
          <a href={r.uri} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">
            View
          </a>
        ) : (
          "—"
        ),
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">ESG</h1>
        <p className="mt-1 text-sm text-muted">
          Environmental, social, and governance scores attested per batch and organization, backed by
          on-chain emissions data.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Look up a subject" description="Enter a batch/org id (0x…) or a reference to hash." />
            <div className="flex flex-wrap items-end gap-2">
              <div className="flex-1">
                <Field label="Subject" htmlFor="esg-lookup" error={lookupError ?? undefined}>
                  <Input
                    id="esg-lookup"
                    placeholder="0x… or reference"
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && onLookup()}
                  />
                </Field>
              </div>
              <div className="mb-4">
                <Button onClick={onLookup}>Look up</Button>
              </div>
            </div>

            {subject ? (
              detail.isLoading ? (
                <LoadingState label="Reading ESG record…" />
              ) : detail.record ? (
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <Info label="Subject">
                    {isBytes32(input.trim()) ? shortenHex(subject, 6, 6) : `${input.trim()} → ${shortenHex(subject, 6, 6)}`}
                  </Info>
                  <Info label="Score">
                    <EsgScoreBadge score={detail.record.score} />
                  </Info>
                  <Info label="Attestor">
                    <AddressBadge address={detail.record.attestor} />
                  </Info>
                  <Info label="Updated">{formatTimestamp(detail.record.updatedAt)}</Info>
                  <Info label="Emissions (CO₂e g)">
                    {detail.emissions !== undefined ? detail.emissions.toString() : "—"}
                  </Info>
                  <Info label="Evidence">
                    {detail.record.uri ? (
                      <a href={detail.record.uri} target="_blank" rel="noreferrer noopener" className="text-brand hover:underline">
                        Open
                      </a>
                    ) : (
                      "—"
                    )}
                  </Info>
                </dl>
              ) : (
                <EmptyState title="No ESG record" description="This subject has no ESG attestation yet." />
              )
            ) : null}
          </Card>

          <Card>
            <CardHeader title="Recent attestations" />
            {list.notDeployed ? (
              <EmptyState title="ESGRegistry not deployed" description="Not configured on this network." />
            ) : list.isError ? (
              <ErrorState message={getErrorMessage(list.error)} onRetry={list.refetch} />
            ) : (
              <DataTable
                columns={columns}
                rows={list.records}
                getRowKey={(r) => r.subject}
                isLoading={list.isLoading}
                emptyTitle="No ESG attestations yet"
                emptyDescription="Published ESG records will appear here."
              />
            )}
          </Card>
        </div>

        <div>
          <RequireWallet>
            <SetEsgForm onDone={() => { list.refetch(); detail.refetch(); }} />
          </RequireWallet>
        </div>
      </div>
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
