"use client";

import { useMemo } from "react";
import { useParams } from "next/navigation";
import { useActorProfile } from "@/hooks/useActorProfile";
import { useBuyerDeals } from "@/hooks/useBuyerDeals";
import { normalizeAddress } from "@/lib/directory";
import { getErrorMessage } from "@/lib/errors";
import { formatTokenAmount } from "@/lib/format";
import { DealState } from "@/lib/types";
import { Card, CardHeader } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { StatCard } from "@/components/ui/StatCard";
import { ErrorState, LoadingState } from "@/components/ui/States";
import { ProfileHeader } from "@/components/directory/ProfileHeader";
import { DealList } from "@/components/directory/DealList";

const USDC_DECIMALS = 6;

/**
 * Buyer profile: identity (BuyerRegistry) plus every escrow deal they funded,
 * with headline totals (deal count, total + settled value).
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

  return (
    <div className="space-y-6">
      {profileResult.isLoading ? (
        <LoadingState label="Loading buyer profile…" />
      ) : profileResult.isError ? (
        <ErrorState
          message={getErrorMessage(profileResult.error)}
          onRetry={profileResult.refetch}
        />
      ) : profileResult.profile ? (
        <ProfileHeader profile={profileResult.profile} roleLabel="Buyer" />
      ) : (
        <Card>
          <div className="space-y-2">
            <h1 className="text-2xl font-semibold">Unregistered buyer</h1>
            <div className="flex items-center gap-2 text-sm text-muted">
              <span>No BuyerRegistry profile for</span>
              <AddressBadge address={account} />
            </div>
          </div>
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
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
      </div>

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
    </div>
  );
}
