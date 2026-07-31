"use client";

import { RequireWallet } from "@/components/RequireWallet";
import { FundDealForm } from "@/components/forms/FundDealForm";
import { FaucetForm } from "@/components/forms/FaucetForm";
import { TrackBatch } from "@/components/TrackBatch";

export default function BuyerPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Buyer</h1>
        <p className="mt-1 text-sm text-muted">
          Approve MockUSDC, fund an escrow deal, and watch autonomous settlement.
        </p>
      </div>

      <RequireWallet>
        <FundDealForm />
        <div className="grid gap-6 lg:grid-cols-2">
          <FaucetForm />
          <TrackBatch />
        </div>
      </RequireWallet>
    </div>
  );
}
