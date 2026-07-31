"use client";

import { useStakingRewards, useEmissions } from "@/hooks/useRewards";
import { useErc20 } from "@/hooks/useErc20";
import { PageHeader, KpiRow } from "@/components/page";
import { StakingPanel } from "@/components/rewards/StakingPanel";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { Meter } from "@/components/ui/Meter";
import { formatTokenAmount } from "@/lib/format";

/**
 * PROOF staking: stake the emissions token to earn protocol rewards. Pool-wide
 * figures headline; the interactive stake/withdraw/claim panel is wallet-gated.
 */
export default function StakingPage() {
  const rewards = useStakingRewards();
  const emissions = useEmissions();
  const erc20 = useErc20(rewards.stakingToken, rewards.contract?.address);

  const yourShare =
    rewards.totalStaked > 0n ? Number((rewards.staked * 10000n) / rewards.totalStaked) / 100 : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        icon="staking"
        title="Staking"
        subtitle="Stake PROOF to earn emissions distributed by the rewards controller."
        breadcrumbs={[{ label: "Rewards" }, { label: "Staking" }]}
      />

      <KpiRow
        items={[
          {
            label: "Total staked",
            value: rewards.deployed
              ? `${formatTokenAmount(rewards.totalStaked, erc20.decimals)} ${erc20.symbol}`
              : "—",
            loading: rewards.isLoading,
          },
          {
            label: "Your stake",
            value: rewards.deployed ? formatTokenAmount(rewards.staked, erc20.decimals) : "—",
            hint: rewards.totalStaked > 0n ? `${yourShare.toFixed(2)}% of pool` : undefined,
            loading: rewards.isLoading,
          },
          {
            label: "Reward rate",
            value: rewards.deployed ? `${formatTokenAmount(rewards.rewardRate, 18)}/s` : "—",
          },
          {
            label: "Current epoch",
            value: emissions.deployed ? emissions.epoch.toString() : "—",
            hint: emissions.deployed ? `${formatTokenAmount(emissions.rate, 18)}/s emitted` : undefined,
          },
        ]}
      />

      {!rewards.deployed ? (
        <Callout tone="warn" title="StakingRewards not deployed">
          The StakingRewards contract is not configured on this network.
        </Callout>
      ) : (
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <RequireWallet>
              <StakingPanel />
            </RequireWallet>
          </div>
          <Card>
            <CardHeader title="Pool utilisation" description="Your share of the staking pool." />
            <div className="space-y-4">
              <Meter value={yourShare} max={100} label="Your share" />
              <p className="text-sm text-muted">
                Rewards accrue every block proportional to your share of the total staked supply.
                Claim any time, or exit to withdraw your full stake plus accrued rewards.
              </p>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
