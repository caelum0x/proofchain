"use client";

import { useState } from "react";
import type { Address } from "viem";
import { Button, Card, CardHeader, Field, Input, TxButton } from "@/components/ui";
import { FormLayout } from "@/components/ui/Form";
import { useUsdc } from "@/hooks/useUsdc";
import { contractRef, usdcContract } from "@/lib/contracts";
import { getResolvedAddress } from "@/lib/shared";
import { parseTokenInput } from "@/lib/amount";
import { formatTokenAmount } from "@/lib/format";

type Mode = "deposit" | "withdraw";

export interface PoolCapitalFormProps {
  readonly userDeposit: bigint;
  readonly onChanged?: () => void;
}

/**
 * Supply or withdraw underwriting capital to the InsurancePool. Deposits require
 * a one-time token approval to the pool; both actions run through `TxButton`.
 * The connected provider's current deposit gates the max withdrawal.
 */
export function PoolCapitalForm({ userDeposit, onChanged }: PoolCapitalFormProps) {
  const poolAddress = getResolvedAddress("InsurancePool");
  const token = getResolvedAddress("MockUSDC");
  const usdc = useUsdc(poolAddress);
  const [mode, setMode] = useState<Mode>("deposit");
  const [amount, setAmount] = useState("");

  const parsed = parseTokenInput(amount || "", usdc.decimals);
  const value = parsed.value;
  const needsApproval = mode === "deposit" && value !== null && usdc.allowance < value;

  const amountError =
    amount && parsed.error
      ? parsed.error
      : mode === "deposit" && value !== null && usdc.balance < value
        ? `Insufficient ${usdc.symbol} balance`
        : mode === "withdraw" && value !== null && value > userDeposit
          ? "Amount exceeds your deposit"
          : undefined;

  const canSubmit = value !== null && !amountError && Boolean(token && poolAddress);

  const buildApprove = () => {
    if (value === null || !poolAddress) return null;
    return { ...usdcContract(), functionName: "approve", args: [poolAddress as Address, value] } as const;
  };
  const buildDeposit = () => {
    if (value === null || !token) return null;
    return { ...contractRef("InsurancePool"), functionName: "deposit", args: [token as Address, value] } as const;
  };
  const buildWithdraw = () => {
    if (value === null || !token) return null;
    return { ...contractRef("InsurancePool"), functionName: "withdraw", args: [token as Address, value] } as const;
  };

  return (
    <Card>
      <CardHeader title="Pool capital" description="Underwrite cover by supplying capital, or withdraw it." />
      <div className="mb-4 inline-flex overflow-hidden rounded-lg border border-border" role="tablist" aria-label="Action">
        {(["deposit", "withdraw"] as const).map((m) => (
          <button
            key={m}
            type="button"
            role="tab"
            aria-selected={mode === m}
            onClick={() => setMode(m)}
            className={mode === m ? "bg-surface-2 px-4 py-1.5 text-sm font-medium text-fg" : "px-4 py-1.5 text-sm text-muted hover:text-fg"}
          >
            {m === "deposit" ? "Deposit" : "Withdraw"}
          </button>
        ))}
      </div>

      <FormLayout onSubmit={(e) => e.preventDefault()}>
        <Field
          label={`Amount (${usdc.symbol})`}
          htmlFor="pool-amount"
          error={amountError}
          hint={
            mode === "withdraw"
              ? `Your deposit: ${formatTokenAmount(userDeposit, usdc.decimals)} ${usdc.symbol}`
              : `Balance: ${formatTokenAmount(usdc.balance, usdc.decimals)} ${usdc.symbol}`
          }
        >
          <Input
            id="pool-amount"
            inputMode="decimal"
            placeholder="10000"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
          />
        </Field>

        <div className="flex items-center gap-2">
          {mode === "deposit" && needsApproval ? (
            <TxButton write={buildApprove} successLabel="Capital approved" pendingLabel="Approving…" onConfirmed={usdc.refetch} disabled={!canSubmit}>
              Approve {usdc.symbol}
            </TxButton>
          ) : mode === "deposit" ? (
            <TxButton
              write={buildDeposit}
              successLabel="Capital deposited"
              pendingLabel="Depositing…"
              onConfirmed={() => {
                setAmount("");
                usdc.refetch();
                onChanged?.();
              }}
              disabled={!canSubmit}
            >
              Deposit
            </TxButton>
          ) : (
            <TxButton
              write={buildWithdraw}
              successLabel="Capital withdrawn"
              pendingLabel="Withdrawing…"
              onConfirmed={() => {
                setAmount("");
                usdc.refetch();
                onChanged?.();
              }}
              disabled={!canSubmit}
            >
              Withdraw
            </TxButton>
          )}
          {amount ? (
            <Button variant="ghost" size="sm" onClick={() => setAmount("")}>
              Clear
            </Button>
          ) : null}
        </div>
      </FormLayout>
    </Card>
  );
}
