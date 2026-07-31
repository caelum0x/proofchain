"use client";

import { useCallback } from "react";
import type { Abi, Address, Hex } from "viem";
import { useAccount, useReadContract, useWatchContractEvent } from "wagmi";
import { ClaimState } from "@proofchain/shared";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";
import type { ClaimRecord } from "@/lib/insurance";

const ABI = getAbi("ClaimsProcessor") as Abi;

/** A fully-read claim struct including the filing timestamp. */
export interface ClaimDetail extends ClaimRecord {
  readonly filedAt: number;
}

interface RawClaim {
  readonly claimId: Hex;
  readonly policyId: Hex;
  readonly claimant: Hex;
  readonly amount: bigint;
  readonly state: number;
  readonly filedAt: bigint;
}

/**
 * Reads a single claim by id via `ClaimsProcessor.claimOf`, and reports whether
 * the connected account holds ARBITER_ROLE (to gate approve/reject/payout).
 * Live via the four claim lifecycle events.
 */
export function useInsuranceClaim(claimId?: Hex) {
  const { address: account } = useAccount();
  const address = getResolvedAddress("ClaimsProcessor");
  const enabled = Boolean(address && claimId);

  const query = useReadContract({
    address,
    abi: ABI,
    functionName: "claimOf",
    args: claimId ? [claimId] : undefined,
    query: { enabled },
  });

  const roleQ = useReadContract({
    address,
    abi: ABI,
    functionName: "ARBITER_ROLE",
    query: { enabled: Boolean(address) },
  });
  const hasRoleQ = useReadContract({
    address,
    abi: ABI,
    functionName: "hasRole",
    args: roleQ.data && account ? [roleQ.data as Hex, account] : undefined,
    query: { enabled: Boolean(address && roleQ.data && account) },
  });

  const refetch = useCallback(() => void query.refetch(), [query]);
  const watchEnabled = Boolean(address);
  useWatchContractEvent({ address, abi: ABI, eventName: "ClaimFiled", enabled: watchEnabled, onLogs: refetch });
  useWatchContractEvent({ address, abi: ABI, eventName: "ClaimApproved", enabled: watchEnabled, onLogs: refetch });
  useWatchContractEvent({ address, abi: ABI, eventName: "ClaimRejected", enabled: watchEnabled, onLogs: refetch });
  useWatchContractEvent({ address, abi: ABI, eventName: "ClaimPaid", enabled: watchEnabled, onLogs: refetch });

  const raw = query.data as RawClaim | undefined;
  const exists = Boolean(raw && raw.state !== ClaimState.None && raw.claimant);

  const claim: ClaimDetail | undefined = exists && raw
    ? {
        claimId: raw.claimId,
        policyId: raw.policyId,
        claimant: raw.claimant as Address,
        amount: raw.amount,
        state: raw.state as ClaimState,
        filedAt: Number(raw.filedAt),
        order: raw.filedAt,
      }
    : undefined;

  return {
    claim,
    isArbiter: hasRoleQ.data === true,
    deployed: Boolean(address),
    isLoading: enabled && query.isLoading,
    error: query.isError ? getErrorMessage(query.error) : null,
    refetch,
  };
}
