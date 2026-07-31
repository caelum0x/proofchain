"use client";

import { useState } from "react";
import { getAddress, isAddress } from "viem";
import { useReferralStatus, useReferralEvents } from "@/hooks/useReferrals";
import { useTx } from "@/hooks/useTx";
import { RequireWallet } from "@/components/RequireWallet";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { StatCard } from "@/components/ui/StatCard";
import { DataTable, type Column } from "@/components/ui/DataTable";
import { AddressLink } from "@/components/ui/TxLink";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { formatBps, formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import type { ReferralEventItem } from "@/hooks/useReferrals";

export default function ReferralsPage() {
  const status = useReferralStatus();
  const events = useReferralEvents();
  const [referrer, setReferrer] = useState("");
  const [error, setError] = useState<string | null>(null);

  const referTx = useTx({ successLabel: "Referral recorded", onConfirmed: () => { status.refetch(); events.refetch(); } });
  const claimTx = useTx({ successLabel: "Referral reward claimed", onConfirmed: () => status.refetch() });

  const onRefer = async () => {
    setError(null);
    if (!status.contract) return setError("ReferralProgram is not deployed.");
    if (!isAddress(referrer)) return setError("Enter a valid referrer address.");
    if (status.account && referrer.toLowerCase() === status.account.toLowerCase()) {
      return setError("You cannot refer yourself.");
    }
    try {
      await referTx.submit({
        address: status.contract.address,
        abi: status.contract.abi,
        functionName: "refer",
        args: [getAddress(referrer)],
      });
    } catch (e) {
      referTx.reset();
      setError(getErrorMessage(e));
    }
  };

  const onClaim = async () => {
    setError(null);
    if (!status.contract) return;
    try {
      await claimTx.submit({ address: status.contract.address, abi: status.contract.abi, functionName: "claimReferral", args: [] });
    } catch (e) {
      claimTx.reset();
      setError(getErrorMessage(e));
    }
  };

  const columns: readonly Column<ReferralEventItem>[] = [
    { id: "referrer", header: "Referrer", cell: (r) => <AddressLink address={r.referrer} /> },
    { id: "referee", header: "Referee", cell: (r) => <AddressLink address={r.referee} /> },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Referrals</h1>
        <p className="mt-1 text-sm text-muted">
          Refer new participants and earn a share of their converted activity. Attribution and payouts
          are recorded on-chain.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Pending reward" value={status.deployed ? formatTokenAmount(status.pendingReward, 18) : "—"} loading={status.isLoading} />
        <StatCard label="Reward rate" value={status.deployed ? formatBps(status.rewardBps) : "—"} />
        <StatCard label="Your referrer" value={status.hasReferrer ? "Set" : "None"} hint={status.hasReferrer ? "Attribution locked" : "You can set one"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Recent referrals" />
            {events.notDeployed ? (
              <p className="text-sm text-muted">ReferralProgram is not deployed on this network.</p>
            ) : (
              <DataTable
                columns={columns}
                rows={events.items}
                getRowKey={(r) => `${r.transactionHash}-${r.referee}`}
                isLoading={events.isLoading}
                error={events.isError ? getErrorMessage(events.error) : null}
                onRetry={events.refetch}
                emptyTitle="No referrals yet"
              />
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <RequireWallet>
            <Card>
              <CardHeader
                title="Set your referrer"
                action={status.hasReferrer ? <Badge tone="success">Attributed</Badge> : undefined}
              />
              {status.hasReferrer && status.referrer ? (
                <p className="text-sm text-muted">
                  You were referred by <AddressBadge address={status.referrer} />. Attribution is permanent.
                </p>
              ) : (
                <>
                  <Field label="Referrer address" htmlFor="ref-addr">
                    <Input id="ref-addr" placeholder="0x…" value={referrer} onChange={(e) => setReferrer(e.target.value)} />
                  </Field>
                  <Button onClick={onRefer} loading={referTx.isBusy}>
                    Record referral
                  </Button>
                </>
              )}
              {error ? <p className="field-error mt-3">{error}</p> : null}
            </Card>

            <Card>
              <CardHeader title="Claim rewards" />
              <p className="mb-3 text-sm text-muted">
                Pending: {formatTokenAmount(status.pendingReward, 18)}
              </p>
              <Button onClick={onClaim} loading={claimTx.isBusy} disabled={status.pendingReward === 0n}>
                Claim referral rewards
              </Button>
            </Card>

            {status.account ? (
              <Card>
                <CardHeader title="Your referral code" description="Share your address so others can attribute you." />
                <AddressBadge address={status.account} />
              </Card>
            ) : null}
          </RequireWallet>
        </div>
      </div>
    </div>
  );
}
