"use client";

import { RISK_GRADE_LABELS } from "@proofchain/shared";
import { Card, CardHeader } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { formatBps, formatTimestamp, formatTokenAmount } from "@/lib/format";
import { riskGradeTone } from "@/lib/finance";
import type { ReceivableView } from "@/hooks/useReceivable";

interface ReceivableSummaryProps {
  readonly receivable: ReceivableView;
  readonly attestationScore: number | null;
  readonly decimals: number;
  readonly symbol: string;
}

/** Terms, risk grade, discounted advance, and NFT status for a receivable. */
export function ReceivableSummary({ receivable, attestationScore, decimals, symbol }: ReceivableSummaryProps) {
  const { terms, grade, advance } = receivable;

  return (
    <Card>
      <CardHeader
        title="Receivable"
        description="On-chain terms and financing economics."
        action={
          <div className="flex gap-2">
            {grade > 0 ? (
              <Badge tone={riskGradeTone(grade)}>Grade {RISK_GRADE_LABELS[grade] ?? grade}</Badge>
            ) : (
              <Badge tone="neutral">Ungraded</Badge>
            )}
            {attestationScore !== null ? <Badge tone="brand">Score {formatBps(attestationScore)}</Badge> : null}
          </div>
        }
      />

      {terms ? (
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Face value</dt>
            <dd className="mt-1 font-semibold text-fg">
              {formatTokenAmount(terms.faceValue, decimals)} {symbol}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Due date</dt>
            <dd className="mt-1 font-semibold text-fg">{formatTimestamp(Number(terms.dueDate))}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Obligor</dt>
            <dd className="mt-1"><AddressBadge address={terms.obligor} /></dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Advance (grade-adjusted)</dt>
            <dd className="mt-1 font-semibold text-fg">
              {advance !== null ? `${formatTokenAmount(advance, decimals)} ${symbol}` : "—"}
            </dd>
          </div>
        </dl>
      ) : (
        <p className="text-sm text-muted">No receivable terms registered for this batch yet.</p>
      )}

      <div className="mt-4 border-t border-border pt-3 text-sm">
        <span className="text-xs uppercase tracking-wide text-muted">Receivable NFT</span>
        {receivable.nftOwner ? (
          <p className="mt-1 flex items-center gap-2 text-fg">
            Held by <AddressBadge address={receivable.nftOwner} />
          </p>
        ) : (
          <p className="mt-1 text-muted">Not minted yet — minted automatically for funded, attested deals.</p>
        )}
      </div>
    </Card>
  );
}
