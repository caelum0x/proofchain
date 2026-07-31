"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isAddress } from "viem";
import { useSafetyTrainings, usePayrollRuns, useSkills } from "@/hooks/useWorkforce";
import { PageHeader } from "@/components/page/PageHeader";
import { KpiRow } from "@/components/ui/KpiRow";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Button } from "@/components/ui/Button";
import { Icon, type IconName } from "@/components/ui/Icon";
import { fmtNumber } from "@/components/t5/format";
import { cn } from "@/lib/cn";

interface SectionLink {
  readonly href: string;
  readonly title: string;
  readonly description: string;
  readonly icon: IconName;
}

const SECTIONS: readonly SectionLink[] = [
  { href: "/safety-training", title: "Safety training", description: "Certifications and course completions.", icon: "shield" },
  { href: "/payroll", title: "Payroll", description: "On-chain wage disbursements.", icon: "payments" },
  { href: "/skills", title: "Skills", description: "Verified competencies and endorsements.", icon: "reputation" },
];

export default function WorkforcePage() {
  const router = useRouter();
  const [addr, setAddr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const safety = useSafetyTrainings({ limit: 1 });
  const payroll = usePayrollRuns({ limit: 1 });
  const skills = useSkills({ limit: 1 });

  const onLookup = (event: FormEvent) => {
    event.preventDefault();
    const trimmed = addr.trim();
    if (!isAddress(trimmed)) {
      setError("Enter a valid 0x… worker address");
      return;
    }
    setError(null);
    router.push(`/credentials/${trimmed}`);
  };

  const loading = safety.isLoading || payroll.isLoading || skills.isLoading;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Workforce"
        subtitle="Credentials, safety training, payroll, and verified skills for the network's labor force."
        breadcrumbs={[{ label: "Workforce" }]}
        icon="workforce"
        accentClassName="text-workforce"
      />

      <KpiRow
        loading={loading}
        items={[
          { label: "Safety records", value: fmtNumber(safety.total), icon: <Icon name="shield" size={18} /> },
          { label: "Payroll runs", value: fmtNumber(payroll.total), icon: <Icon name="payments" size={18} /> },
          { label: "Skill attestations", value: fmtNumber(skills.total), icon: <Icon name="reputation" size={18} /> },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="grid gap-4 sm:grid-cols-2 lg:col-span-2 lg:grid-cols-3">
          {SECTIONS.map((section) => (
            <Link key={section.href} href={section.href} className="group">
              <Card className="h-full transition-colors group-hover:border-workforce/50">
                <span className="mb-3 grid h-10 w-10 place-items-center rounded-lg bg-workforce/10 text-workforce">
                  <Icon name={section.icon} size={20} />
                </span>
                <h3 className="flex items-center gap-1 text-sm font-semibold text-fg">
                  {section.title}
                  <Icon name="arrow-right" size={14} className="text-faint transition-transform group-hover:translate-x-0.5" />
                </h3>
                <p className="mt-1 text-sm text-muted">{section.description}</p>
              </Card>
            </Link>
          ))}
        </div>

        <Card>
          <CardHeader title="Look up credentials" description="View a worker's verifiable credentials by address." />
          <form onSubmit={onLookup} noValidate>
            <Field label="Worker address" htmlFor="worker-address" error={error ?? undefined}>
              <Input
                id="worker-address"
                placeholder="0x…"
                value={addr}
                onChange={(event) => setAddr(event.target.value)}
                className={cn(error && "border-danger")}
              />
            </Field>
            <Button type="submit" className="w-full">
              View credentials
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
