"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Card, CardHeader, Field, Input } from "@/components/ui";
import { FormLayout } from "@/components/ui/Form";
import { computeDuty, formatAmount } from "./compliance-schemas";

const numberString = (max: number) =>
  z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Enter a number")
    .refine((v) => Number(v) >= 0 && Number(v) <= max, `Must be between 0 and ${max}`);

const schema = z.object({
  value: z
    .string()
    .trim()
    .regex(/^\d+(\.\d+)?$/, "Enter a value")
    .refine((v) => Number(v) > 0, "Must be greater than zero"),
  currency: z.string().trim().min(1, "Required").max(8),
  dutyRatePct: numberString(100),
  vatRatePct: numberString(100),
});
type FormValues = z.infer<typeof schema>;

/**
 * A client-side landed-cost calculator: customs value + duty% + VAT% → payable
 * duty, VAT, and total. Validated with zod + react-hook-form; rates entered as
 * percentages are converted to basis points for the shared `computeDuty`.
 */
export function DutyCalculatorForm() {
  const {
    register,
    watch,
    formState: { errors, isValid },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    mode: "onChange",
    defaultValues: { value: "", currency: "USD", dutyRatePct: "5", vatRatePct: "20" },
  });

  const values = watch();
  const result = isValid
    ? computeDuty(Number(values.value), Number(values.dutyRatePct) * 100, Number(values.vatRatePct) * 100)
    : null;
  const currency = values.currency || "USD";

  return (
    <Card>
      <CardHeader title="Duty & tariff calculator" description="Estimate landed cost from customs value and rates." />
      <FormLayout onSubmit={(e) => e.preventDefault()}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Customs value" htmlFor="duty-value" error={errors.value?.message}>
            <Input id="duty-value" inputMode="decimal" placeholder="100000" {...register("value")} />
          </Field>
          <Field label="Currency" htmlFor="duty-currency" error={errors.currency?.message}>
            <Input id="duty-currency" placeholder="USD" {...register("currency")} />
          </Field>
          <Field label="Duty rate (%)" htmlFor="duty-rate" error={errors.dutyRatePct?.message}>
            <Input id="duty-rate" inputMode="decimal" placeholder="5" {...register("dutyRatePct")} />
          </Field>
          <Field label="VAT rate (%)" htmlFor="vat-rate" error={errors.vatRatePct?.message}>
            <Input id="vat-rate" inputMode="decimal" placeholder="20" {...register("vatRatePct")} />
          </Field>
        </div>

        <dl className="grid grid-cols-3 gap-3 rounded-lg border border-border bg-surface-2/50 p-4 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Duty</dt>
            <dd className="mt-1 font-semibold text-fg">{result ? formatAmount(result.duty, currency) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">VAT</dt>
            <dd className="mt-1 font-semibold text-fg">{result ? formatAmount(result.vat, currency) : "—"}</dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-muted">Landed total</dt>
            <dd className="mt-1 font-semibold text-brand">{result ? formatAmount(result.total, currency) : "—"}</dd>
          </div>
        </dl>
      </FormLayout>
    </Card>
  );
}
