"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Address } from "viem";
import { isAddress } from "viem";
import { useErc20 } from "@/hooks/useErc20";
import { useBondAccount } from "@/hooks/useBond";
import { tryContractRef } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { parseTokenInput } from "@/lib/amount";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Callout } from "@/components/ui/Callout";
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

const isAddr = (v: string): boolean => isAddress(v);

const schema = z.object({
  token: z.string().refine(isAddr, "Enter a valid ERC-20 token address"),
  amount: z.string().min(1, "Amount is required"),
});
type FormValues = z.infer<typeof schema>;

interface BondDepositFormProps {
  readonly defaultToken?: Address;
  readonly onDone?: () => void;
}

/**
 * Deposit or withdraw a supplier performance bond. Deposits pull the chosen
 * ERC-20, so the form drives approve → deposit; withdrawals only touch the
 * unlocked (non-committed) portion of the bond.
 */
export function BondDepositForm({ defaultToken, onDone }: BondDepositFormProps) {
  const bond = useBondAccount();
  const bondRef = tryContractRef("SupplierBond");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { token: defaultToken ?? bond.token ?? "", amount: "" },
  });

  const tokenValue = watch("token");
  const spender = bond.contractAddress;
  const erc20 = useErc20(isAddress(tokenValue) ? (tokenValue as Address) : undefined, spender);

  const approveTx = useTx({ successLabel: "Token approved", onConfirmed: () => erc20.refetch() });
  const depositTx = useTx({
    successLabel: "Bond deposited",
    onConfirmed: () => {
      bond.refetch();
      erc20.refetch();
      onDone?.();
    },
  });
  const withdrawTx = useTx({
    successLabel: "Bond withdrawn",
    onConfirmed: () => {
      bond.refetch();
      onDone?.();
    },
  });

  const amountInput = watch("amount");
  const parsed = parseTokenInput(amountInput || "", erc20.decimals);
  const needsApproval = parsed.value !== null && erc20.allowance < parsed.value;

  if (!bond.deployed || !bond.contractAddress || !bondRef) {
    return (
      <Card>
        <CardHeader title="Manage bond" />
        <Callout tone="warn" title="SupplierBond not deployed">
          The SupplierBond contract is not configured on this network.
        </Callout>
      </Card>
    );
  }

  const contractAddress = bond.contractAddress;
  const bondAbi = bondRef.abi;

  const onApprove = handleSubmit(async (values) => {
    setFormError(null);
    if (parsed.value === null) return setFormError(parsed.error ?? "Invalid amount");
    try {
      await approveTx.submit({
        address: values.token as Address,
        abi: erc20Approve,
        functionName: "approve",
        args: [contractAddress, parsed.value],
      });
    } catch (error) {
      approveTx.reset();
      setFormError(getErrorMessage(error));
    }
  });

  const onDeposit = handleSubmit(async (values) => {
    setFormError(null);
    if (parsed.value === null) return setFormError(parsed.error ?? "Invalid amount");
    if (erc20.balance < parsed.value) return setFormError("Insufficient token balance.");
    try {
      await depositTx.submit({
        address: contractAddress,
        abi: bondAbi,
        functionName: "depositBond",
        args: [values.token as Address, parsed.value],
      });
    } catch (error) {
      depositTx.reset();
      setFormError(getErrorMessage(error));
    }
  });

  const onWithdraw = handleSubmit(async (values) => {
    setFormError(null);
    if (parsed.value === null) return setFormError(parsed.error ?? "Invalid amount");
    if (bond.unlocked < parsed.value) return setFormError("Amount exceeds your unlocked bond.");
    try {
      await withdrawTx.submit({
        address: contractAddress,
        abi: bondAbi,
        functionName: "withdrawBond",
        args: [values.token as Address, parsed.value],
      });
    } catch (error) {
      withdrawTx.reset();
      setFormError(getErrorMessage(error));
    }
  });

  return (
    <Card>
      <CardHeader title="Manage bond" description="Deposit collateral or withdraw the unlocked portion." />
      <form className="space-y-4" noValidate>
        <Field
          label="Bond token"
          htmlFor="bond-token"
          hint="ERC-20 used as bond collateral (e.g. USDC or PROOF)."
          error={errors.token?.message}
        >
          <Input id="bond-token" placeholder="0x…" {...register("token")} />
        </Field>
        <Field
          label={`Amount${erc20.symbol ? ` (${erc20.symbol})` : ""}`}
          htmlFor="bond-amount"
          hint={
            isAddress(tokenValue)
              ? `Wallet: ${formatTokenAmount(erc20.balance, erc20.decimals)} · Unlocked bond: ${formatTokenAmount(bond.unlocked, erc20.decimals)}`
              : "Enter the token first."
          }
          error={errors.amount?.message ?? formError ?? undefined}
        >
          <Input id="bond-amount" inputMode="decimal" placeholder="1000" {...register("amount")} />
        </Field>

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          {needsApproval ? (
            <Button type="button" onClick={onApprove} loading={approveTx.isBusy}>
              Approve
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={onDeposit}
            loading={depositTx.isBusy}
            disabled={needsApproval || parsed.value === null}
          >
            Deposit bond
          </Button>
          <Button
            type="button"
            variant="secondary"
            onClick={onWithdraw}
            loading={withdrawTx.isBusy}
            disabled={parsed.value === null || bond.unlocked === 0n}
          >
            Withdraw
          </Button>
        </div>

        {[approveTx.hash, depositTx.hash, withdrawTx.hash].filter(Boolean).map((hash) => (
          <p key={hash} className="text-xs text-muted">
            Tx: <TxLink hash={hash as string} />
          </p>
        ))}
      </form>
    </Card>
  );
}
