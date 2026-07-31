"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { RequireWallet } from "@/components/RequireWallet";
import { RegisterBatchForm } from "@/components/forms/RegisterBatchForm";
import { AddCheckpointForm } from "@/components/forms/AddCheckpointForm";
import { VerifyForm } from "@/components/forms/VerifyForm";

export default function SupplierPage() {
  const [batchId, setBatchId] = useState<Hex | null>(null);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Supplier</h1>
        <p className="mt-1 text-sm text-muted">
          Register batches, append provenance checkpoints, and request AI verification.
        </p>
      </div>

      <RequireWallet>
        <div className="grid gap-6 lg:grid-cols-2">
          <RegisterBatchForm onRegistered={setBatchId} />
          <AddCheckpointForm defaultBatchId={batchId ?? undefined} />
        </div>
        <VerifyForm defaultBatchId={batchId ?? undefined} />
      </RequireWallet>
    </div>
  );
}
