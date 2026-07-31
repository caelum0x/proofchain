"use client";

import { useMemo } from "react";
import type { Address, Hex } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { settlementEscrowAbi } from "@/lib/abis";
import { tryContractRef } from "@/lib/contracts";
import { decodeDeal } from "@/lib/decode";
import type { DealView } from "@/lib/types";
import { useContractLogs, type DecodedLog } from "./useContractLogs";

/** Arbitration lifecycle state, mirroring `IDisputeArbitration.DisputeState`. */
export const ArbDisputeState = { None: 0, Open: 1, Resolved: 2 } as const;
export type ArbDisputeStateValue = (typeof ArbDisputeState)[keyof typeof ArbDisputeState];

export interface DisputeListItem {
  readonly batchId: Hex;
  /** Attestation score (bps) captured when the escrow flagged the deal. */
  readonly score: number;
  readonly blockNumber: bigint;
  readonly transactionHash: Hex;
}

/**
 * Pure reducer: de-duplicate `Disputed` logs (most-recent-first) into one entry
 * per batch, carrying the score captured when the escrow flagged it. Exported for
 * unit testing.
 */
export function reduceDisputed(logs: readonly DecodedLog[]): DisputeListItem[] {
  const seen = new Set<string>();
  const out: DisputeListItem[] = [];
  for (const log of logs) {
    const batchId = log.args.batchId as Hex | undefined;
    if (!batchId || seen.has(batchId)) continue;
    seen.add(batchId);
    const rawScore = log.args.score;
    out.push({
      batchId,
      score: typeof rawScore === "bigint" ? Number(rawScore) : Number(rawScore ?? 0),
      blockNumber: log.blockNumber,
      transactionHash: log.transactionHash,
    });
  }
  return out;
}

/**
 * Enumerate every batch the SettlementEscrow flagged as `Disputed`. There is no
 * on-chain enumeration, so we discover them from `Disputed` events (most-recent,
 * de-duplicated) and let each row read the current deal + arbitration state.
 */
export function useDisputedBatches() {
  const { logs, isLoading, isError, error, refetch, notDeployed } = useContractLogs({
    name: "SettlementEscrow",
    eventName: "Disputed",
  });

  const items = useMemo<DisputeListItem[]>(() => reduceDisputed(logs), [logs]);

  return { items, isLoading, isError, error, refetch, notDeployed };
}

interface RawDispute {
  batchId: Hex;
  openedAt: bigint;
  votesRefund: bigint;
  votesRelease: bigint;
  state: number;
  refundedBuyer: boolean;
}

export interface DisputeDetail {
  readonly batchId: Hex;
  readonly openedAt: number;
  readonly votesRefund: number;
  readonly votesRelease: number;
  readonly state: ArbDisputeStateValue;
  readonly refundedBuyer: boolean;
}

/**
 * Full state for a single disputed batch: the escrow deal, the arbitration
 * record, the attestation score/threshold, and whether the connected account has
 * already voted. Re-reads are driven by the caller (post-tx `refetch`).
 */
export function useDispute(batchId?: Hex) {
  const { address: account } = useAccount();
  const arb = tryContractRef("DisputeArbitration");
  const escrow = tryContractRef("SettlementEscrow");
  const att = tryContractRef("AttestationRegistry");
  const enabled = Boolean(batchId);

  const dealQuery = useReadContract({
    address: escrow?.address,
    abi: settlementEscrowAbi,
    functionName: "getDeal",
    args: batchId ? [batchId] : undefined,
    query: { enabled: enabled && Boolean(escrow) },
  });

  const thresholdQuery = useReadContract({
    address: escrow?.address,
    abi: settlementEscrowAbi,
    functionName: "passThreshold",
    query: { enabled: Boolean(escrow) },
  });

  const disputeQuery = useReadContract({
    address: arb?.address,
    abi: arb?.abi,
    functionName: "disputeOf",
    args: batchId ? [batchId] : undefined,
    query: { enabled: enabled && Boolean(arb) },
  });

  const votingPeriodQuery = useReadContract({
    address: arb?.address,
    abi: arb?.abi,
    functionName: "votingPeriod",
    query: { enabled: Boolean(arb) },
  });

  const scoreQuery = useReadContract({
    address: att?.address,
    abi: att?.abi,
    functionName: "scoreOf",
    args: batchId ? [batchId] : undefined,
    query: { enabled: enabled && Boolean(att) },
  });

  const hasVotedQuery = useReadContract({
    address: arb?.address,
    abi: arb?.abi,
    functionName: "hasVoted",
    args: batchId && account ? [batchId, account] : undefined,
    query: { enabled: enabled && Boolean(arb && account) },
  });

  const dealRaw = dealQuery.data as RawDeal | undefined;
  const deal: DealView | null = dealRaw ? decodeDeal(dealRaw) : null;

  const rawDispute = disputeQuery.data as RawDispute | undefined;
  const dispute: DisputeDetail | null = rawDispute
    ? {
        batchId: rawDispute.batchId,
        openedAt: Number(rawDispute.openedAt),
        votesRefund: Number(rawDispute.votesRefund),
        votesRelease: Number(rawDispute.votesRelease),
        state: coerceDisputeState(rawDispute.state),
        refundedBuyer: rawDispute.refundedBuyer,
      }
    : null;

  const refetch = () => {
    void dealQuery.refetch();
    void disputeQuery.refetch();
    void scoreQuery.refetch();
    void hasVotedQuery.refetch();
  };

  return {
    deal,
    dispute,
    score: scoreQuery.data === undefined ? undefined : Number(scoreQuery.data),
    passThreshold: thresholdQuery.data === undefined ? undefined : Number(thresholdQuery.data),
    votingPeriod: votingPeriodQuery.data === undefined ? undefined : Number(votingPeriodQuery.data),
    hasVoted: Boolean(hasVotedQuery.data),
    isLoading: dealQuery.isLoading || disputeQuery.isLoading,
    isError: dealQuery.isError || disputeQuery.isError,
    error: dealQuery.error ?? disputeQuery.error ?? null,
    refetch,
  };
}

interface RawDeal {
  batchId: Hex;
  buyer: Address;
  supplier: Address;
  token: Address;
  amount: bigint;
  state: number;
}

/**
 * The connected account's arbiter standing: committed arbiter stake, minimum
 * threshold, and the underlying generic StakeManager balances used to fund it.
 */
export function useArbiterStatus() {
  const { address: account } = useAccount();
  const arbStaking = tryContractRef("ArbiterStaking");
  const stakeManager = tryContractRef("StakeManager");

  const isArbiterQuery = useReadContract({
    address: arbStaking?.address,
    abi: arbStaking?.abi,
    functionName: "isArbiter",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(arbStaking && account) },
  });

  const committedQuery = useReadContract({
    address: arbStaking?.address,
    abi: arbStaking?.abi,
    functionName: "stakeOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(arbStaking && account) },
  });

  const minStakeQuery = useReadContract({
    address: arbStaking?.address,
    abi: arbStaking?.abi,
    functionName: "minStake",
    query: { enabled: Boolean(arbStaking) },
  });

  const pendingQuery = useReadContract({
    address: arbStaking?.address,
    abi: arbStaking?.abi,
    functionName: "pendingVotesOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(arbStaking && account) },
  });

  const stakeOfQuery = useReadContract({
    address: stakeManager?.address,
    abi: stakeManager?.abi,
    functionName: "stakeOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(stakeManager && account) },
  });

  const lockedQuery = useReadContract({
    address: stakeManager?.address,
    abi: stakeManager?.abi,
    functionName: "lockedOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(stakeManager && account) },
  });

  const stakeTokenQuery = useReadContract({
    address: stakeManager?.address,
    abi: stakeManager?.abi,
    functionName: "stakeTokenOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(stakeManager && account) },
  });

  const refetch = () => {
    void isArbiterQuery.refetch();
    void committedQuery.refetch();
    void stakeOfQuery.refetch();
    void lockedQuery.refetch();
    void stakeTokenQuery.refetch();
    void pendingQuery.refetch();
  };

  const managerStake = (stakeOfQuery.data as bigint | undefined) ?? 0n;
  const managerLocked = (lockedQuery.data as bigint | undefined) ?? 0n;

  return {
    account,
    isArbiter: Boolean(isArbiterQuery.data),
    committedStake: (committedQuery.data as bigint | undefined) ?? 0n,
    minStake: (minStakeQuery.data as bigint | undefined) ?? 0n,
    pendingVotes: Number((pendingQuery.data as bigint | undefined) ?? 0n),
    managerStake,
    managerLocked,
    managerUnlocked: managerStake > managerLocked ? managerStake - managerLocked : 0n,
    stakeToken: stakeTokenQuery.data as Address | undefined,
    isLoading: isArbiterQuery.isLoading || committedQuery.isLoading,
    refetch,
  };
}

function coerceDisputeState(state: number): ArbDisputeStateValue {
  switch (state) {
    case 1:
      return ArbDisputeState.Open;
    case 2:
      return ArbDisputeState.Resolved;
    default:
      return ArbDisputeState.None;
  }
}
