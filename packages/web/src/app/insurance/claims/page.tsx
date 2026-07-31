"use client";

import { useMemo } from "react";
import Link from "next/link";
import type { Abi } from "viem";
import { useAccount, useReadContract } from "wagmi";
import { useClaims } from "@/hooks/useClaims";
import { useUsdc } from "@/hooks/useUsdc";
import { FileClaimForm } from "@/components/insurance/FileClaimForm";
import { ClaimCard } from "@/components/insurance/ClaimCard";
import { RequireWallet } from "@/components/RequireWallet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { Badge } from "@/components/ui/Badge";
import { getAbi } from "@/lib/abis";
import { getResolvedAddress } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";
import { payableClaims, pendingClaims } from "@/lib/insurance";

const CLAIMS_ABI = getAbi("ClaimsProcessor") as Abi;

/**
 * Claims workspace: file a claim, track your claims, and — for arbiters —
 * review the queue of filed claims and pay out approved ones.
 */
export default function ClaimsPage() {
  const { address: account } = useAccount();
  const usdc = useUsdc();
  const claimsAddr = getResolvedAddress("ClaimsProcessor");
  const deployed = Boolean(claimsAddr);
  const { claims, isLoading, isError, error, refetch } = useClaims();

  const roleQ = useReadContract({
    address: claimsAddr,
    abi: CLAIMS_ABI,
    functionName: "ARBITER_ROLE",
    query: { enabled: deployed },
  });
  const hasRoleQ = useReadContract({
    address: claimsAddr,
    abi: CLAIMS_ABI,
    functionName: "hasRole",
    args: roleQ.data && account ? [roleQ.data, account] : undefined,
    query: { enabled: Boolean(claimsAddr && roleQ.data && account) },
  });
  const isArbiter = hasRoleQ.data === true;

  const mine = useMemo(
    () => (account ? claims.filter((c) => c.claimant?.toLowerCase() === account.toLowerCase()) : []),
    [claims, account],
  );
  const pending = useMemo(() => pendingClaims(claims), [claims]);
  const payable = useMemo(() => payableClaims(claims), [claims]);

  const cardProps = { decimals: usdc.decimals, symbol: usdc.symbol, isArbiter, onChanged: () => void refetch() };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Insurance claims</h1>
          <p className="mt-1 text-sm text-muted">File claims and, as an arbiter, review and settle them.</p>
        </div>
        <Link href="/insurance" className="text-sm text-brand hover:underline">
          ← Insurance
        </Link>
      </div>

      {!deployed ? (
        <EmptyState
          title="Claims are not available on this network"
          description="The ClaimsProcessor contract is not deployed for the configured chain."
        />
      ) : (
        <>
          <RequireWallet>
            <FileClaimForm decimals={usdc.decimals} symbol={usdc.symbol} onFiled={() => void refetch()} />
          </RequireWallet>

          {isArbiter ? (
            <section className="space-y-3">
              <div className="flex items-center gap-2">
                <h2 className="text-base font-semibold">Arbiter queue</h2>
                <Badge tone="brand">Arbiter</Badge>
              </div>
              {isLoading ? (
                <LoadingState label="Indexing claims…" />
              ) : pending.length === 0 && payable.length === 0 ? (
                <EmptyState title="Nothing to review" description="No filed or approved claims awaiting action." />
              ) : (
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {[...pending, ...payable].map((claim) => (
                    <ClaimCard key={claim.claimId} claim={claim} {...cardProps} />
                  ))}
                </div>
              )}
            </section>
          ) : null}

          <section className="space-y-3">
            <h2 className="text-base font-semibold">Your claims</h2>
            {!account ? (
              <EmptyState title="Connect your wallet" description="Connect to see claims you have filed." />
            ) : isLoading ? (
              <LoadingState label="Indexing your claims…" />
            ) : isError ? (
              <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
            ) : mine.length === 0 ? (
              <EmptyState title="No claims filed" description="File a claim against one of your policies above." />
            ) : (
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {mine.map((claim) => (
                  <ClaimCard key={claim.claimId} claim={claim} {...cardProps} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  );
}
