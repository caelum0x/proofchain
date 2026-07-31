"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { isAddress, type Address } from "viem";
import { useCredentials, useWorkerProfile, type Credential } from "@/hooks/useWorkforce";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page/PageHeader";
import { InfoCard } from "@/components/t5/DefinitionList";
import { fmtDate, statusTone, titleCase } from "@/components/t5/format";
import { Card, CardHeader } from "@/components/ui/Card";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { Timeline, type TimelineEvent } from "@/components/ui/Timeline";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { ErrorState } from "@/components/ui/States";
import { shortenHex } from "@/lib/format";

function credType(c: Credential): string {
  return c.credential_type ?? c.type ?? "Credential";
}

export default function CredentialsPage() {
  const routeParams = useParams<{ address: string }>();
  const raw = Array.isArray(routeParams.address) ? routeParams.address[0] : routeParams.address;
  const address = raw && isAddress(raw) ? (raw as Address) : undefined;

  const query = useCredentials(address);
  const profile = useWorkerProfile(address);

  const columns = useMemo<readonly Column<Credential>[]>(
    () => [
      { id: "type", header: "Credential", cell: (c) => <span className="font-medium text-fg">{credType(c)}</span> },
      { id: "issuer", header: "Issuer", cell: (c) => (c.issuer ? <AddressBadge address={c.issuer} /> : "—") },
      { id: "status", header: "Status", cell: (c) => <StatusBadge status={statusTone(c.status)}>{titleCase(c.status)}</StatusBadge> },
      { id: "issued", header: "Issued", cell: (c) => <span className="text-muted">{fmtDate(c.issued_at)}</span> },
      { id: "expires", header: "Expires", cell: (c) => <span className="text-muted">{fmtDate(c.expires_at)}</span> },
      {
        id: "uri",
        header: "",
        align: "right",
        cell: (c) =>
          c.uri ? (
            <a href={c.uri} target="_blank" rel="noreferrer noopener" className="text-xs text-brand hover:underline">
              View
            </a>
          ) : null,
      },
    ],
    [],
  );

  const timeline = useMemo<readonly TimelineEvent[]>(
    () =>
      query.items
        .filter((c) => c.issued_at !== undefined)
        .slice(0, 12)
        .map((c) => ({
          id: c.id,
          title: credType(c),
          timestamp: fmtDate(c.issued_at),
          description: c.issuer ? `Issued by ${shortenHex(c.issuer)}` : undefined,
          tone: statusTone(c.status),
        })),
    [query.items],
  );

  if (!address) {
    return (
      <div className="space-y-6">
        <PageHeader title="Credentials" breadcrumbs={[{ label: "Workforce", href: "/workforce" }, { label: "Credentials" }]} icon="credential" accentClassName="text-workforce" />
        <ErrorState title="Invalid address" message="The URL does not contain a valid 0x worker address." />
      </div>
    );
  }

  const active = query.items.filter((c) => ["valid", "active", "verified"].includes((c.status ?? "").toLowerCase())).length;

  return (
    <DetailShell
      header={
        <PageHeader
          title={`Credentials · ${shortenHex(address, 6, 6)}`}
          subtitle="Verifiable credentials held by this worker."
          breadcrumbs={[{ label: "Workforce", href: "/workforce" }, { label: "Credentials" }, { label: shortenHex(address) }]}
          icon="credential"
          accentClassName="text-workforce"
          actions={
            <Link href="/workforce">
              <Button variant="secondary" size="sm">
                Back to workforce
              </Button>
            </Link>
          }
        />
      }
      rail={
        <>
          <InfoCard
            title="Worker"
            items={[
              { label: "Address", value: <AddressBadge address={address} />, wide: true },
              { label: "Name", value: profile.data?.name ?? "—" },
              { label: "Organization", value: profile.data?.org ?? "—" },
              { label: "Credentials", value: query.total || query.items.length },
              { label: "Active", value: active },
            ]}
          />
          <Card>
            <CardHeader title="Related" />
            <div className="flex flex-col gap-2">
              <Link href="/skills" className="text-sm text-brand hover:underline">
                Skills registry →
              </Link>
              <Link href="/safety-training" className="text-sm text-brand hover:underline">
                Safety training →
              </Link>
              <Link href={`/reputation/${address}`} className="text-sm text-brand hover:underline">
                Reputation profile →
              </Link>
            </div>
          </Card>
        </>
      }
    >
      {query.error ? (
        <Callout tone="warn" title="Credential service unavailable">
          {query.error}
        </Callout>
      ) : null}

      <Card className="p-0">
        <div className="p-5 pb-0">
          <CardHeader title="Credentials" description="Every verifiable credential issued to this worker." />
        </div>
        <div className="p-5 pt-2">
          <DataTable
            columns={columns}
            rows={query.items}
            getRowKey={(c) => c.id}
            isLoading={query.isLoading}
            error={query.error}
            onRetry={query.refetch}
            emptyTitle="No credentials"
            emptyDescription="This worker has no verifiable credentials on record yet."
          />
        </div>
      </Card>

      {timeline.length > 0 ? (
        <Card>
          <CardHeader title="Issuance timeline" />
          <Timeline events={timeline} />
        </Card>
      ) : null}
    </DetailShell>
  );
}
