"use client";

import Link from "next/link";
import { useLoyalty, useEmissions, useStakingRewards } from "@/hooks/useRewards";
import { PageHeader, KpiRow } from "@/components/page";
import { StakingPanel } from "@/components/rewards/StakingPanel";
import { MerkleClaimForm } from "@/components/rewards/MerkleClaimForm";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { formatTokenAmount } from "@/lib/format";

/**
 * Rewards overview (WD §3): loyalty points, PROOF staking emissions, and
 * merkle-distributed rewards, with headline figures and the interactive panels.
 */
export default function RewardsPage() {
  const loyalty = useLoyalty();
  const emissions = useEmissions();
  const staking = useStakingRewards();

  return (
    <div className="space-y-6">
      <PageHeader
        icon="rewards"
        title="Rewards"
        subtitle="Loyalty points for clean deliveries, PROOF staking emissions, and merkle-distributed rewards."
        breadcrumbs={[{ label: "Rewards" }, { label: "Overview" }]}
        actions={
          <div className="flex gap-2">
            <Link href="/staking">
              <Button variant="secondary" size="sm">
                Staking
              </Button>
            </Link>
            <Link href="/loyalty">
              <Button variant="secondary" size="sm">
                Loyalty
              </Button>
            </Link>
          </div>
        }
      />

      <KpiRow
        items={[
          {
            label: "Your loyalty points",
            value: loyalty.deployed ? formatTokenAmount(loyalty.balance, 18) : "—",
            hint: loyalty.transferable ? "Transferable" : "Non-transferable",
            loading: loyalty.isLoading,
          },
          {
            label: "Your stake",
            value: staking.deployed ? formatTokenAmount(staking.staked, 18) : "—",
            loading: staking.isLoading,
          },
          {
            label: "Emission rate",
            value: emissions.deployed ? `${formatTokenAmount(emissions.rate, 18)}/s` : "—",
          },
          {
            label: "Current epoch",
            value: emissions.deployed ? emissions.epoch.toString() : "—",
          },
        ]}
      />

      <RequireWallet>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <StakingPanel />
          </div>
          <div className="space-y-6">
            <MerkleClaimForm />
            <Card>
              <CardHeader
                title="Loyalty points"
                description="Earned automatically for on-time, dispute-free deliveries."
              />
              <p className="mb-3 text-sm text-muted">
                Balance: {loyalty.deployed ? formatTokenAmount(loyalty.balance, 18) : "—"}
              </p>
              <Link href="/loyalty">
                <Button variant="secondary" size="sm">
                  View loyalty
                </Button>
              </Link>
            </Card>
          </div>
        </div>
      </RequireWallet>
    </div>
  );
}
