"use client";

import { useState } from "react";
import type { Hex } from "viem";
import { useAccount } from "wagmi";
import {
  InvoiceListingState,
  invoiceListingStateLabel,
  type InvoiceListing,
} from "@proofchain/shared";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { TxLink } from "@/components/ui/TxLink";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { useTx } from "@/hooks/useTx";
import { useUsdc } from "@/hooks/useUsdc";
import { contractRef, usdcContract } from "@/lib/contracts";
import { getResolvedAddress } from "@/lib/shared";
import { parseTokenInput } from "@/lib/amount";
import { formatTokenAmount } from "@/lib/format";
import { getErrorMessage } from "@/lib/errors";
import { invoiceListingStateTone } from "@/lib/finance";

interface InvoiceFinancingPanelProps {
  readonly batchId: Hex;
  readonly listing: InvoiceListing | null;
  readonly isSupplier: boolean;
  readonly attested: boolean;
  readonly decimals: number;
  readonly symbol: string;
  readonly claimQuote: { principal: bigint; remainder: bigint } | null;
  readonly onChanged?: () => void;
}

/**
 * Financing actions for a single receivable: the supplier lists it, a lender
 * funds it (approve → fund), and anyone distributes proceeds after settlement.
 */
export function InvoiceFinancingPanel({
  batchId,
  listing,
  isSupplier,
  attested,
  decimals,
  symbol,
  claimQuote,
  onChanged,
}: InvoiceFinancingPanelProps) {
  const { address: account } = useAccount();
  const financingAddr = getResolvedAddress("InvoiceFinancing");
  const usdc = useUsdc(financingAddr);
  const [ask, setAsk] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const listTx = useTx({ successLabel: "Receivable listed", onConfirmed: onChanged });
  const approveTx = useTx({ successLabel: "Approval confirmed", onConfirmed: () => usdc.refetch() });
  const fundTx = useTx({ successLabel: "Listing funded", onConfirmed: onChanged });
  const cancelTx = useTx({ successLabel: "Listing cancelled", onConfirmed: onChanged });
  const claimTx = useTx({ successLabel: "Proceeds distributed", onConfirmed: onChanged });
  const busy = listTx.isBusy || approveTx.isBusy || fundTx.isBusy || cancelTx.isBusy || claimTx.isBusy;

  const state = listing?.state ?? InvoiceListingState.None;
  const askAmount = listing?.askAmount ?? 0n;
  const needsApproval = askAmount > 0n && usdc.allowance < askAmount;
  const isOpenForListing = state === InvoiceListingState.None || state === InvoiceListingState.Cancelled;

  const run = async (tx: ReturnType<typeof useTx>, fn: () => Promise<unknown>) => {
    setFormError(null);
    try {
      await fn();
    } catch (error) {
      tx.reset();
      setFormError(getErrorMessage(error));
    }
  };

  const onList = () =>
    run(listTx, async () => {
      const parsed = parseTokenInput(ask, decimals);
      if (parsed.value === null) {
        setFormError(parsed.error ?? "Invalid amount");
        return;
      }
      await listTx.submit({ ...contractRef("InvoiceFinancing"), functionName: "list", args: [batchId, parsed.value] });
      setAsk("");
    });

  const onApprove = () =>
    run(approveTx, async () => {
      if (!financingAddr || askAmount <= 0n) return;
      await approveTx.submit({ ...usdcContract(), functionName: "approve", args: [financingAddr, askAmount] });
    });

  const onFund = () =>
    run(fundTx, () => fundTx.submit({ ...contractRef("InvoiceFinancing"), functionName: "fund", args: [batchId] }));

  const onCancel = () =>
    run(cancelTx, () => cancelTx.submit({ ...contractRef("InvoiceFinancing"), functionName: "cancel", args: [batchId] }));

  const onClaim = () =>
    run(claimTx, () => claimTx.submit({ ...contractRef("InvoiceFinancing"), functionName: "claim", args: [batchId] }));

  return (
    <Card>
      <CardHeader
        title="Financing"
        description="Advance cash against this receivable."
        action={<Badge tone={invoiceListingStateTone(state)}>{invoiceListingStateLabel(state)}</Badge>}
      />

      {askAmount > 0n ? (
        <div className="mb-4 flex items-baseline justify-between">
          <span className="text-xs uppercase tracking-wide text-muted">Ask amount</span>
          <span className="text-lg font-semibold text-fg">
            {formatTokenAmount(askAmount, decimals)} {symbol}
          </span>
        </div>
      ) : null}

      {listing?.lender && state !== InvoiceListingState.None ? (
        <p className="mb-3 flex items-center gap-1 text-xs text-muted">
          Lender <AddressBadge address={listing.lender} explorer={false} copyable={false} />
        </p>
      ) : null}

      {claimQuote && state === InvoiceListingState.Funded ? (
        <p className="mb-3 text-xs text-muted">
          On settlement: lender is repaid {formatTokenAmount(claimQuote.principal, decimals)} {symbol}, supplier receives{" "}
          {formatTokenAmount(claimQuote.remainder, decimals)} {symbol}.
        </p>
      ) : null}

      {formError ? <p className="field-error mb-3">{formError}</p> : null}

      {isOpenForListing ? (
        isSupplier ? (
          attested ? (
            <div className="space-y-3">
              <Field label={`Ask amount (${symbol})`} htmlFor="inv-ask">
                <Input id="inv-ask" inputMode="decimal" placeholder="1000" value={ask} onChange={(e) => setAsk(e.target.value)} />
              </Field>
              <Button onClick={onList} loading={listTx.isBusy} disabled={busy || ask === ""}>
                List for financing
              </Button>
            </div>
          ) : (
            <p className="text-sm text-muted">This batch must be attested before it can be financed.</p>
          )
        ) : (
          <p className="text-sm text-muted">Only the supplier can list this receivable for financing.</p>
        )
      ) : null}

      {state === InvoiceListingState.Listed ? (
        <div className="flex flex-wrap gap-2">
          {isSupplier ? (
            <Button variant="secondary" onClick={onCancel} loading={cancelTx.isBusy} disabled={busy}>
              Cancel listing
            </Button>
          ) : needsApproval ? (
            <Button onClick={onApprove} loading={approveTx.isBusy} disabled={busy || !account}>
              Approve {symbol}
            </Button>
          ) : (
            <Button onClick={onFund} loading={fundTx.isBusy} disabled={busy || !account}>
              Fund {formatTokenAmount(askAmount, decimals)} {symbol}
            </Button>
          )}
        </div>
      ) : null}

      {state === InvoiceListingState.Funded ? (
        <Button variant="secondary" onClick={onClaim} loading={claimTx.isBusy} disabled={busy}>
          Distribute proceeds
        </Button>
      ) : null}

      {state === InvoiceListingState.Claimed ? (
        <p className="text-sm text-success">Financing complete — proceeds distributed.</p>
      ) : null}

      <div className="mt-3 space-y-1">
        {listTx.hash ? <p className="text-xs text-muted">List: <TxLink hash={listTx.hash} /></p> : null}
        {fundTx.hash ? <p className="text-xs text-muted">Fund: <TxLink hash={fundTx.hash} /></p> : null}
        {claimTx.hash ? <p className="text-xs text-muted">Claim: <TxLink hash={claimTx.hash} /></p> : null}
      </div>
    </Card>
  );
}
