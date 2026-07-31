"use client";

import { useMemo } from "react";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { deployedContracts } from "@/lib/contracts";

const MODULES: Readonly<Record<string, readonly string[]>> = {
  Core: ["AddressBook", "Pauser", "ProvenanceRegistry", "AttestationRegistry", "SettlementEscrow", "MockUSDC"],
  Identity: ["OrganizationRegistry", "SupplierRegistry", "BuyerRegistry", "CarrierRegistry", "KYCRegistry", "IdentityResolver"],
  Reputation: ["ReputationEngine", "SupplierBond", "StakeManager", "SlashingController", "ScoreOracle"],
  Finance: ["InvoiceNFT", "ReceivableRegistry", "InvoiceFinancing", "FinancingPool", "LenderVault", "DiscountCalculator", "YieldDistributor", "RepaymentController"],
  Insurance: ["InsurancePool", "PolicyManager", "ClaimsProcessor", "PremiumCalculator", "RiskPool"],
  Governance: ["DisputeArbitration", "ArbiterStaking", "GovernanceToken", "ProofChainGovernor", "ProofChainTimelock", "ProposalRegistry"],
  ESG: ["BatchNFT", "WarehouseReceipt", "CarbonCreditToken", "ESGRegistry", "SustainabilityOracle", "OffsetMarketplace"],
  Marketplace: ["ListingRegistry", "FinancingMarketplace", "AuctionHouse", "OrderBook", "BidManager"],
  Rewards: ["LoyaltyPoints", "RewardsDistributor", "StakingRewards", "ReferralProgram", "EmissionsController"],
};

/**
 * Live deployment coverage across the platform's contract modules. Reads the
 * resolved address map so operators can see, at a glance, which modules are
 * wired on the active network.
 */
export function ModuleStatus() {
  const deployed = useMemo(() => deployedContracts(), []);

  return (
    <Card>
      <CardHeader title="Module coverage" description="Deployed contracts per platform module on the active network." />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Object.entries(MODULES).map(([module, names]) => {
          const live = names.filter((n) => deployed[n as keyof typeof deployed]).length;
          const all = live === names.length;
          return (
            <div key={module} className="flex items-center justify-between rounded-lg border border-border bg-surface-2/40 px-3 py-2">
              <span className="text-sm font-medium text-fg">{module}</span>
              <Badge tone={all ? "success" : live > 0 ? "warn" : "neutral"}>
                {live}/{names.length}
              </Badge>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
