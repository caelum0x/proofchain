"use client";

import { useState } from "react";
import { getAddress, isAddress } from "viem";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { getResolvedAddress } from "@/lib/shared";
import { ALL_CONTRACT_NAMES } from "@/lib/contract-names";
import { hashString, isBytes32 } from "@/lib/hashing";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { TxLink } from "@/components/ui/TxLink";

/**
 * AddressBook registry viewer + editor. Lists every module's resolved address and
 * lets an admin re-point a key (keccak256 of the module name) to a new address.
 */
export function AddressBookPanel() {
  const book = tryContractRef("AddressBook");
  const [keyLabel, setKeyLabel] = useState("");
  const [addr, setAddr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const tx = useTx({ successLabel: "Address set" });

  const onSet = async () => {
    setError(null);
    if (!book) return setError("AddressBook is not deployed.");
    const label = keyLabel.trim();
    if (!label) return setError("Enter a key label or 0x… key.");
    if (!isAddress(addr)) return setError("Enter a valid address.");
    const key = isBytes32(label) ? (label as `0x${string}`) : hashString(label);
    try {
      await tx.submit({ address: book.address, abi: book.abi, functionName: "setAddress", args: [key, getAddress(addr)] });
    } catch (e) {
      tx.reset();
      setError(getErrorMessage(e));
    }
  };

  return (
    <Card>
      <CardHeader title="AddressBook registry" description="Resolved module addresses on this network." />

      <div className="mb-4 max-h-72 overflow-y-auto rounded-lg border border-border">
        <table className="w-full text-left text-sm">
          <thead className="sticky top-0 bg-surface-2/80 text-xs uppercase tracking-wide text-muted">
            <tr>
              <th className="px-3 py-2 font-medium">Module</th>
              <th className="px-3 py-2 font-medium">Address</th>
            </tr>
          </thead>
          <tbody>
            {ALL_CONTRACT_NAMES.map((name) => {
              const resolved = getResolvedAddress(name);
              return (
                <tr key={name} className="border-t border-border/60">
                  <td className="px-3 py-2">{name}</td>
                  <td className="px-3 py-2">
                    {resolved ? <AddressBadge address={resolved} /> : <Badge tone="neutral">Not set</Badge>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {book ? (
        <div className="space-y-2">
          <Field label="Key (module name or 0x… key)" htmlFor="ab-key">
            <Input id="ab-key" placeholder="ProvenanceRegistry" value={keyLabel} onChange={(e) => setKeyLabel(e.target.value)} />
          </Field>
          <Field label="Address" htmlFor="ab-addr">
            <Input id="ab-addr" placeholder="0x…" value={addr} onChange={(e) => setAddr(e.target.value)} />
          </Field>
          {error ? <p className="field-error">{error}</p> : null}
          <Button onClick={onSet} loading={tx.isBusy}>
            Set address
          </Button>
          {tx.hash ? (
            <p className="text-xs text-muted">
              Tx: <TxLink hash={tx.hash} />
            </p>
          ) : null}
        </div>
      ) : (
        <p className="text-sm text-muted">AddressBook is not deployed on this network.</p>
      )}
    </Card>
  );
}
