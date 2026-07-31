"use client";

import { useMemo, useState } from "react";
import { RISK_GRADE_LABELS } from "@proofchain/shared";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Spinner } from "@/components/ui/Spinner";
import { parseTokenInput } from "@/lib/amount";
import { formatBps, formatTokenAmount } from "@/lib/format";
import { useDiscountQuote } from "@/hooks/financeDiscount";

interface DiscountQuoteCardProps {
  readonly decimals: number;
  readonly symbol: string;
  readonly maxGrade: number;
  readonly title?: string;
  readonly description?: string;
}

/**
 * Interactive early-payment pricing tool. Reads the on-chain DiscountCalculator
 * live for the entered face value, supplier risk grade and tenor, showing the
 * advance payable now and the effective discount. Read-only (no transaction).
 */
export function DiscountQuoteCard({
  decimals,
  symbol,
  maxGrade,
  title = "Early-payment quote",
  description = "Estimate the advance an early payment would release today.",
}: DiscountQuoteCardProps) {
  const [face, setFace] = useState("");
  const [grade, setGrade] = useState("2");
  const [tenor, setTenor] = useState("30");

  const parsed = parseTokenInput(face || "", decimals);
  const tenorDays = Math.max(0, Number(tenor) || 0);
  const gradeNum = Number(grade) || 0;
  const quote = useDiscountQuote(parsed.value, gradeNum, tenorDays);

  const gradeOptions = useMemo(
    () =>
      Array.from({ length: Math.max(1, maxGrade) }, (_, i) => {
        const g = i + 1;
        return { value: String(g), label: RISK_GRADE_LABELS[g] ?? `Grade ${g}` };
      }),
    [maxGrade],
  );

  const discountAmount =
    parsed.value !== null && quote.advance !== null ? parsed.value - quote.advance : null;

  return (
    <Card>
      <CardHeader title={title} description={description} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label={`Face value (${symbol})`} htmlFor="dq-face" error={face ? parsed.error ?? undefined : undefined}>
          <Input id="dq-face" inputMode="decimal" placeholder="10000" value={face} onChange={(e) => setFace(e.target.value)} />
        </Field>
        <Field label="Risk grade" htmlFor="dq-grade">
          <Select id="dq-grade" options={gradeOptions} value={grade} onChange={(e) => setGrade(e.target.value)} />
        </Field>
        <Field label="Tenor (days)" htmlFor="dq-tenor">
          <Input id="dq-tenor" inputMode="numeric" placeholder="30" value={tenor} onChange={(e) => setTenor(e.target.value)} />
        </Field>
      </div>

      <div className="mt-2 grid gap-3 sm:grid-cols-3">
        <Quote label="Advance now" value={quote.advance !== null ? `${formatTokenAmount(quote.advance, decimals)} ${symbol}` : "—"} loading={quote.isLoading} accent />
        <Quote label="Discount" value={quote.discountBps !== null ? formatBps(quote.discountBps) : "—"} loading={quote.isLoading} />
        <Quote
          label="Discount amount"
          value={discountAmount !== null ? `${formatTokenAmount(discountAmount, decimals)} ${symbol}` : "—"}
          loading={quote.isLoading}
        />
      </div>
    </Card>
  );
}

function Quote({ label, value, loading, accent }: { label: string; value: string; loading?: boolean; accent?: boolean }) {
  return (
    <div className="rounded-lg border border-border bg-surface-2/40 p-3">
      <p className="text-xs uppercase tracking-wide text-muted">{label}</p>
      {loading ? (
        <Spinner className="mt-1 h-4 w-4 text-brand" />
      ) : (
        <p className={`mt-1 font-mono text-lg font-semibold tabular-nums ${accent ? "text-brand" : "text-fg"}`}>{value}</p>
      )}
    </div>
  );
}
