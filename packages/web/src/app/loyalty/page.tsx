"use client";

import { useMemo } from "react";
import type { Address } from "viem";
import { useLoyalty } from "@/hooks/useRewards";
import { useContractLogs } from "@/hooks/useContractLogs";
import { PageHeader, KpiRow } from "@/components/page";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Callout } from "@/components/ui/Callout";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressLink } from "@/components/ui/TxLink";
import { RequireWallet } from "@/components/RequireWallet";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";

const ZERO = "0x0000000000000000000000000000000000000000";

interface AwardRow {
  readonly key: string;
  readonly to: Address;
  readonly amount: bigint;
}

/**
 * Loyalty points: soul-bound (or transferable) rewards minted for on-time, clean
 * deliveries. Shows the connected holder's balance, supply, and a live feed of
 * recent awards reconstructed from mint `Transfer` events.
 */
export default function LoyaltyPage() {
  const loyalty = useLoyalty();
  const logs = useContractLogs({ name: "LoyaltyPoints", eventName: "Transfer" });

  const awards = useMemo<AwardRow[]>(() => {
    return logs.logs
      .filter((log) => String(log.args.from).toLowerCase() === ZERO)
      .map((log) => ({
        key: `${log.transactionHash}-${log.logIndex}`,
        to: (log.args.to as Address) ?? ZERO,
        amount: typeof log.args.value === "bigint" ? log.args.value : 0n,
      }));
  }, [logs.logs]);

  const columns: readonly Column<AwardRow>[] = [
    { id: "to", header: "Recipient", cell: (r) => <AddressLink address={r.to} /> },
    {
      id: "amount",
      header: "Points",
      align: "right",
      cell: (r) => <span className="font-mono">{formatTokenAmount(r.amount, 18)}</span>,
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        icon="loyalty"
        title="Loyalty"
        subtitle="Points awarded for on-time, dispute-free deliveries across the network."
        breadcrumbs={[{ label: "Rewards" }, { label: "Loyalty" }]}
        actions={
          loyalty.deployed ? (
            <Badge tone={loyalty.transferable ? "brand" : "neutral"}>
              {loyalty.transferable ? "Transferable" : "Non-transferable"}
            </Badge>
          ) : null
        }
      />

      <RequireWallet>
        <KpiRow
          items={[
            {
              label: "Your points",
              value: loyalty.deployed ? formatTokenAmount(loyalty.balance, 18) : "—",
              loading: loyalty.isLoading,
            },
            {
              label: "Points in circulation",
              value: loyalty.deployed ? formatTokenAmount(loyalty.totalSupply, 18) : "—",
            },
            {
              label: "Transferability",
              value: loyalty.deployed ? (loyalty.transferable ? "Enabled" : "Locked") : "—",
              hint: loyalty.transferable ? "Points can be moved" : "Soul-bound to earner",
            },
          ]}
        />
      </RequireWallet>

      {!loyalty.deployed ? (
        <Callout tone="warn" title="LoyaltyPoints not deployed">
          The LoyaltyPoints contract is not configured on this network.
        </Callout>
      ) : (
        <Card>
          <CardHeader
            title="Recent awards"
            description="Points minted to participants, newest first."
          />
          <DataTable
            columns={columns}
            rows={awards}
            getRowKey={(r) => r.key}
            isLoading={logs.isLoading}
            error={logs.isError ? getErrorMessage(logs.error) : null}
            onRetry={logs.refetch}
            emptyTitle="No awards yet"
            emptyDescription="Loyalty points appear here as deliveries settle cleanly."
          />
        </Card>
      )}
    </div>
  );
}
