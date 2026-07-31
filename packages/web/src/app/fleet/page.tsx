"use client";

import { useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { PageHeader, Toolbar, SearchParamsBoundary } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { CardGrid } from "@/components/ui/CardGrid";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Avatar } from "@/components/ui/Avatar";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { Callout } from "@/components/ui/Callout";
import { RequireWallet } from "@/components/RequireWallet";
import { RegisterCarrierForm } from "@/components/t4/RegisterCarrierForm";
import { useCarriers, useCarrierProfile } from "@/hooks/logisticsFleet";
import { useT4ListState } from "@/hooks/t4UrlListState";
import { getErrorMessage } from "@/lib/errors";

function FleetPageContent() {
  const { carriers, isLoading, isError, error, notDeployed, refetch } = useCarriers();
  const { address } = useAccount();
  const { profile } = useCarrierProfile(address);
  const url = useT4ListState();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const rows = useMemo(() => {
    const query = url.q.trim().toLowerCase();
    if (!query) return carriers;
    return carriers.filter((c) => c.name.toLowerCase().includes(query) || c.account.toLowerCase().includes(query));
  }, [carriers, url.q]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fleet"
        subtitle="Registered carriers that transport shipments and push cold-chain checkpoints."
        icon="truck"
        accentClassName="text-logistics"
        breadcrumbs={[{ label: "Logistics", href: "/logistics" }, { label: "Fleet" }]}
        actions={<Button onClick={() => setDrawerOpen(true)}>{profile ? "Update profile" : "Register carrier"}</Button>}
      />

      <KpiRow
        loading={isLoading}
        items={[
          { label: "Carriers", value: carriers.length.toLocaleString() },
          { label: "Filtered", value: rows.length.toLocaleString(), hint: url.q ? `“${url.q}”` : "all" },
          { label: "Your status", value: profile ? "Registered" : address ? "Not registered" : "—", hintTone: profile ? "success" : "neutral" },
        ]}
      />

      <Toolbar>
        <Input
          aria-label="Search carriers"
          placeholder="Search by name or address…"
          className="max-w-xs"
          value={url.q}
          onChange={(e) => url.setParams({ q: e.target.value })}
        />
      </Toolbar>

      {notDeployed ? (
        <Callout tone="info" title="CarrierRegistry not deployed">
          The carrier registry is not configured on the active network.
        </Callout>
      ) : (
        <CardGrid
          items={rows}
          getKey={(c) => c.account}
          isLoading={isLoading}
          error={isError ? getErrorMessage(error) : null}
          onRetry={refetch}
          emptyTitle="No carriers registered yet"
          emptyDescription="Carriers appear here once they register on-chain."
          renderItem={(c) => (
            <Card className="h-full">
              <div className="flex items-start gap-3">
                <Avatar seed={c.account} label={c.name} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-medium text-fg">{c.name || "Unnamed carrier"}</p>
                    <StatusBadge domain="logistics">Carrier</StatusBadge>
                  </div>
                  <div className="mt-1"><AddressBadge address={c.account} /></div>
                  {c.uri ? (
                    <a href={c.uri} target="_blank" rel="noreferrer noopener" className="mt-2 inline-block text-xs text-brand hover:underline">
                      View profile
                    </a>
                  ) : null}
                </div>
              </div>
            </Card>
          )}
        />
      )}

      <Drawer open={drawerOpen} onClose={() => setDrawerOpen(false)} title={profile ? "Update carrier profile" : "Register as carrier"}>
        <RequireWallet>
          <RegisterCarrierForm isRegistered={Boolean(profile)} onDone={() => { setDrawerOpen(false); refetch(); }} />
        </RequireWallet>
      </Drawer>
    </div>
  );
}

export default function FleetPage() {
  return (
    <SearchParamsBoundary>
      <FleetPageContent />
    </SearchParamsBoundary>
  );
}
