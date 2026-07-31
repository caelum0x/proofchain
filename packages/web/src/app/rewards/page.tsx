"use client";

import { useLoyalty, useEmissions } from "@/hooks/useRewards";
import { StakingPanel } from "@/components/rewards/StakingPanel";
import { MerkleClaimForm } from "@/components/rewards/MerkleClaimForm";
import { RequireWallet } from "@/components/RequireWallet";
import { StatCard } from "@/components/ui/StatCard";
import { formatTokenAmount } from "@/lib/format";

export default function RewardsPage() {
  const loyalty = useLoyalty();
  const emissions = useEmissions();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Rewards</h1>
        <p className="mt-1 text-sm text-muted">
          Loyalty points for on-time clean deliveries, PROOF staking emissions, and merkle-distributed
          rewards.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Your loyalty points"
          value={loyalty.deployed ? formatTokenAmount(loyalty.balance, 18) : "—"}
          hint={loyalty.transferable ? "Transferable" : "Non-transferable"}
          loading={loyalty.isLoading}
        />
        <StatCard
          label="Points in circulation"
          value={loyalty.deployed ? formatTokenAmount(loyalty.totalSupply, 18) : "—"}
        />
        <StatCard
          label="Emission rate"
          value={emissions.deployed ? `${formatTokenAmount(emissions.rate, 18)}/s` : "—"}
        />
        <StatCard label="Current epoch" value={emissions.deployed ? emissions.epoch.toString() : "—"} />
      </div>

      <RequireWallet>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <StakingPanel />
          </div>
          <div>
            <MerkleClaimForm />
          </div>
        </div>
      </RequireWallet>
    </div>
  );
}
