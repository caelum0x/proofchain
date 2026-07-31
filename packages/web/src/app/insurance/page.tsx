"use client";

import Link from "next/link";
import { useAccount } from "wagmi";
import { useInsurancePool } from "@/hooks/useInsurancePool";
import { usePolicies } from "@/hooks/usePolicies";
import { useUsdc } from "@/hooks/useUsdc";
import { InsurancePoolCard } from "@/components/insurance/InsurancePoolCard";
import { BuyPolicyForm } from "@/components/insurance/BuyPolicyForm";
import { PolicyCard } from "@/components/insurance/PolicyCard";
import { RequireWallet } from "@/components/RequireWallet";
import { EmptyState, ErrorState, LoadingState } from "@/components/ui/States";
import { getResolvedAddress } from "@/lib/shared";
import { getErrorMessage } from "@/lib/errors";

/**
 * Insurance home: pool capital + underwriting, buying cover on a batch, and the
 * connected holder's policies.
 */
export default function InsurancePage() {
  const { address: account } = useAccount();
  const pool = useInsurancePool();
  const usdc = useUsdc();
  const { policies, isLoading, isError, error, refetch } = usePolicies(account);
  const deployed = Boolean(getResolvedAddress("InsurancePool") && getResolvedAddress("PolicyManager"));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Insurance</h1>
          <p className="mt-1 text-sm text-muted">
            Underwrite shipment/credit cover and buy policies backed by the pool.
          </p>
        </div>
        <Link href="/insurance/claims" className="text-sm text-brand hover:underline">
          Claims →
        </Link>
      </div>

      {!deployed ? (
        <EmptyState
          title="Insurance is not available on this network"
          description="The InsurancePool / PolicyManager contracts are not deployed for the configured chain."
        />
      ) : (
        <>
          <InsurancePoolCard pool={pool} />

          <div className="grid gap-6 lg:grid-cols-2">
            <RequireWallet>
              <BuyPolicyForm onIssued={() => void refetch()} />
            </RequireWallet>

            <div className="space-y-3">
              <h2 className="text-base font-semibold">Your policies</h2>
              {!account ? (
                <EmptyState title="Connect your wallet" description="Connect to see policies you hold." />
              ) : isLoading ? (
                <LoadingState label="Indexing your policies…" />
              ) : isError ? (
                <ErrorState message={getErrorMessage(error)} onRetry={() => void refetch()} />
              ) : policies.length === 0 ? (
                <EmptyState title="No policies yet" description="Buy cover on a batch to see it here." />
              ) : (
                <div className="space-y-4">
                  {policies.map((policy) => (
                    <PolicyCard
                      key={policy.policyId}
                      policy={policy}
                      decimals={usdc.decimals}
                      symbol={usdc.symbol}
                      onChanged={() => void refetch()}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
