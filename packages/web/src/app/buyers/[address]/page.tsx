"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useActorProfile } from "@/hooks/useActorProfile";
import { useBuyerDeals } from "@/hooks/useBuyerDeals";
import { normalizeAddress } from "@/lib/directory";
import { getErrorMessage } from "@/lib/errors";
import { formatTokenAmount, formatTimestamp } from "@/lib/format";
import { DealState } from "@/lib/types";
import { DetailShell } from "@/components/shells/DetailShell";
import { PageHeader } from "@/components/page";
import { Card, CardHeader } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState } from "@/components/ui/States";
import { DealList } from "@/components/directory/DealList";

const USDC_DECIMALS = 6;

/**
 * Buyer profile (WD §2 DetailShell): identity (BuyerRegistry) plus every escrow
 * deal they funded, with headline totals in the rail.
 */
export default function BuyerProfilePage() {
  const params = useParams<{ address: string }>();
  const raw = Array.isArray(params.address) ? params.address[0] : params.address;
  const account = normalizeAddress(raw);

  const profileResult = useActorProfile("BuyerRegistry", account);
  const dealsResult = useBuyerDeals(account);

  const totals = useMemo(() => {
    let funded = 0n;
    let released = 0n;
    for (const deal of dealsResult.deals) {
      funded += deal.amount;
      if (deal.state === DealState.Released) released += deal.amount;
    }
    return { funded, released, count: dealsResult.deals.length };
  }, [dealsResult.deals]);

  if (!account) {
    return (
      <ErrorState
        title="Invalid address"
        message="The URL does not contain a valid 0x… wallet address."
      />
    );
  }

  const name = profileResult.profile?.name;
  const header = (
    <PageHeader
      icon="buyers"
      title={name || "Buyer"}
      breadcrumbs={[{ label: "Identity" }, { label: "Buyers" }, { label: name || "Profile" }]}
    />
  );

  return (
    <DetailShell
      header={header}
      rail={
        <>
          <Card>
            <CardHeader title="Identity" />
            <div className="space-y-2 text-sm">
              <AddressBadge address={account} />
              {profileResult.profile ? (
                <p className="text-xs text-muted">
                  Registered {formatTimestamp(profileResult.profile.registeredAt)}
                </p>
              ) : (
                <p className="text-xs text-warn">No BuyerRegistry profile for this address.</p>
              )}
            </div>
          </Card>
          <StatCard label="Deals funded" value={totals.count} loading={dealsResult.isLoading} />
          <StatCard
            label="Total funded"
            value={`${formatTokenAmount(totals.funded, USDC_DECIMALS)} USDC`}
            loading={dealsResult.isLoading}
          />
          <StatCard
            label="Settled value"
            value={`${formatTokenAmount(totals.released, USDC_DECIMALS)} USDC`}
            loading={dealsResult.isLoading}
          />
        </>
      }
    >
      <Card>
        <CardHeader title="Funded deals" description="Escrow deals this buyer created." />
        <DealList
          deals={dealsResult.deals}
          counterpartyLabel="Supplier"
          counterparty="supplier"
          isLoading={dealsResult.isLoading}
          isError={dealsResult.isError}
          error={dealsResult.isError ? getErrorMessage(dealsResult.error) : null}
          onRetry={dealsResult.refetch}
        />
      </Card>
    </DetailShell>
  );
}
