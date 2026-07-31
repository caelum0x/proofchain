"use client";

import { useState } from "react";
import { useStakingRewards } from "@/hooks/useRewards";
import { useErc20 } from "@/hooks/useErc20";
import { useTx } from "@/hooks/useTx";
import { parseTokenInput } from "@/lib/amount";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

const erc20Approve = [
  {
    type: "function",
    name: "approve",
    stateMutability: "nonpayable",
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
] as const;

/**
 * Stake / withdraw / claim panel for StakingRewards. Staking pulls the staking
 * token, so it requires an ERC20 approval to the rewards contract first; the UI
 * shows whichever step is next and surfaces accrued rewards live.
 */
export function StakingPanel() {
  const rewards = useStakingRewards();
  const erc20 = useErc20(rewards.stakingToken, rewards.contract?.address);
  const [stakeInput, setStakeInput] = useState("");
  const [withdrawInput, setWithdrawInput] = useState("");
  const [error, setError] = useState<string | null>(null);

  const approveTx = useTx({ successLabel: "Token approved", onConfirmed: () => erc20.refetch() });
  const stakeTx = useTx({ successLabel: "Staked", onConfirmed: () => { rewards.refetch(); erc20.refetch(); } });
  const withdrawTx = useTx({ successLabel: "Withdrawn", onConfirmed: () => { rewards.refetch(); erc20.refetch(); } });
  const claimTx = useTx({ successLabel: "Reward claimed", onConfirmed: () => rewards.refetch() });
  const exitTx = useTx({ successLabel: "Exited", onConfirmed: () => { rewards.refetch(); erc20.refetch(); } });

  if (!rewards.deployed || !rewards.contract) {
    return (
      <Card>
        <CardHeader title="Staking" />
        <p className="text-sm text-muted">StakingRewards is not deployed on this network.</p>
      </Card>
    );
  }

  const stakeParsed = parseTokenInput(stakeInput || "", erc20.decimals);
  const withdrawParsed = parseTokenInput(withdrawInput || "", erc20.decimals);
  const needsApproval = stakeParsed.value !== null && erc20.allowance < stakeParsed.value;
  const contract = rewards.contract;

  const onApprove = async () => {
    setError(null);
    if (!rewards.stakingToken || stakeParsed.value === null) return setError(stakeParsed.error ?? "Invalid amount");
    try {
      await approveTx.submit({
        address: rewards.stakingToken,
        abi: erc20Approve,
        functionName: "approve",
        args: [contract.address, stakeParsed.value],
      });
    } catch (e) {
      approveTx.reset();
      setError(getErrorMessage(e));
    }
  };

  const onStake = async () => {
    setError(null);
    if (stakeParsed.value === null) return setError(stakeParsed.error ?? "Invalid amount");
    if (erc20.balance < stakeParsed.value) return setError("Insufficient balance.");
    try {
      await stakeTx.submit({ address: contract.address, abi: contract.abi, functionName: "stake", args: [stakeParsed.value] });
    } catch (e) {
      stakeTx.reset();
      setError(getErrorMessage(e));
    }
  };

  const onWithdraw = async () => {
    setError(null);
    if (withdrawParsed.value === null) return setError(withdrawParsed.error ?? "Invalid amount");
    if (rewards.staked < withdrawParsed.value) return setError("Amount exceeds your staked balance.");
    try {
      await withdrawTx.submit({ address: contract.address, abi: contract.abi, functionName: "withdraw", args: [withdrawParsed.value] });
    } catch (e) {
      withdrawTx.reset();
      setError(getErrorMessage(e));
    }
  };

  const runSimple = async (tx: ReturnType<typeof useTx>, functionName: string) => {
    setError(null);
    try {
      await tx.submit({ address: contract.address, abi: contract.abi, functionName, args: [] });
    } catch (e) {
      tx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader title="Staking" description="Stake to earn PROOF emissions." />
      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Your stake" value={`${formatTokenAmount(rewards.staked, erc20.decimals)} ${erc20.symbol}`} />
        <Stat label="Earned" value={formatTokenAmount(rewards.earned, 18)} />
        <Stat label="Total staked" value={`${formatTokenAmount(rewards.totalStaked, erc20.decimals)} ${erc20.symbol}`} />
        <Stat label="Wallet balance" value={`${formatTokenAmount(erc20.balance, erc20.decimals)} ${erc20.symbol}`} />
      </dl>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <Field label={`Stake (${erc20.symbol})`} htmlFor="stake-amt">
            <Input id="stake-amt" inputMode="decimal" placeholder="100" value={stakeInput} onChange={(e) => setStakeInput(e.target.value)} />
          </Field>
          <div className="flex flex-wrap gap-2">
            {needsApproval ? (
              <Button onClick={onApprove} loading={approveTx.isBusy}>
                Approve
              </Button>
            ) : null}
            <Button onClick={onStake} loading={stakeTx.isBusy} disabled={needsApproval || stakeParsed.value === null}>
              Stake
            </Button>
          </div>
        </div>
        <div>
          <Field label={`Withdraw (${erc20.symbol})`} htmlFor="withdraw-amt">
            <Input id="withdraw-amt" inputMode="decimal" placeholder="50" value={withdrawInput} onChange={(e) => setWithdrawInput(e.target.value)} />
          </Field>
          <Button variant="secondary" onClick={onWithdraw} loading={withdrawTx.isBusy} disabled={withdrawParsed.value === null}>
            Withdraw
          </Button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={() => runSimple(claimTx, "getReward")} loading={claimTx.isBusy} disabled={rewards.earned === 0n}>
          Claim reward
        </Button>
        <Button variant="danger" onClick={() => runSimple(exitTx, "exit")} loading={exitTx.isBusy} disabled={rewards.staked === 0n}>
          Exit (withdraw + claim)
        </Button>
      </div>

      {error ? <p className="field-error mt-3">{error}</p> : null}
      {[approveTx.hash, stakeTx.hash, withdrawTx.hash, claimTx.hash, exitTx.hash].filter(Boolean).map((hash) => (
        <p key={hash} className="mt-1 text-xs text-muted">
          Tx: <TxLink hash={hash as string} />
        </p>
      ))}
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-fg">{value}</dd>
    </div>
  );
}
