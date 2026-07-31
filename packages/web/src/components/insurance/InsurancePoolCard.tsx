"use client";

import { useState } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/StatCard";
import { TxLink } from "@/components/ui/TxLink";
import { useTx } from "@/hooks/useTx";
import { useUsdc } from "@/hooks/useUsdc";
import type { InsurancePoolView } from "@/hooks/useInsurancePool";
import { contractRef, usdcContract } from "@/lib/contracts";
import { parseTokenInput } from "@/lib/amount";
import { formatBps, formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

/**
 * Underwriting capital panel: pool KPIs plus deposit/withdraw of stablecoin
 * capital (providers earn premiums, absorb claim losses).
 */
export function InsurancePoolCard({ pool }: { pool: InsurancePoolView }) {
  return (
    <div className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total capital" value={<Amount v={pool.totalCapital} />} loading={pool.isLoading} />
        <StatCard label="Available" value={<Amount v={pool.availableCapital} />} loading={pool.isLoading} />
        <StatCard
          label="Reserved"
          value={<Amount v={pool.reservedCapital} />}
          hint={`${formatBps(pool.reservedRatioBps)} of capital`}
          hintTone={pool.reservedRatioBps > 8000 ? "warn" : "neutral"}
          loading={pool.isLoading}
        />
      </div>
      <CapitalForm pool={pool} />
    </div>
  );
}

function Amount({ v }: { v: bigint }) {
  const usdc = useUsdc();
  return (
    <>
      {formatTokenAmount(v, usdc.decimals)} {usdc.symbol}
    </>
  );
}

function CapitalForm({ pool }: { pool: InsurancePoolView }) {
  const usdc = useUsdc(pool.poolAddress);
  const [amount, setAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const approveTx = useTx({ successLabel: "Approval confirmed", onConfirmed: () => usdc.refetch() });
  const depositTx = useTx({ successLabel: "Capital deposited", onConfirmed: () => { pool.refetch(); usdc.refetch(); } });
  const withdrawTx = useTx({ successLabel: "Capital withdrawn", onConfirmed: () => { pool.refetch(); usdc.refetch(); } });

  const parsed = parseTokenInput(amount || "", usdc.decimals);
  const value = parsed.value;
  const needsApproval = value !== null && usdc.allowance < value;
  const busy = approveTx.isBusy || depositTx.isBusy || withdrawTx.isBusy;
  const token = pool.tokenAddress;

  const onApprove = async () => {
    setFormError(null);
    if (value === null || !pool.poolAddress) return;
    try {
      await approveTx.submit({ ...usdcContract(), functionName: "approve", args: [pool.poolAddress, value] });
    } catch (error) {
      approveTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  const onDeposit = async () => {
    setFormError(null);
    if (value === null || !token) {
      setFormError(parsed.error ?? "Invalid amount");
      return;
    }
    if (usdc.balance < value) {
      setFormError(`Insufficient ${usdc.symbol} balance.`);
      return;
    }
    try {
      await depositTx.submit({ ...contractRef("InsurancePool"), functionName: "deposit", args: [token, value] });
      setAmount("");
    } catch (error) {
      depositTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  const onWithdraw = async () => {
    setFormError(null);
    if (value === null || !token) {
      setFormError(parsed.error ?? "Invalid amount");
      return;
    }
    if (pool.userDeposit < value) {
      setFormError("Amount exceeds your supplied capital.");
      return;
    }
    try {
      await withdrawTx.submit({ ...contractRef("InsurancePool"), functionName: "withdraw", args: [token, value] });
      setAmount("");
    } catch (error) {
      withdrawTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Provide capital"
        description="Back shipment/credit cover and earn premiums."
        action={
          <span className="text-xs text-muted">
            Your capital: {formatTokenAmount(pool.userDeposit, usdc.decimals)} {usdc.symbol}
          </span>
        }
      />
      <Field label={`Amount (${usdc.symbol})`} htmlFor="ins-capital" error={amount ? parsed.error ?? undefined : undefined}>
        <Input
          id="ins-capital"
          inputMode="decimal"
          placeholder="5000"
          value={amount}
          onChange={(e) => setAmount(e.target.value)}
        />
      </Field>
      {formError ? <p className="field-error mb-3">{formError}</p> : null}
      <div className="flex flex-wrap gap-2">
        {needsApproval ? (
          <Button onClick={onApprove} loading={approveTx.isBusy} disabled={busy || value === null}>
            Approve {usdc.symbol}
          </Button>
        ) : (
          <Button onClick={onDeposit} loading={depositTx.isBusy} disabled={busy || value === null}>
            Deposit
          </Button>
        )}
        <Button variant="secondary" onClick={onWithdraw} loading={withdrawTx.isBusy} disabled={busy || value === null}>
          Withdraw
        </Button>
      </div>
      {depositTx.hash ? <p className="mt-3 text-xs text-muted">Deposit: <TxLink hash={depositTx.hash} /></p> : null}
      {withdrawTx.hash ? <p className="mt-1 text-xs text-muted">Withdraw: <TxLink hash={withdrawTx.hash} /></p> : null}
    </Card>
  );
}
