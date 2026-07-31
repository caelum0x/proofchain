"use client";

import { useCallback } from "react";
import type { Abi, Address, Hex } from "viem";
import { isAddress } from "viem";
import { useAccount, useReadContract, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";

const ABI = getAbi("KYCRegistry") as Abi;

export interface KycStatus {
  readonly account?: Address;
  readonly deployed: boolean;
  /** Whether the account has any non-zero KYC level. */
  readonly isVerified: boolean;
  /** KYC tier (0 = unverified). */
  readonly level: number;
  /** Whether the connected wallet holds KYC_ADMIN (can set/revoke). */
  readonly isAdmin: boolean;
  readonly isLoading: boolean;
  readonly error: string | null;
  readonly refetch: () => void;
}

/**
 * Reads an account's KYC status from `KYCRegistry` (`isVerified` + `levelOf`)
 * and whether the connected wallet can administer KYC. When `account` is a
 * malformed string the reads stay disabled so the screening tool can validate
 * input before hitting the chain. Live via KycSet / KycRevoked.
 */
export function useComplianceKyc(account?: string): KycStatus {
  const { address: connected } = useAccount();
  const registry = getResolvedAddress("KYCRegistry");
  const target = account && isAddress(account) ? (account as Address) : undefined;
  const enabled = Boolean(registry && target);

  const verifiedQ = useReadContract({
    address: registry,
    abi: ABI,
    functionName: "isVerified",
    args: target ? [target] : undefined,
    query: { enabled },
  });
  const levelQ = useReadContract({
    address: registry,
    abi: ABI,
    functionName: "levelOf",
    args: target ? [target] : undefined,
    query: { enabled },
  });
  const adminRoleQ = useReadContract({
    address: registry,
    abi: ABI,
    functionName: "DEFAULT_ADMIN_ROLE",
    query: { enabled: Boolean(registry) },
  });
  const isAdminQ = useReadContract({
    address: registry,
    abi: ABI,
    functionName: "hasRole",
    args: adminRoleQ.data && connected ? [adminRoleQ.data as Hex, connected] : undefined,
    query: { enabled: Boolean(registry && adminRoleQ.data && connected) },
  });

  const refetch = useCallback(() => {
    void verifiedQ.refetch();
    void levelQ.refetch();
  }, [verifiedQ, levelQ]);

  useWatchContractEvent({ address: registry, abi: ABI, eventName: "KycSet", enabled: Boolean(registry), onLogs: refetch });
  useWatchContractEvent({ address: registry, abi: ABI, eventName: "KycRevoked", enabled: Boolean(registry), onLogs: refetch });

  return {
    account: target,
    deployed: Boolean(registry),
    isVerified: verifiedQ.data === true,
    level: Number((levelQ.data as bigint | number | undefined) ?? 0),
    isAdmin: isAdminQ.data === true,
    isLoading: enabled && (verifiedQ.isLoading || levelQ.isLoading),
    error: verifiedQ.isError ? getErrorMessage(verifiedQ.error) : null,
    refetch,
  };
}
