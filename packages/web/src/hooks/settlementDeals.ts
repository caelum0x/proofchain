"use client";

import { useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import type { Address, Hex } from "viem";
import type { Abi } from "viem";
import { usePublicClient, useWatchContractEvent } from "wagmi";
import { getAbi } from "@/lib/abis";
import { contractAddresses } from "@/lib/shared";
import { env } from "@/lib/env";
import { DealState, type DealStateValue } from "@/lib/types";
import { logOrder } from "@/lib/finance";

const ESCROW_ABI = getAbi("SettlementEscrow") as Abi;

/**
 * The current state of a settlement escrow deal, folded from the escrow's
 * lifecycle events. The SettlementEscrow contract exposes no enumeration, so —
 * as with batches and financing listings — indexed events are the source of
 * truth and `getDeal` semantics are reconstructed per batch.
 */
export interface SettlementDealRecord {
  readonly batchId: Hex;
  readonly buyer?: Address;
  readonly supplier?: Address;
  readonly token?: Address;
  readonly amount: bigint;
  readonly state: DealStateValue;
  readonly payee?: Address;
  /** Basis-points score at dispute time, when disputed. */
  readonly disputeScore?: number;
  /** Block number the deal was funded at (used for recency ordering). */
  readonly fundedBlock?: bigint;
  readonly order: bigint;
}

type DealEventKind = "funded" | "released" | "refunded" | "disputed" | "arbiter" | "payee";

interface DealEvent {
  readonly kind: DealEventKind;
  readonly batchId: Hex;
  readonly order: bigint;
  readonly blockNumber?: bigint;
  readonly buyer?: Address;
  readonly supplier?: Address;
  readonly token?: Address;
  readonly amount?: bigint;
  readonly payee?: Address;
  readonly score?: number;
}

/** Fold escrow lifecycle events into the current deal state per batch. */
export function reduceDealEvents(events: readonly DealEvent[]): SettlementDealRecord[] {
  const ordered = [...events].sort((a, b) => (a.order < b.order ? -1 : a.order > b.order ? 1 : 0));
  const byBatch = new Map<Hex, SettlementDealRecord>();

  for (const ev of ordered) {
    const prev = byBatch.get(ev.batchId);
    switch (ev.kind) {
      case "funded":
        byBatch.set(ev.batchId, {
          batchId: ev.batchId,
          buyer: ev.buyer,
          supplier: ev.supplier,
          token: ev.token,
          amount: ev.amount ?? 0n,
          state: DealState.Funded,
          fundedBlock: ev.blockNumber,
          order: ev.order,
        });
        break;
      case "released":
        if (!prev) break;
        byBatch.set(ev.batchId, { ...prev, state: DealState.Released, order: ev.order });
        break;
      case "arbiter":
        if (!prev) break;
        byBatch.set(ev.batchId, { ...prev, state: DealState.Released, payee: ev.payee, order: ev.order });
        break;
      case "refunded":
        if (!prev) break;
        byBatch.set(ev.batchId, { ...prev, state: DealState.Refunded, order: ev.order });
        break;
      case "disputed":
        if (!prev) break;
        byBatch.set(ev.batchId, { ...prev, state: DealState.Disputed, disputeScore: ev.score, order: ev.order });
        break;
      case "payee":
        if (!prev) break;
        byBatch.set(ev.batchId, { ...prev, payee: ev.payee, order: ev.order });
        break;
    }
  }

  return [...byBatch.values()].sort((a, b) => (a.order > b.order ? -1 : a.order < b.order ? 1 : 0));
}

const QUERY_KEY = "settlement-deals";

/**
 * Discover every settlement escrow deal by reading the escrow's lifecycle
 * events (`Funded` / `Released` / `Refunded` / `Disputed` / `ArbiterReleased` /
 * `PayeeSet`) and folding them into the current per-batch state. Stays live via
 * event subscriptions.
 */
export function useSettlementDeals() {
  const publicClient = usePublicClient();
  const queryClient = useQueryClient();
  const escrow = contractAddresses.settlementEscrow;

  const query = useQuery<SettlementDealRecord[]>({
    queryKey: [QUERY_KEY, env.chainId, escrow],
    enabled: Boolean(publicClient && escrow),
    queryFn: async () => {
      if (!publicClient || !escrow) return [];
      const fromBlock = env.deployBlock ?? "earliest";
      const [funded, released, refunded, disputed, arbiter, payee] = await Promise.all(
        (["Funded", "Released", "Refunded", "Disputed", "ArbiterReleased", "PayeeSet"] as const).map(
          (eventName) =>
            publicClient.getContractEvents({ address: escrow, abi: ESCROW_ABI, eventName, fromBlock, toBlock: "latest" }),
        ),
      );

      const events: DealEvent[] = [];
      for (const log of funded) {
        const a = log.args as { batchId?: Hex; buyer?: Address; supplier?: Address; token?: Address; amount?: bigint };
        if (!a.batchId) continue;
        events.push({
          kind: "funded",
          batchId: a.batchId,
          order: logOrder(log.blockNumber, log.logIndex),
          blockNumber: log.blockNumber ?? undefined,
          buyer: a.buyer,
          supplier: a.supplier,
          token: a.token,
          amount: a.amount,
        });
      }
      for (const log of released) {
        const a = log.args as { batchId?: Hex };
        if (!a.batchId) continue;
        events.push({ kind: "released", batchId: a.batchId, order: logOrder(log.blockNumber, log.logIndex) });
      }
      for (const log of refunded) {
        const a = log.args as { batchId?: Hex };
        if (!a.batchId) continue;
        events.push({ kind: "refunded", batchId: a.batchId, order: logOrder(log.blockNumber, log.logIndex) });
      }
      for (const log of disputed) {
        const a = log.args as { batchId?: Hex; score?: number };
        if (!a.batchId) continue;
        events.push({ kind: "disputed", batchId: a.batchId, order: logOrder(log.blockNumber, log.logIndex), score: a.score });
      }
      for (const log of arbiter) {
        const a = log.args as { batchId?: Hex; payee?: Address };
        if (!a.batchId) continue;
        events.push({ kind: "arbiter", batchId: a.batchId, order: logOrder(log.blockNumber, log.logIndex), payee: a.payee });
      }
      for (const log of payee) {
        const a = log.args as { batchId?: Hex; payee?: Address };
        if (!a.batchId) continue;
        events.push({ kind: "payee", batchId: a.batchId, order: logOrder(log.blockNumber, log.logIndex), payee: a.payee });
      }

      return reduceDealEvents(events);
    },
  });

  const invalidate = useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: [QUERY_KEY, env.chainId, escrow] });
  }, [queryClient, escrow]);

  useWatchContractEvent({ address: escrow, abi: ESCROW_ABI, eventName: "Funded", enabled: Boolean(escrow), onLogs: invalidate });
  useWatchContractEvent({ address: escrow, abi: ESCROW_ABI, eventName: "Released", enabled: Boolean(escrow), onLogs: invalidate });
  useWatchContractEvent({ address: escrow, abi: ESCROW_ABI, eventName: "Refunded", enabled: Boolean(escrow), onLogs: invalidate });
  useWatchContractEvent({ address: escrow, abi: ESCROW_ABI, eventName: "Disputed", enabled: Boolean(escrow), onLogs: invalidate });

  return {
    deals: query.data ?? [],
    isLoading: query.isLoading,
    isError: query.isError,
    error: query.error,
    refetch: query.refetch,
    deployed: Boolean(escrow),
  };
}
