"use client";

import { useCallback } from "react";
import type { Abi, Hex } from "viem";
import { useReadContract, useWatchContractEvent } from "wagmi";
import { PolicyState } from "@proofchain/shared";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";
import type { PolicyRecord } from "@/lib/insurance";

const ABI = getAbi("PolicyManager") as Abi;

/** A fully-read policy struct including issue time + settlement token. */
export interface PolicyDetail extends PolicyRecord {
  readonly token?: Hex;
  readonly issuedAt: number;
}

interface RawPolicy {
  readonly policyId: Hex;
  readonly batchId: Hex;
  readonly holder: Hex;
  readonly token: Hex;
  readonly coverage: bigint;
  readonly premium: bigint;
  readonly issuedAt: bigint;
  readonly state: number;
}

/**
 * Reads a single policy by id via `PolicyManager.policyOf`. Returns a typed
 * detail record (or undefined when the policy does not exist / contract is not
 * deployed) plus loading/error state and a refetch. Live via policy events.
 */
export function useInsurancePolicy(policyId?: Hex) {
  const address = getResolvedAddress("PolicyManager");
  const enabled = Boolean(address && policyId);

  const query = useReadContract({
    address,
    abi: ABI,
    functionName: "policyOf",
    args: policyId ? [policyId] : undefined,
    query: { enabled },
  });

  const refetch = useCallback(() => void query.refetch(), [query]);
  useWatchContractEvent({ address, abi: ABI, eventName: "PolicyIssued", enabled: Boolean(address), onLogs: refetch });
  useWatchContractEvent({ address, abi: ABI, eventName: "PolicyCancelled", enabled: Boolean(address), onLogs: refetch });

  const raw = query.data as RawPolicy | undefined;
  const exists = Boolean(raw && raw.state !== PolicyState.None && raw.holder);

  const policy: PolicyDetail | undefined = exists && raw
    ? {
        policyId: raw.policyId,
        batchId: raw.batchId,
        holder: raw.holder,
        token: raw.token,
        coverage: raw.coverage,
        premium: raw.premium,
        issuedAt: Number(raw.issuedAt),
        state: raw.state as PolicyState,
        order: raw.issuedAt,
      }
    : undefined;

  return {
    policy,
    deployed: Boolean(address),
    isLoading: enabled && query.isLoading,
    error: query.isError ? getErrorMessage(query.error) : null,
    refetch,
  };
}
