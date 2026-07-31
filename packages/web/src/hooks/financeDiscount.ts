"use client";

import { useCallback } from "react";
import type { Abi } from "viem";
import { useReadContract } from "wagmi";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";

const DISCOUNT_ABI = getAbi("DiscountCalculator") as Abi;

export interface DiscountParams {
  readonly deployed: boolean;
  /** Per-day discount rate in basis points. */
  readonly dailyBps: number;
  /** Additional bps added per risk-grade step. */
  readonly gradeStepBps: number;
  /** Cap on total discount. */
  readonly maxDiscountBps: number;
  readonly maxGrade: number;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
}

/** Reads the global DiscountCalculator parameters that drive early-payment pricing. */
export function useDiscountParams(): DiscountParams {
  const address = getResolvedAddress("DiscountCalculator");
  const useRead = (functionName: string) =>
    useReadContract({ address, abi: DISCOUNT_ABI, functionName, query: { enabled: Boolean(address) } });

  const dailyQ = useRead("dailyBps");
  const stepQ = useRead("gradeStepBps");
  const maxQ = useRead("maxDiscountBps");
  const gradeQ = useRead("MAX_GRADE");

  const refetch = useCallback(() => {
    void dailyQ.refetch();
    void stepQ.refetch();
    void maxQ.refetch();
  }, [dailyQ, stepQ, maxQ]);

  return {
    deployed: Boolean(address),
    dailyBps: Number((dailyQ.data as number | undefined) ?? 0),
    gradeStepBps: Number((stepQ.data as number | undefined) ?? 0),
    maxDiscountBps: Number((maxQ.data as number | undefined) ?? 0),
    maxGrade: Number((gradeQ.data as number | undefined) ?? 7),
    isLoading: dailyQ.isLoading || maxQ.isLoading,
    isError: dailyQ.isError || maxQ.isError,
    refetch,
  };
}

export interface DiscountQuote {
  readonly advance: bigint | null;
  readonly discountBps: number | null;
  readonly isLoading: boolean;
}

/**
 * Live pricing for a single early-payment scenario: given a face value, supplier
 * risk grade and tenor (days), reads the advance the calculator would pay now
 * and the effective discount in basis points.
 */
export function useDiscountQuote(
  faceValue: bigint | null,
  grade: number,
  tenorDays: number,
): DiscountQuote {
  const address = getResolvedAddress("DiscountCalculator");
  const valid = faceValue !== null && faceValue > 0n && grade > 0 && tenorDays >= 0;

  const advanceQ = useReadContract({
    address,
    abi: DISCOUNT_ABI,
    functionName: "advanceFor",
    args: valid ? [faceValue, grade, BigInt(tenorDays)] : undefined,
    query: { enabled: Boolean(address) && valid },
  });

  const bpsQ = useReadContract({
    address,
    abi: DISCOUNT_ABI,
    functionName: "discountBps",
    args: valid ? [grade, BigInt(tenorDays)] : undefined,
    query: { enabled: Boolean(address) && valid },
  });

  return {
    advance: (advanceQ.data as bigint | undefined) ?? null,
    discountBps: bpsQ.data !== undefined ? Number(bpsQ.data as number) : null,
    isLoading: advanceQ.isLoading || bpsQ.isLoading,
  };
}
