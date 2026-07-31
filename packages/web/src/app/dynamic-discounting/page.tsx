"use client";

import { formatBps } from "@/lib/format";
import { getResolvedAddress } from "@/lib/shared";
import { useDiscountParams } from "@/hooks/financeDiscount";
import { useUsdc } from "@/hooks/useUsdc";
import { PageHeader } from "@/components/page";
import { KpiRow } from "@/components/ui/KpiRow";
import { Callout } from "@/components/ui/Callout";
import { DiscountQuoteCard } from "@/components/t2/DiscountQuoteCard";
import { NotDeployedState } from "@/components/t2/NotDeployedState";

export default function DynamicDiscountingPage() {
  const deployed = Boolean(getResolvedAddress("DiscountCalculator"));
  const params = useDiscountParams();
  const usdc = useUsdc();

  return (
    <div className="space-y-6">
      <PageHeader
        icon="finance"
        accentClassName="text-finance"
        title="Dynamic discounting"
        subtitle="Buyers pay suppliers early in exchange for a sliding, risk- and tenor-priced discount."
        breadcrumbs={[{ label: "Trade Finance" }, { label: "Dynamic Discounting" }]}
      />

      {!deployed ? (
        <NotDeployedState contract="DiscountCalculator" />
      ) : (
        <>
          <KpiRow
            loading={params.isLoading}
            items={[
              { label: "Daily rate", value: formatBps(params.dailyBps), hint: "Per day of tenor" },
              { label: "Grade step", value: formatBps(params.gradeStepBps), hint: "Added per risk grade" },
              { label: "Max discount", value: formatBps(params.maxDiscountBps), hintTone: "warn", hint: "Cap" },
              { label: "Worst grade priced", value: params.maxGrade },
            ]}
          />

          <Callout tone="info" title="Sliding-scale pricing">
            The discount grows with both the supplier&apos;s risk grade and the remaining tenor, capped at the maximum
            discount. Enter a scenario below to see the advance the calculator would release today, read live from chain.
          </Callout>

          <DiscountQuoteCard decimals={usdc.decimals} symbol={usdc.symbol} maxGrade={params.maxGrade} />
        </>
      )}
    </div>
  );
}
