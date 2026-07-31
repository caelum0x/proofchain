"use client";

import { AddressBadge, Card, CardHeader, LoadingState, StatusBadge } from "@/components/ui";
import type { KycStatus } from "@/hooks/useComplianceKyc";
import { kycLevelLabel, kycLevelTone } from "./compliance-schemas";

export interface KycStatusCardProps {
  readonly status: KycStatus;
  readonly title?: string;
  readonly emptyLabel?: string;
}

/**
 * Renders an account's on-chain KYC verification status from `KYCRegistry`:
 * verified flag + tier, with the account address. Used on the compliance
 * overview and the sanctions screening tool.
 */
export function KycStatusCard({ status, title = "KYC status", emptyLabel = "Enter an address to screen." }: KycStatusCardProps) {
  return (
    <Card className="space-y-3">
      <CardHeader title={title} />
      {!status.account ? (
        <p className="text-sm text-muted">{emptyLabel}</p>
      ) : status.isLoading ? (
        <LoadingState label="Checking registry…" />
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">Account</span>
            <AddressBadge address={status.account} />
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">Verification</span>
            <StatusBadge status={status.isVerified ? "success" : "danger"}>
              {status.isVerified ? "Verified" : "Unverified"}
            </StatusBadge>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted">KYC tier</span>
            <StatusBadge status={kycLevelTone(status.level)}>{kycLevelLabel(status.level)}</StatusBadge>
          </div>
        </div>
      )}
    </Card>
  );
}
