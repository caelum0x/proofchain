"use client";

import { RequireWallet } from "@/components/RequireWallet";
import { PausePanel } from "@/components/admin/PausePanel";
import { ThresholdPanel } from "@/components/admin/ThresholdPanel";
import { FeePanel } from "@/components/admin/FeePanel";
import { TreasuryPanel } from "@/components/admin/TreasuryPanel";
import { AddressBookPanel } from "@/components/admin/AddressBookPanel";
import { RolePanel } from "@/components/admin/RolePanel";

export default function AdminPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Admin</h1>
        <p className="mt-1 text-sm text-muted">
          Protocol configuration and access control. Every action is role-gated on-chain — unauthorized
          calls revert and the reason is shown.
        </p>
      </div>

      <RequireWallet>
        <div className="grid gap-6 lg:grid-cols-2">
          <PausePanel />
          <ThresholdPanel />
          <FeePanel />
          <TreasuryPanel />
          <AddressBookPanel />
          <RolePanel />
        </div>
      </RequireWallet>
    </div>
  );
}
