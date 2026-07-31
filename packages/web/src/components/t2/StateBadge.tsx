import { InvoiceListingState, invoiceListingStateLabel } from "@proofchain/shared";
import { StatusBadge, type SemanticStatus } from "@/components/ui/StatusBadge";
import { dealStateLabel, dealStateTone, type ToneName } from "@/lib/format";
import { invoiceListingStateTone } from "@/lib/finance";
import type { DealStateValue } from "@/lib/types";

/** Map a legacy `ToneName` onto the StatusBadge semantic vocabulary. */
function toStatus(tone: ToneName): SemanticStatus {
  return tone === "brand" ? "brand" : tone;
}

/** Status pill for a settlement escrow deal state. */
export function DealStateBadge({ state }: { state: DealStateValue }) {
  return <StatusBadge status={toStatus(dealStateTone(state))}>{dealStateLabel(state)}</StatusBadge>;
}

/** Status pill for an invoice-financing listing state. */
export function ListingStateBadge({ state }: { state: InvoiceListingState }) {
  return (
    <StatusBadge status={toStatus(invoiceListingStateTone(state))}>
      {invoiceListingStateLabel(state)}
    </StatusBadge>
  );
}
