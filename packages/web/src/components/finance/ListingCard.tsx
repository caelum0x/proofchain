"use client";

import { useState } from "react";
import Link from "next/link";
import { useAccount } from "wagmi";
import { InvoiceListingState, invoiceListingStateLabel } from "@proofchain/shared";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { TxLink } from "@/components/ui/TxLink";
import { useTx } from "@/hooks/useTx";
import { useUsdc } from "@/hooks/useUsdc";
import { contractRef, usdcContract } from "@/lib/contracts";
import { getResolvedAddress } from "@/lib/shared";
import { formatTokenAmount, shortenHex } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { invoiceListingStateTone, type FinancingListingRecord } from "@/lib/finance";

interface ListingCardProps {
  readonly record: FinancingListingRecord;
  readonly decimals: number;
  readonly symbol: string;
  readonly onChanged?: () => void;
}

/**
 * A single invoice-financing listing with contextual on-chain actions:
 * lenders fund open listings (approve → fund), the supplier can cancel, and
 * anyone can trigger claim distribution once the deal settles.
 */
export function ListingCard({ record, decimals, symbol, onChanged }: ListingCardProps) {
  const { address: account } = useAccount();
  const financingAddr = getResolvedAddress("InvoiceFinancing");
  const usdc = useUsdc(financingAddr);
  const [formError, setFormError] = useState<string | null>(null);

  const approveTx = useTx({ successLabel: "Approval confirmed", onConfirmed: () => usdc.refetch() });
  const fundTx = useTx({ successLabel: "Listing funded", onConfirmed: onChanged });
  const cancelTx = useTx({ successLabel: "Listing cancelled", onConfirmed: onChanged });
  const claimTx = useTx({ successLabel: "Proceeds distributed", onConfirmed: onChanged });

  const isSupplier = Boolean(account && record.supplier && account.toLowerCase() === record.supplier.toLowerCase());
  const ask = record.askAmount ?? 0n;
  const needsApproval = ask > 0n && usdc.allowance < ask;
  const busy = approveTx.isBusy || fundTx.isBusy || cancelTx.isBusy || claimTx.isBusy;

  const onApprove = async () => {
    setFormError(null);
    if (!financingAddr || ask <= 0n) return;
    try {
      await approveTx.submit({ ...usdcContract(), functionName: "approve", args: [financingAddr, ask] });
    } catch (error) {
      approveTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  const onFund = async () => {
    setFormError(null);
    try {
      await fundTx.submit({ ...contractRef("InvoiceFinancing"), functionName: "fund", args: [record.batchId] });
    } catch (error) {
      fundTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  const onCancel = async () => {
    setFormError(null);
    try {
      await cancelTx.submit({ ...contractRef("InvoiceFinancing"), functionName: "cancel", args: [record.batchId] });
    } catch (error) {
      cancelTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  const onClaim = async () => {
    setFormError(null);
    try {
      await claimTx.submit({ ...contractRef("InvoiceFinancing"), functionName: "claim", args: [record.batchId] });
    } catch (error) {
      claimTx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  return (
    <Card className="flex flex-col gap-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            href={`/invoices/${record.batchId}`}
            className="font-mono text-sm font-medium text-fg hover:text-brand"
            title={record.batchId}
          >
            {shortenHex(record.batchId, 6, 6)}
          </Link>
          {record.supplier ? (
            <p className="mt-1 flex items-center gap-1 text-xs text-muted">
              Supplier <AddressBadge address={record.supplier} explorer={false} copyable={false} />
            </p>
          ) : null}
        </div>
        <Badge tone={invoiceListingStateTone(record.state)}>{invoiceListingStateLabel(record.state)}</Badge>
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-xs uppercase tracking-wide text-muted">Ask amount</span>
        <span className="text-lg font-semibold text-fg">
          {formatTokenAmount(ask, decimals)} {symbol}
        </span>
      </div>

      {record.lender ? (
        <p className="flex items-center gap-1 text-xs text-muted">
          Funded by <AddressBadge address={record.lender} explorer={false} copyable={false} />
        </p>
      ) : null}

      {formError ? <p className="field-error">{formError}</p> : null}

      <div className="flex flex-wrap gap-2">
        {record.state === InvoiceListingState.Listed && !isSupplier ? (
          needsApproval ? (
            <Button size="sm" onClick={onApprove} loading={approveTx.isBusy} disabled={busy}>
              Approve {symbol}
            </Button>
          ) : (
            <Button size="sm" onClick={onFund} loading={fundTx.isBusy} disabled={busy}>
              Fund listing
            </Button>
          )
        ) : null}

        {record.state === InvoiceListingState.Listed && isSupplier ? (
          <Button size="sm" variant="secondary" onClick={onCancel} loading={cancelTx.isBusy} disabled={busy}>
            Cancel
          </Button>
        ) : null}

        {record.state === InvoiceListingState.Funded ? (
          <Button size="sm" variant="secondary" onClick={onClaim} loading={claimTx.isBusy} disabled={busy}>
            Distribute proceeds
          </Button>
        ) : null}

        <Link href={`/invoices/${record.batchId}`}>
          <Button size="sm" variant="ghost">
            Details
          </Button>
        </Link>
      </div>

      {approveTx.hash ? (
        <p className="text-xs text-muted">Approve: <TxLink hash={approveTx.hash} /></p>
      ) : null}
      {fundTx.hash ? <p className="text-xs text-muted">Fund: <TxLink hash={fundTx.hash} /></p> : null}
      {claimTx.hash ? <p className="text-xs text-muted">Claim: <TxLink hash={claimTx.hash} /></p> : null}
    </Card>
  );
}
