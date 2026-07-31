"use client";

import { useState } from "react";
import { getAddress, isAddress, type Address } from "viem";
import { useReadContract } from "wagmi";
import { useTx } from "@/hooks/useTx";
import { useErc20 } from "@/hooks/useErc20";
import { tryContractRef } from "@/lib/contracts";
import { contractAddresses } from "@/lib/shared";
import { parseTokenInput } from "@/lib/amount";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

/** Read a treasury token balance and withdraw funds (TREASURER_ROLE). */
export function TreasuryPanel() {
  const treasury = tryContractRef("Treasury");
  const [tokenInput, setTokenInput] = useState<string>(contractAddresses.mockUsdc ?? "");
  const [to, setTo] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const token = isAddress(tokenInput) ? (getAddress(tokenInput) as Address) : undefined;
  const erc20 = useErc20(token, undefined);

  const balanceQuery = useReadContract({
    address: treasury?.address,
    abi: treasury?.abi,
    functionName: "balanceOf",
    args: token ? [token] : undefined,
    query: { enabled: Boolean(treasury && token) },
  });

  const tx = useTx({ successLabel: "Withdrawal confirmed", onConfirmed: () => balanceQuery.refetch() });
  const balance = (balanceQuery.data as bigint | undefined) ?? 0n;

  const onWithdraw = async () => {
    setError(null);
    if (!treasury) return setError("Treasury is not deployed.");
    if (!token) return setError("Enter a valid token address.");
    if (!isAddress(to)) return setError("Enter a valid recipient address.");
    const parsed = parseTokenInput(amount, erc20.decimals);
    if (parsed.value === null) return setError(parsed.error ?? "Invalid amount");
    if (parsed.value > balance) return setError("Amount exceeds treasury balance.");
    try {
      await tx.submit({
        address: treasury.address,
        abi: treasury.abi,
        functionName: "withdraw",
        args: [token, getAddress(to), parsed.value],
      });
    } catch (e) {
      tx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader
        title="Treasury"
        description="Protocol fee balances and withdrawals."
        action={<span className="text-sm text-muted">{token ? `${formatTokenAmount(balance, erc20.decimals)} ${erc20.symbol}` : "—"}</span>}
      />
      {!treasury ? (
        <p className="text-sm text-muted">Treasury is not deployed on this network.</p>
      ) : (
        <>
          <Field label="Token" htmlFor="treasury-token">
            <Input id="treasury-token" placeholder="0x…" value={tokenInput} onChange={(e) => setTokenInput(e.target.value)} />
          </Field>
          <Field label="Recipient" htmlFor="treasury-to">
            <Input id="treasury-to" placeholder="0x…" value={to} onChange={(e) => setTo(e.target.value)} />
          </Field>
          <Field label={`Amount (${erc20.symbol})`} htmlFor="treasury-amount">
            <Input id="treasury-amount" inputMode="decimal" placeholder="100" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          {error ? <p className="field-error mb-3">{error}</p> : null}
          <Button onClick={onWithdraw} loading={tx.isBusy}>
            Withdraw
          </Button>
          {tx.hash ? (
            <p className="mt-3 text-xs text-muted">
              Tx: <TxLink hash={tx.hash} />
            </p>
          ) : null}
        </>
      )}
    </Card>
  );
}
