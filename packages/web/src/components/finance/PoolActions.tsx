"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";
import { useTx } from "@/hooks/useTx";
import { contractRef } from "@/lib/contracts";
import { mockUsdcAbi } from "@/lib/abis";
import { parseTokenInput } from "@/lib/amount";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import type { PoolView } from "@/hooks/usePool";

interface PoolActionsProps {
  readonly pool: PoolView;
}

/**
 * Deposit into / withdraw from the FinancingPool. Deposits pull the asset
 * (approve → deposit); withdrawals redeem vault shares, which requires approving
 * the pool to spend the lender's shares first (approve shares → withdraw).
 */
export function PoolActions({ pool }: PoolActionsProps) {
  return (
    <div className="grid gap-4 md:grid-cols-2">
      <DepositForm pool={pool} />
      <WithdrawForm pool={pool} />
    </div>
  );
}

function DepositForm({ pool }: PoolActionsProps) {
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const approveTx = useTx({ successLabel: "Approval confirmed", onConfirmed: () => pool.refetch() });
  const depositTx = useTx({ successLabel: "Deposit confirmed", onConfirmed: () => pool.refetch() });

  const parsed = parseTokenInput(amount || "", pool.assetDecimals);
  const value = parsed.value;
  const needsApproval = value !== null && pool.assetAllowance < value;
  const insufficient = value !== null && pool.userAssetBalance < value;
  const busy = approveTx.isBusy || depositTx.isBusy;
  const disabled = !pool.poolAddress || !pool.assetAddress;

  const onApprove = async () => {
    setFormError(null);
    if (value === null || !pool.assetAddress || !pool.poolAddress) return;
    try {
      await approveTx.submit({
        address: pool.assetAddress,
        abi: mockUsdcAbi,
        functionName: "approve",
        args: [pool.poolAddress, value],
      });
    } catch (error) {
      approveTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  const onDeposit = async () => {
    setFormError(null);
    if (value === null) {
      setFormError(parsed.error ?? "Invalid amount");
      return;
    }
    if (insufficient) {
      setFormError(`Insufficient ${pool.assetSymbol} balance.`);
      return;
    }
    try {
      await depositTx.submit({ ...contractRef("FinancingPool"), functionName: "deposit", args: [value] });
      setAmount("");
    } catch (error) {
      depositTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Deposit"
        description="Supply capital, receive vault shares that accrue financing yield."
        action={
          <span className="text-xs text-muted">
            Balance: {formatTokenAmount(pool.userAssetBalance, pool.assetDecimals)} {pool.assetSymbol}
          </span>
        }
      />
      <Field label={`Amount (${pool.assetSymbol})`} htmlFor="pool-deposit" error={amount ? parsed.error ?? undefined : undefined}>
        <Input
          id="pool-deposit"
          inputMode="decimal"
          placeholder="1000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      {insufficient ? <p className="field-error mb-3">Insufficient balance.</p> : null}
      {formError ? <p className="field-error mb-3">{formError}</p> : null}
      <div className="flex gap-2">
        <Button
          onClick={onApprove}
          loading={approveTx.isBusy}
          disabled={busy || disabled || !needsApproval || value === null}
          variant={needsApproval ? "primary" : "secondary"}
        >
          {needsApproval ? "Approve" : "Approved"}
        </Button>
        <Button onClick={onDeposit} loading={depositTx.isBusy} disabled={busy || disabled || needsApproval || value === null}>
          Deposit
        </Button>
      </div>
      {depositTx.hash ? <p className="mt-3 text-xs text-muted">Deposit: <TxLink hash={depositTx.hash} /></p> : null}
    </Card>
  );
}

function WithdrawForm({ pool }: PoolActionsProps) {
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const approveTx = useTx({ successLabel: "Share approval confirmed", onConfirmed: () => pool.refetch() });
  const withdrawTx = useTx({ successLabel: "Withdrawal confirmed", onConfirmed: () => pool.refetch() });

  const parsed = parseTokenInput(amount || "", pool.shareDecimals);
  const value = parsed.value;
  const needsApproval = value !== null && pool.shareAllowance < value;
  const insufficient = value !== null && pool.userShares < value;
  const busy = approveTx.isBusy || withdrawTx.isBusy;
  const disabled = !pool.poolAddress || !pool.vaultAddress;

  const onApprove = async () => {
    setFormError(null);
    if (value === null || !pool.vaultAddress || !pool.poolAddress) return;
    try {
      await approveTx.submit({
        address: pool.vaultAddress,
        abi: mockUsdcAbi,
        functionName: "approve",
        args: [pool.poolAddress, value],
      });
    } catch (error) {
      approveTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  const onWithdraw = async () => {
    setFormError(null);
    if (value === null) {
      setFormError(parsed.error ?? "Invalid amount");
      return;
    }
    if (insufficient) {
      setFormError("You do not hold that many shares.");
      return;
    }
    try {
      await withdrawTx.submit({ ...contractRef("FinancingPool"), functionName: "withdraw", args: [value] });
      setAmount("");
    } catch (error) {
      withdrawTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Withdraw"
        description="Redeem vault shares for underlying capital plus accrued yield."
        action={
          <span className="text-xs text-muted">
            Shares: {formatTokenAmount(pool.userShares, pool.shareDecimals)} {pool.shareSymbol}
          </span>
        }
      />
      <Field label={`Shares (${pool.shareSymbol})`} htmlFor="pool-withdraw" error={amount ? parsed.error ?? undefined : undefined}>
        <Input
          id="pool-withdraw"
          inputMode="decimal"
          placeholder="500"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      {insufficient ? <p className="field-error mb-3">Insufficient shares.</p> : null}
      {formError ? <p className="field-error mb-3">{formError}</p> : null}
      <div className="flex gap-2">
        <Button
          onClick={onApprove}
          loading={approveTx.isBusy}
          disabled={busy || disabled || !needsApproval || value === null}
          variant={needsApproval ? "primary" : "secondary"}
        >
          {needsApproval ? "Approve shares" : "Approved"}
        </Button>
        <Button
          variant="secondary"
          onClick={onWithdraw}
          loading={withdrawTx.isBusy}
          disabled={busy || disabled || needsApproval || value === null}
        >
          Withdraw
        </Button>
      </div>
      {withdrawTx.hash ? <p className="mt-3 text-xs text-muted">Withdraw: <TxLink hash={withdrawTx.hash} /></p> : null}
    </Card>
  );
}
