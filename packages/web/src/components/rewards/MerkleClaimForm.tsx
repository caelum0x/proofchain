"use client";

import { useState } from "react";
import { useAccount, useReadContract } from "wagmi";
import type { Hex } from "viem";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { isBytes32 } from "@/lib/hashing";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input, Textarea } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TxLink } from "@/components/ui/TxLink";

/**
 * Claim merkle-distributed rewards for an epoch. The proof is generated off-chain
 * from the epoch's tree; users paste their `amount` and JSON proof array. We
 * validate every proof element is a bytes32 before submitting.
 */
export function MerkleClaimForm() {
  const distributor = tryContractRef("RewardsDistributor");
  const { address: account } = useAccount();
  const [epoch, setEpoch] = useState("");
  const [amount, setAmount] = useState("");
  const [proof, setProof] = useState("");
  const [error, setError] = useState<string | null>(null);

  const epochNum = /^\d+$/.test(epoch.trim()) ? BigInt(epoch.trim()) : undefined;

  const claimedQuery = useReadContract({
    address: distributor?.address,
    abi: distributor?.abi,
    functionName: "isClaimed",
    args: epochNum !== undefined && account ? [epochNum, account] : undefined,
    query: { enabled: Boolean(distributor && account && epochNum !== undefined) },
  });

  const tx = useTx({ successLabel: "Reward claimed", onConfirmed: () => claimedQuery.refetch() });

  if (!distributor) {
    return (
      <Card>
        <CardHeader title="Claim rewards" />
        <p className="text-sm text-muted">RewardsDistributor is not deployed on this network.</p>
      </Card>
    );
  }

  const onClaim = async () => {
    setError(null);
    if (epochNum === undefined) return setError("Enter a valid epoch.");
    if (!/^\d+$/.test(amount.trim())) return setError("Enter the reward amount in base units.");
    let proofArr: Hex[];
    try {
      const parsed = JSON.parse(proof.trim() || "[]");
      if (!Array.isArray(parsed)) throw new Error("Proof must be a JSON array");
      proofArr = parsed.map((p) => {
        if (typeof p !== "string" || !isBytes32(p)) throw new Error(`Invalid proof node: ${String(p)}`);
        return p as Hex;
      });
    } catch (e) {
      return setError(`Invalid proof: ${getErrorMessage(e)}`);
    }
    try {
      await tx.submit({
        address: distributor.address,
        abi: distributor.abi,
        functionName: "claim",
        args: [epochNum, BigInt(amount.trim()), proofArr],
      });
    } catch (e) {
      tx.reset();
      setError(getErrorMessage(e));
    }
  };

  const claimed = Boolean(claimedQuery.data);

  return (
    <Card>
      <CardHeader
        title="Claim rewards"
        description="Paste your epoch, amount, and merkle proof."
        action={epochNum !== undefined && account ? (claimed ? <Badge tone="neutral">Claimed</Badge> : <Badge tone="success">Claimable</Badge>) : undefined}
      />
      <Field label="Epoch" htmlFor="claim-epoch">
        <Input id="claim-epoch" inputMode="numeric" placeholder="0" value={epoch} onChange={(e) => setEpoch(e.target.value)} />
      </Field>
      <Field label="Amount (base units)" htmlFor="claim-amount">
        <Input id="claim-amount" inputMode="numeric" placeholder="1000000000000000000" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </Field>
      <Field label="Merkle proof (JSON array of bytes32)" htmlFor="claim-proof">
        <Textarea id="claim-proof" placeholder='["0x…","0x…"]' value={proof} onChange={(e) => setProof(e.target.value)} />
      </Field>
      {error ? <p className="field-error mb-3">{error}</p> : null}
      <Button onClick={onClaim} loading={tx.isBusy} disabled={claimed}>
        Claim
      </Button>
      {tx.hash ? (
        <p className="mt-3 text-xs text-muted">
          Tx: <TxLink hash={tx.hash} />
        </p>
      ) : null}
    </Card>
  );
}
