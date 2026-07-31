"use client";

import { useState } from "react";
import type { Address } from "viem";
import { useArbiterStatus } from "@/hooks/useDisputes";
import { useErc20 } from "@/hooks/useErc20";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { mockUsdcAbi } from "@/lib/abis";
import { parseTokenInput } from "@/lib/amount";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { TxLink } from "@/components/ui/TxLink";

/**
 * Arbiter staking control panel. Arbiter custody is two-tier: generic stake is
 * held in the StakeManager, then committed (locked) into ArbiterStaking to gain
 * voting rights. This panel drives the full deposit → commit → un-commit flow
 * with a real ERC20 approval step, mirroring the on-chain contracts exactly.
 */
export function ArbiterPanel() {
  const status = useArbiterStatus();
  const stakeManager = tryContractRef("StakeManager");
  const arbStaking = tryContractRef("ArbiterStaking");
  const govToken = tryContractRef("GovernanceToken");

  // Use the token the account already staked, else default to PROOF (GovernanceToken).
  const token: Address | undefined =
    status.stakeToken && status.stakeToken !== "0x0000000000000000000000000000000000000000"
      ? status.stakeToken
      : govToken?.address;

  const erc20 = useErc20(token, stakeManager?.address);
  const [depositInput, setDepositInput] = useState("");
  const [commitInput, setCommitInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const approveTx = useTx({ successLabel: "Approval confirmed", onConfirmed: () => erc20.refetch() });
  const depositTx = useTx({
    successLabel: "Stake deposited",
    onConfirmed: () => {
      erc20.refetch();
      status.refetch();
    },
  });
  const commitTx = useTx({ successLabel: "Committed as arbiter", onConfirmed: () => status.refetch() });
  const uncommitTx = useTx({ successLabel: "Stake released", onConfirmed: () => status.refetch() });

  const depositParsed = parseTokenInput(depositInput || "", erc20.decimals);
  const commitParsed = parseTokenInput(commitInput || "", erc20.decimals);
  const needsApproval =
    depositParsed.value !== null && erc20.allowance < depositParsed.value;

  if (!arbStaking || !stakeManager) {
    return (
      <Card>
        <CardHeader title="Become an arbiter" />
        <p className="text-sm text-muted">
          Arbiter staking is not available — the staking contracts are not deployed on this network.
        </p>
      </Card>
    );
  }

  const onApprove = async () => {
    setFormError(null);
    if (!token) return setFormError("No staking token configured.");
    if (depositParsed.value === null) return setFormError(depositParsed.error ?? "Invalid amount");
    try {
      await approveTx.submit({
        address: token,
        abi: mockUsdcAbi,
        functionName: "approve",
        args: [stakeManager.address, depositParsed.value],
      });
    } catch (e) {
      approveTx.reset();
      setFormError(getErrorMessage(e));
    }
  };

  const onDeposit = async () => {
    setFormError(null);
    if (!token) return setFormError("No staking token configured.");
    if (depositParsed.value === null) return setFormError(depositParsed.error ?? "Invalid amount");
    if (erc20.balance < depositParsed.value) return setFormError("Insufficient token balance.");
    try {
      await depositTx.submit({
        address: stakeManager.address,
        abi: stakeManager.abi,
        functionName: "stake",
        args: [token, depositParsed.value],
      });
    } catch (e) {
      depositTx.reset();
      setFormError(getErrorMessage(e));
    }
  };

  const onCommit = async () => {
    setFormError(null);
    if (commitParsed.value === null) return setFormError(commitParsed.error ?? "Invalid amount");
    if (status.managerUnlocked < commitParsed.value) {
      return setFormError("Amount exceeds your unlocked StakeManager balance.");
    }
    try {
      await commitTx.submit({
        address: arbStaking.address,
        abi: arbStaking.abi,
        functionName: "stakeArbiter",
        args: [commitParsed.value],
      });
    } catch (e) {
      commitTx.reset();
      setFormError(getErrorMessage(e));
    }
  };

  const onUncommit = async () => {
    setFormError(null);
    if (status.committedStake === 0n) return setFormError("Nothing committed to release.");
    if (status.pendingVotes > 0) return setFormError("Stake is locked while you have unresolved votes.");
    try {
      await uncommitTx.submit({
        address: arbStaking.address,
        abi: arbStaking.abi,
        functionName: "unstakeArbiter",
        args: [status.committedStake],
      });
    } catch (e) {
      uncommitTx.reset();
      setFormError(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Arbiter staking"
        description="Deposit generic stake, then commit it to gain the right to vote on disputes."
        action={
          status.isArbiter ? <Badge tone="success">Active arbiter</Badge> : <Badge tone="neutral">Not an arbiter</Badge>
        }
      />

      <dl className="mb-4 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Committed stake" value={`${formatTokenAmount(status.committedStake, erc20.decimals)} ${erc20.symbol}`} />
        <Stat label="Min required" value={`${formatTokenAmount(status.minStake, erc20.decimals)} ${erc20.symbol}`} />
        <Stat label="Unlocked (StakeManager)" value={`${formatTokenAmount(status.managerUnlocked, erc20.decimals)} ${erc20.symbol}`} />
        <Stat label="Pending votes" value={String(status.pendingVotes)} />
      </dl>

      {token ? (
        <p className="mb-3 text-xs text-muted">
          Staking token: <AddressBadge address={token} /> · Wallet balance{" "}
          {formatTokenAmount(erc20.balance, erc20.decimals)} {erc20.symbol}
        </p>
      ) : null}

      <div className="space-y-4">
        <div>
          <Field label={`Deposit stake (${erc20.symbol})`} htmlFor="arb-deposit">
            <Input
              id="arb-deposit"
              inputMode="decimal"
              placeholder="100"
              value={depositInput}
              onChange={(e) => setDepositInput(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={needsApproval ? "primary" : "secondary"}
              onClick={onApprove}
              loading={approveTx.isBusy}
              disabled={!needsApproval || depositParsed.value === null}
            >
              {needsApproval ? "Approve" : "Approved"}
            </Button>
            <Button onClick={onDeposit} loading={depositTx.isBusy} disabled={needsApproval || depositParsed.value === null}>
              Deposit to StakeManager
            </Button>
          </div>
        </div>

        <div>
          <Field label={`Commit as arbiter (${erc20.symbol})`} htmlFor="arb-commit">
            <Input
              id="arb-commit"
              inputMode="decimal"
              placeholder="50"
              value={commitInput}
              onChange={(e) => setCommitInput(e.target.value)}
            />
          </Field>
          <div className="flex flex-wrap gap-2">
            <Button onClick={onCommit} loading={commitTx.isBusy} disabled={commitParsed.value === null}>
              Commit stake
            </Button>
            <Button
              variant="danger"
              onClick={onUncommit}
              loading={uncommitTx.isBusy}
              disabled={status.committedStake === 0n || status.pendingVotes > 0}
            >
              Release all
            </Button>
          </div>
        </div>
      </div>

      {formError ? <p className="field-error mt-3">{formError}</p> : null}
      <TxHashes txs={[approveTx.hash, depositTx.hash, commitTx.hash, uncommitTx.hash]} />
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

function TxHashes({ txs }: { txs: (string | undefined)[] }) {
  const shown = txs.filter(Boolean) as string[];
  if (shown.length === 0) return null;
  return (
    <div className="mt-3 space-y-1">
      {shown.map((hash) => (
        <p key={hash} className="text-xs text-muted">
          Tx: <TxLink hash={hash} />
        </p>
      ))}
    </div>
  );
}
