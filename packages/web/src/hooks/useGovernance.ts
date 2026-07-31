"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { tryContractRef } from "@/lib/contracts";
import { useContractLogs, type DecodedLog } from "./useContractLogs";

/** OpenZeppelin `IGovernor.ProposalState`. */
export const ProposalState = {
  Pending: 0,
  Active: 1,
  Canceled: 2,
  Defeated: 3,
  Succeeded: 4,
  Queued: 5,
  Expired: 6,
  Executed: 7,
} as const;
export type ProposalStateValue = (typeof ProposalState)[keyof typeof ProposalState];

export const PROPOSAL_STATE_LABEL: Record<number, string> = {
  0: "Pending",
  1: "Active",
  2: "Canceled",
  3: "Defeated",
  4: "Succeeded",
  5: "Queued",
  6: "Expired",
  7: "Executed",
};

/** Vote support values accepted by `castVote`. */
export const VoteSupport = { Against: 0, For: 1, Abstain: 2 } as const;
export type VoteSupportValue = (typeof VoteSupport)[keyof typeof VoteSupport];

export interface ProposalSummary {
  readonly id: string;
  readonly proposer: Address;
  readonly description: string;
  readonly voteStart: bigint;
  readonly voteEnd: bigint;
}

/**
 * Pure reducer: de-duplicate `ProposalCreated` logs (most-recent-first) into a
 * proposal summary list keyed by id. Exported for unit testing.
 */
export function reduceProposals(logs: readonly DecodedLog[]): ProposalSummary[] {
  const seen = new Set<string>();
  const out: ProposalSummary[] = [];
  for (const log of logs) {
    const idRaw = log.args.proposalId;
    if (idRaw === undefined || idRaw === null) continue;
    const id = String(idRaw);
    if (seen.has(id)) continue;
    seen.add(id);
    out.push({
      id,
      proposer: (log.args.proposer as Address) ?? "0x0000000000000000000000000000000000000000",
      description: String(log.args.description ?? ""),
      voteStart: toBig(log.args.voteStart),
      voteEnd: toBig(log.args.voteEnd),
    });
  }
  return out;
}

/**
 * Discover every governance proposal from the Governor's `ProposalCreated` logs.
 * Governor exposes no enumeration, so events are the source of truth (most-recent
 * first, de-duplicated by id).
 */
export function useProposals() {
  const { logs, isLoading, isError, error, refetch, notDeployed } = useContractLogs({
    name: "ProofChainGovernor",
    eventName: "ProposalCreated",
  });

  const proposals = useMemo<ProposalSummary[]>(() => reduceProposals(logs), [logs]);

  return { proposals, isLoading, isError, error, refetch, notDeployed };
}

/** Full on-chain state for a single proposal id (string form of the uint256). */
export function useProposal(id?: string) {
  const { address: account } = useAccount();
  const gov = tryContractRef("ProofChainGovernor");
  const registry = tryContractRef("ProposalRegistry");
  const enabled = Boolean(id && gov);
  const idArg = id ? [BigInt(id)] : undefined;

  const stateQuery = useReadContract({
    address: gov?.address,
    abi: gov?.abi,
    functionName: "state",
    args: idArg,
    query: { enabled },
  });

  const votesQuery = useReadContract({
    address: gov?.address,
    abi: gov?.abi,
    functionName: "proposalVotes",
    args: idArg,
    query: { enabled },
  });

  const snapshotQuery = useReadContract({
    address: gov?.address,
    abi: gov?.abi,
    functionName: "proposalSnapshot",
    args: idArg,
    query: { enabled },
  });

  const deadlineQuery = useReadContract({
    address: gov?.address,
    abi: gov?.abi,
    functionName: "proposalDeadline",
    args: idArg,
    query: { enabled },
  });

  const proposerQuery = useReadContract({
    address: gov?.address,
    abi: gov?.abi,
    functionName: "proposalProposer",
    args: idArg,
    query: { enabled },
  });

  const hasVotedQuery = useReadContract({
    address: gov?.address,
    abi: gov?.abi,
    functionName: "hasVoted",
    args: id && account ? [BigInt(id), account] : undefined,
    query: { enabled: enabled && Boolean(account) },
  });

  const descriptionQuery = useReadContract({
    address: registry?.address,
    abi: registry?.abi,
    functionName: "descriptionOf",
    args: idArg,
    query: { enabled: Boolean(id && registry) },
  });

  const votes = (votesQuery.data as readonly bigint[] | undefined) ?? undefined;

  const refetch = () => {
    void stateQuery.refetch();
    void votesQuery.refetch();
    void hasVotedQuery.refetch();
  };

  return {
    state: stateQuery.data === undefined ? undefined : Number(stateQuery.data),
    votesAgainst: votes ? votes[0] : undefined,
    votesFor: votes ? votes[1] : undefined,
    votesAbstain: votes ? votes[2] : undefined,
    snapshot: snapshotQuery.data as bigint | undefined,
    deadline: deadlineQuery.data as bigint | undefined,
    proposer: proposerQuery.data as Address | undefined,
    hasVoted: Boolean(hasVotedQuery.data),
    metadataUri: (descriptionQuery.data as string | undefined) ?? "",
    isLoading: stateQuery.isLoading,
    isError: stateQuery.isError,
    error: stateQuery.error ?? null,
    refetch,
  };
}

/** The connected account's PROOF governance-token balance, votes, and delegate. */
export function useGovToken() {
  const { address: account } = useAccount();
  const token = tryContractRef("GovernanceToken");

  const balanceQuery = useReadContract({
    address: token?.address,
    abi: token?.abi,
    functionName: "balanceOf",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(token && account) },
  });

  const votesQuery = useReadContract({
    address: token?.address,
    abi: token?.abi,
    functionName: "getVotes",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(token && account) },
  });

  const delegateQuery = useReadContract({
    address: token?.address,
    abi: token?.abi,
    functionName: "delegates",
    args: account ? [account] : undefined,
    query: { enabled: Boolean(token && account) },
  });

  const symbolQuery = useReadContract({
    address: token?.address,
    abi: token?.abi,
    functionName: "symbol",
    query: { enabled: Boolean(token), staleTime: Infinity },
  });

  const delegate = delegateQuery.data as Address | undefined;
  const zero = "0x0000000000000000000000000000000000000000";
  const refetch = () => {
    void balanceQuery.refetch();
    void votesQuery.refetch();
    void delegateQuery.refetch();
  };

  return {
    account,
    token,
    balance: (balanceQuery.data as bigint | undefined) ?? 0n,
    votes: (votesQuery.data as bigint | undefined) ?? 0n,
    delegate,
    hasDelegated: Boolean(delegate && delegate !== zero),
    isSelfDelegated: Boolean(account && delegate && delegate.toLowerCase() === account.toLowerCase()),
    symbol: (symbolQuery.data as string | undefined) ?? "PROOF",
    isLoading: balanceQuery.isLoading,
    refetch,
  };
}

function toBig(value: unknown): bigint {
  if (typeof value === "bigint") return value;
  if (typeof value === "number") return BigInt(value);
  if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
  return 0n;
}
