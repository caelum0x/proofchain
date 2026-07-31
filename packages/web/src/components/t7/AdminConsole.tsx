"use client";

import { RequireWallet } from "@/components/RequireWallet";
import { PausePanel } from "@/components/admin/PausePanel";
import { ThresholdPanel } from "@/components/admin/ThresholdPanel";
import { FeePanel } from "@/components/admin/FeePanel";
import { TreasuryPanel } from "@/components/admin/TreasuryPanel";
import { AddressBookPanel } from "@/components/admin/AddressBookPanel";
import { RolePanel } from "@/components/admin/RolePanel";
import { PageHeader } from "@/components/page";
import { Tabs, type TabItem } from "@/components/ui/Tabs";
import { Callout } from "@/components/ui/Callout";

/**
 * System → Admin (WD §3 template): protocol configuration + access control,
 * organised into tabs. Every panel preserves its original on-chain wiring; each
 * write is role-gated on-chain and surfaces the revert reason on failure.
 */
export function AdminConsole() {
  const tabs: readonly TabItem[] = [
    {
      id: "parameters",
      label: "Parameters",
      content: (
        <div className="grid gap-6 lg:grid-cols-2">
          <ThresholdPanel />
          <FeePanel />
        </div>
      ),
    },
    {
      id: "treasury",
      label: "Treasury",
      content: (
        <div className="grid gap-6 lg:grid-cols-2">
          <TreasuryPanel />
        </div>
      ),
    },
    {
      id: "access",
      label: "Access control",
      content: (
        <div className="grid gap-6 lg:grid-cols-2">
          <RolePanel />
          <PausePanel />
        </div>
      ),
    },
    {
      id: "addresses",
      label: "Addresses",
      content: (
        <div className="grid gap-6">
          <AddressBookPanel />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="admin"
        title="Admin"
        subtitle="Protocol configuration and access control."
        breadcrumbs={[{ label: "System" }, { label: "Admin" }]}
      />

      <Callout tone="warn" title="Role-gated actions">
        Every action here is enforced on-chain. Unauthorised calls revert and the reason is shown —
        nothing is bypassed client-side.
      </Callout>

      <RequireWallet>
        <Tabs items={tabs} />
      </RequireWallet>
    </div>
  );
}
