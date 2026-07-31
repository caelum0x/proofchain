"use client";

import { useCallback } from "react";
import type { Abi, Address, Hex } from "viem";
import { useReadContract, useWatchContractEvent } from "wagmi";
import {
  decodeInvoiceListing,
  decodeReceivableTerms,
  type InvoiceListing,
  type ReceivableTerms,
} from "@proofchain/shared";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";

const FINANCING_ABI = getAbi("InvoiceFinancing") as Abi;
const RECEIVABLE_ABI = getAbi("ReceivableRegistry") as Abi;
const NFT_ABI = getAbi("InvoiceNFT") as Abi;
const SCORE_ABI = getAbi("ScoreOracle") as Abi;
const DISCOUNT_ABI = getAbi("DiscountCalculator") as Abi;

export interface ClaimQuote {
  readonly principal: bigint;
  readonly remainder: bigint;
}

export interface ReceivableView {
  readonly terms: ReceivableTerms | null;
  readonly listing: InvoiceListing | null;
  /** Composite supplier risk grade (0 ungraded .. 7 worst). */
  readonly grade: number;
  /** Discounted advance the DiscountCalculator would pay now for the face value. */
  readonly advance: bigint | null;
  /** Claim split (lender principal, supplier remainder) once settled. */
  readonly claimQuote: ClaimQuote | null;
  readonly nftOwner: Address | null;
  readonly nftTokenURI: string | null;
  readonly tokenId: bigint | null;
  readonly isLoading: boolean;
  readonly isError: boolean;
  readonly refetch: () => void;
}

/** Days between now and a due-date (unix seconds), floored at 0. */
function tenorDays(dueDate: bigint): number {
  const now = BigInt(Math.floor(Date.now() / 1000));
  if (dueDate <= now) return 0;
  return Number((dueDate - now) / 86_400n);
}

/**
 * Aggregates the full financing view for a single receivable/batch: registered
 * terms, the financing listing, supplier risk grade, the advance the discount
 * calculator would pay, the settlement claim split, and the InvoiceNFT owner.
 * Each read degrades independently — a missing receivable or un-minted NFT
 * yields `null` rather than throwing.
 */
export function useReceivable(batchId: Hex | undefined, supplier?: Address): ReceivableView {
  const receivableAddr = getResolvedAddress("ReceivableRegistry");
  const financingAddr = getResolvedAddress("InvoiceFinancing");
  const nftAddr = getResolvedAddress("InvoiceNFT");
  const scoreAddr = getResolvedAddress("ScoreOracle");
  const discountAddr = getResolvedAddress("DiscountCalculator");
  const tokenId = batchId ? BigInt(batchId) : null;

  const existsQ = useReadContract({
    address: receivableAddr,
    abi: RECEIVABLE_ABI,
    functionName: "exists",
    args: batchId ? [batchId] : undefined,
    query: { enabled: Boolean(receivableAddr && batchId) },
  });
  const exists = existsQ.data === true;

  const termsQ = useReadContract({
    address: receivableAddr,
    abi: RECEIVABLE_ABI,
    functionName: "termsOf",
    args: batchId ? [batchId] : undefined,
    query: { enabled: Boolean(receivableAddr && batchId && exists) },
  });

  const listingQ = useReadContract({
    address: financingAddr,
    abi: FINANCING_ABI,
    functionName: "listingOf",
    args: batchId ? [batchId] : undefined,
    query: { enabled: Boolean(financingAddr && batchId) },
  });

  const gradeQ = useReadContract({
    address: scoreAddr,
    abi: SCORE_ABI,
    functionName: "gradeOf",
    args: supplier ? [supplier] : undefined,
    query: { enabled: Boolean(scoreAddr && supplier) },
  });
  const grade = Number((gradeQ.data as number | undefined) ?? 0);

  const terms = safeDecode(termsQ.data, decodeReceivableTerms);
  const face = terms?.exists ? terms.faceValue : undefined;
  const due = terms?.exists ? terms.dueDate : undefined;

  const advanceQ = useReadContract({
    address: discountAddr,
    abi: DISCOUNT_ABI,
    functionName: "advanceFor",
    args: face && due ? [face, grade, BigInt(tenorDays(due))] : undefined,
    query: { enabled: Boolean(discountAddr && face && due && grade > 0) },
  });

  const claimQuoteQ = useReadContract({
    address: financingAddr,
    abi: FINANCING_ABI,
    functionName: "quoteClaim",
    args: batchId ? [batchId] : undefined,
    query: { enabled: Boolean(financingAddr && batchId) },
  });

  const ownerQ = useReadContract({
    address: nftAddr,
    abi: NFT_ABI,
    functionName: "ownerOf",
    args: tokenId !== null ? [tokenId] : undefined,
    query: { enabled: Boolean(nftAddr && tokenId !== null), retry: false },
  });

  const uriQ = useReadContract({
    address: nftAddr,
    abi: NFT_ABI,
    functionName: "tokenURI",
    args: tokenId !== null ? [tokenId] : undefined,
    query: { enabled: Boolean(nftAddr && tokenId !== null && ownerQ.isSuccess), retry: false },
  });

  const refetch = useCallback(() => {
    void existsQ.refetch();
    void termsQ.refetch();
    void listingQ.refetch();
    void gradeQ.refetch();
    void advanceQ.refetch();
    void claimQuoteQ.refetch();
    void ownerQ.refetch();
  }, [existsQ, termsQ, listingQ, gradeQ, advanceQ, claimQuoteQ, ownerQ]);

  useWatchContractEvent({
    address: financingAddr,
    abi: FINANCING_ABI,
    eventName: "Funded",
    args: batchId ? { batchId } : undefined,
    enabled: Boolean(financingAddr && batchId),
    onLogs: () => {
      void listingQ.refetch();
      void claimQuoteQ.refetch();
    },
  });

  const listing = safeDecode(listingQ.data, decodeInvoiceListing);
  const rawClaim = claimQuoteQ.data as readonly [bigint, bigint] | undefined;

  return {
    terms: terms?.exists ? terms : null,
    listing,
    grade,
    advance: (advanceQ.data as bigint | undefined) ?? null,
    claimQuote: rawClaim ? { principal: rawClaim[0], remainder: rawClaim[1] } : null,
    nftOwner: ownerQ.isSuccess ? ((ownerQ.data as Address | undefined) ?? null) : null,
    nftTokenURI: uriQ.isSuccess ? ((uriQ.data as string | undefined) ?? null) : null,
    tokenId,
    isLoading: existsQ.isLoading || listingQ.isLoading,
    isError: listingQ.isError,
    refetch,
  };
}

function safeDecode<T>(raw: unknown, decode: (raw: unknown) => T): T | null {
  if (raw === undefined || raw === null) return null;
  try {
    return decode(raw);
  } catch {
    return null;
  }
}
