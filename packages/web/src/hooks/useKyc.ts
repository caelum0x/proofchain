"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { getAddress, keccak256, toBytes } from "viem";
import { useAccount, useReadContract, useReadContracts } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs } from "./useContractLogs";

/**
 * KYC/compliance reads for the `KYCRegistry` contract (M3). Accounts are
 * assigned a verification level by a KYC provider; unverified counterparties can
 * be blocked from settlement. Exposes the connected account's status, an
 * event-sourced directory of verified accounts, and whether the account may
 * administer KYC (holds the provider/admin role).
 */

/** `IKYCRegistry.KycLevel` enum. */
export const KycLevel = { None: 0, Basic: 1, Enhanced: 2, Institutional: 3 } as const;
export type KycLevelValue = (typeof KycLevel)[keyof typeof KycLevel];

export const KYC_LEVEL_LABEL: Record<number, string> = {
  0: "None",
  1: "Basic",
  2: "Enhanced",
  3: "Institutional",
};

export interface KycRecord {
  readonly account: Address;
  readonly level: number;
  readonly updatedAt: number;
  readonly provider?: Address;
  readonly verified: boolean;
}

interface KycStatusTuple {
  readonly 0: number;
  readonly 1: bigint;
  readonly 2: Address;
}

export interface KycAccount {
  readonly account?: Address;
  readonly deployed: boolean;
  readonly level: number;
  readonly verified: boolean;
  readonly updatedAt: number;
  readonly provider?: Address;
  readonly isAdmin: boolean;
  readonly contractAddress?: Address;
  readonly isLoading: boolean;
  readonly refetch: () => void;
}

/** Connected account's KYC status + admin capability. */
export function useKycAccount(): KycAccount {
  const { address: account } = useAccount();
  const kyc = tryContractRef("KYCRegistry");
  const enabled = Boolean(kyc && account);

  const statusQuery = useReadContract({
    address: kyc?.address,
    abi: kyc?.abi,
    functionName: "kycOf",
    args: account ? [account] : undefined,
    query: { enabled },
  });

  const adminRole = useMemo(() => keccak256(toBytes("KYC_PROVIDER_ROLE")), []);
  const adminQuery = useReadContract({
    address: kyc?.address,
    abi: kyc?.abi,
    functionName: "hasRole",
    args: account ? [adminRole, account] : undefined,
    query: { enabled },
  });
  const defaultAdminQuery = useReadContract({
    address: kyc?.address,
    abi: kyc?.abi,
    functionName: "hasRole",
    args: account
      ? ["0x0000000000000000000000000000000000000000000000000000000000000000", account]
      : undefined,
    query: { enabled },
  });

  const tuple = statusQuery.data as KycStatusTuple | undefined;
  const level = tuple ? Number(tuple[0]) : 0;
  const zeroAddr = "0x0000000000000000000000000000000000000000";
  const provider = tuple?.[2];

  return {
    account,
    deployed: Boolean(kyc),
    level,
    verified: level > 0,
    updatedAt: tuple ? Number(tuple[1]) : 0,
    provider: provider && provider !== zeroAddr ? provider : undefined,
    isAdmin: Boolean(adminQuery.data) || Boolean(defaultAdminQuery.data),
    contractAddress: kyc?.address,
    isLoading: statusQuery.isLoading,
    refetch: () => {
      void statusQuery.refetch();
      void adminQuery.refetch();
    },
  };
}

export interface KycDirectory {
  readonly records: readonly KycRecord[];
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly error: unknown;
  readonly notDeployed: boolean;
  readonly refetch: () => void;
}

/** Every verified account, reconstructed from `KycSet` events + live status reads. */
export function useKycDirectory(): KycDirectory {
  const kyc = tryContractRef("KYCRegistry");
  const logs = useContractLogs({ name: "KYCRegistry", eventName: "KycSet" });

  const accounts = useMemo<Address[]>(() => {
    const seen = new Set<string>();
    const out: Address[] = [];
    for (const log of logs.logs) {
      const account = log.args.account as Address | undefined;
      if (!account) continue;
      const key = account.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(getAddress(account));
    }
    return out;
  }, [logs.logs]);

  const reads = useReadContracts({
    contracts: kyc
      ? accounts.map((a) => ({
          address: kyc.address,
          abi: kyc.abi,
          functionName: "kycOf",
          args: [a],
        }))
      : [],
    query: { enabled: Boolean(kyc) && accounts.length > 0 },
  });

  const records = useMemo<KycRecord[]>(() => {
    const rows = reads.data;
    if (!rows) return [];
    const zeroAddr = "0x0000000000000000000000000000000000000000";
    return accounts
      .map((account, i) => {
        const tuple = rows[i]?.result as KycStatusTuple | undefined;
        const level = tuple ? Number(tuple[0]) : 0;
        const provider = tuple?.[2];
        return {
          account,
          level,
          updatedAt: tuple ? Number(tuple[1]) : 0,
          provider: provider && provider !== zeroAddr ? provider : undefined,
          verified: level > 0,
        };
      })
      .sort((a, b) => b.updatedAt - a.updatedAt);
  }, [reads.data, accounts]);

  return {
    records,
    isLoading: logs.isLoading || reads.isLoading,
    isError: logs.isError || reads.isError,
    error: logs.error ?? reads.error ?? null,
    notDeployed: logs.notDeployed,
    refetch: () => {
      logs.refetch();
      void reads.refetch();
    },
  };
}
