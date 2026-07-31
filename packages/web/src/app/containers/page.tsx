"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, Toolbar, SearchParamsBoundary } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { CardGrid } from "@/components/ui/CardGrid";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
import { TempBadge } from "@/components/t4/TempBadge";
import { useShipments } from "@/hooks/logisticsCheckpoints";
import { useT4ListState } from "@/hooks/t4UrlListState";
import { normalizeBytes32 } from "@/lib/hashing";
import { getErrorMessage } from "@/lib/errors";
import { shortenHex } from "@/lib/format";

function ContainersPageContent() {
  const router = useRouter();
  const { shipments, isLoading, isError, error, notDeployed, refetch } = useShipments();
  const url = useT4ListState();
  const [lookup, setLookup] = useState("");
  const [lookupError, setLookupError] = useState<string | null>(null);

  const onLookup = () => {
    setLookupError(null);
    const trimmed = lookup.trim();
    if (!trimmed) return setLookupError("Enter a container id or reference.");
    try {
      router.push(`/containers/${normalizeBytes32(trimmed)}`);
    } catch (e) {
      setLookupError(getErrorMessage(e));
    }
  };

  const rows = useMemo(() => {
    const query = url.q.trim().toLowerCase();
    if (!query) return shipments;
    return shipments.filter((s) => s.batchId.toLowerCase().includes(query) || s.lastLocation.toLowerCase().includes(query));
  }, [shipments, url.q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Containers"
        subtitle="Look up any container by id to inspect its checkpoint trail and cold-chain profile."
        icon="container"
        accentClassName="text-logistics"
        breadcrumbs={[{ label: "Logistics", href: "/logistics" }, { label: "Containers" }]}
      />

      <Card>
        <div className="flex flex-wrap items-end gap-2">
          <div className="flex-1">
            <label htmlFor="container-lookup" className="label">Container id or reference</label>
            <Input
              id="container-lookup"
              placeholder="0x… or Reefer #C-8842"
              value={lookup}
              onChange={(e) => setLookup(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && onLookup()}
            />
            {lookupError ? <p className="field-error" role="alert">{lookupError}</p> : null}
          </div>
          <Button onClick={onLookup}>Inspect</Button>
        </div>
      </Card>

      <KpiRow
        loading={isLoading}
        items={[
          { label: "Tracked containers", value: shipments.length.toLocaleString() },
          { label: "Checkpoints", value: shipments.reduce((n, s) => n + s.checkpoints, 0).toLocaleString() },
          { label: "Filtered", value: rows.length.toLocaleString(), hint: url.q ? `“${url.q}”` : "all" },
        ]}
      />

      <Toolbar>
        <Input aria-label="Search containers" placeholder="Search recent containers…" className="max-w-xs" value={url.q} onChange={(e) => url.setParams({ q: e.target.value })} />
      </Toolbar>

      {notDeployed ? (
        <Callout tone="info" title="CheckpointOracle not deployed">Container tracking is unavailable on this network.</Callout>
      ) : (
        <CardGrid
          items={rows}
          getKey={(s) => s.batchId}
          isLoading={isLoading}
          error={isError ? getErrorMessage(error) : null}
          onRetry={refetch}
          emptyTitle="No containers tracked yet"
          emptyDescription="Containers appear as checkpoints are recorded."
          renderItem={(s) => (
            <button type="button" onClick={() => router.push(`/containers/${s.batchId}`)} className="block w-full text-left">
              <Card className="h-full transition-colors hover:border-logistics/50">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-mono text-xs text-fg">{shortenHex(s.batchId, 6, 6)}</span>
                  <TempBadge temp={s.lastTemp} />
                </div>
                <p className="mt-2 text-sm text-muted">{s.lastLocation || "Unknown location"}</p>
                <p className="mt-1 text-xs text-faint">{s.checkpoints} checkpoint{s.checkpoints > 1 ? "s" : ""}</p>
              </Card>
            </button>
          )}
        />
      )}
    </div>
  );
}

export default function ContainersPage() {
  return (
    <SearchParamsBoundary>
      <ContainersPageContent />
    </SearchParamsBoundary>
  );
}
