"use client";

import { useState } from "react";
import { getAddress, isAddress, type Hex } from "viem";
import { useReadContract } from "wagmi";
import { useTx } from "@/hooks/useTx";
import { tryContractRef } from "@/lib/contracts";
import { ALL_CONTRACT_NAMES, type ContractName } from "@/lib/contract-names";
import { hashString, isBytes32 } from "@/lib/hashing";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const DEFAULT_ADMIN_ROLE = ("0x" + "0".repeat(64)) as Hex;

// Common role names from the Roles library (SPEC2). "Default admin" maps to bytes32(0).
const ROLE_PRESETS = [
  "Default admin",
  "REGISTRAR_ROLE",
  "AGENT_ROLE",
  "REPUTATION_UPDATER_ROLE",
  "SLASHER_ROLE",
  "ARBITER_ROLE",
  "MINTER_ROLE",
  "TREASURER_ROLE",
  "POOL_MANAGER_ROLE",
  "GOVERNOR_ROLE",
  "KEEPER_ROLE",
  "PAUSER_ROLE",
] as const;

function roleKey(label: string): Hex {
  const t = label.trim();
  if (t === "Default admin" || t === "") return DEFAULT_ADMIN_ROLE;
  if (isBytes32(t)) return t as Hex;
  return hashString(t);
}

/**
 * Grant or revoke an AccessControl role on any module contract. Reads the current
 * `hasRole` for the target account and enforces the change on-chain (the caller
 * must hold the role's admin).
 */
export function RolePanel() {
  const [contractName, setContractName] = useState<ContractName>("ProvenanceRegistry");
  const [role, setRole] = useState<string>("Default admin");
  const [account, setAccount] = useState("");
  const [error, setError] = useState<string | null>(null);

  const ref = tryContractRef(contractName);
  const key = roleKey(role);
  const grantTx = useTx({ successLabel: "Role granted", onConfirmed: () => hasRoleQuery.refetch() });
  const revokeTx = useTx({ successLabel: "Role revoked", onConfirmed: () => hasRoleQuery.refetch() });

  const hasRoleQuery = useReadContract({
    address: ref?.address,
    abi: ref?.abi,
    functionName: "hasRole",
    args: isAddress(account) ? [key, getAddress(account)] : undefined,
    query: { enabled: Boolean(ref && isAddress(account)) },
  });

  const run = async (tx: ReturnType<typeof useTx>, functionName: "grantRole" | "revokeRole") => {
    setError(null);
    if (!ref) return setError(`${contractName} is not deployed.`);
    if (!isAddress(account)) return setError("Enter a valid account address.");
    try {
      await tx.submit({ address: ref.address, abi: ref.abi, functionName, args: [key, getAddress(account)] });
    } catch (e) {
      tx.reset();
      setError(getErrorMessage(e));
    }
  };

  const holds = hasRoleQuery.data;

  return (
    <Card>
      <CardHeader
        title="Role management"
        description="Grant or revoke AccessControl roles on any module."
        action={
          isAddress(account) && holds !== undefined ? (
            <Badge tone={holds ? "success" : "neutral"}>{holds ? "Has role" : "No role"}</Badge>
          ) : undefined
        }
      />
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Contract" htmlFor="role-contract">
          <select
            id="role-contract"
            className="input"
            value={contractName}
            onChange={(e) => setContractName(e.target.value as ContractName)}
          >
            {ALL_CONTRACT_NAMES.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Role" htmlFor="role-role">
          <select id="role-role" className="input" value={role} onChange={(e) => setRole(e.target.value)}>
            {ROLE_PRESETS.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </Field>
      </div>
      <Field label="Account" htmlFor="role-account">
        <Input id="role-account" placeholder="0x…" value={account} onChange={(e) => setAccount(e.target.value)} />
      </Field>
      <p className="mb-3 break-all font-mono text-xs text-muted">key: {key}</p>
      {error ? <p className="field-error mb-3">{error}</p> : null}
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => run(grantTx, "grantRole")} loading={grantTx.isBusy}>
          Grant
        </Button>
        <Button variant="danger" onClick={() => run(revokeTx, "revokeRole")} loading={revokeTx.isBusy}>
          Revoke
        </Button>
      </div>
    </Card>
  );
}
