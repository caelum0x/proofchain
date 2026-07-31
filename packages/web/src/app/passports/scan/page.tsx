"use client";

import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { normalizeBytes32 } from "@/lib/hashing";
import { PageHeader } from "@/components/page/PageHeader";
import { Card } from "@/components/ui/Card";
import { Callout } from "@/components/ui/Callout";
import { Field, Input } from "@/components/ui/Field";
import { FormLayout, FormSection, FormActions } from "@/components/ui/Form";
import { Button } from "@/components/ui/Button";

const scanSchema = z.object({
  reference: z
    .string()
    .trim()
    .min(1, "Enter a batch id or product reference."),
});

type ScanForm = z.infer<typeof scanSchema>;

/**
 * Provenance → Passports → Scan. Resolve a passport from a scanned/pasted batch
 * id or a human-readable product reference (hashed to its on-chain id), then
 * navigate to the passport. Client-side lookup — no transaction.
 */
export default function PassportScanPage() {
  const router = useRouter();
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ScanForm>({ resolver: zodResolver(scanSchema), defaultValues: { reference: "" } });

  const onSubmit = handleSubmit((values) => {
    const id = normalizeBytes32(values.reference);
    router.push(`/passports/${id}`);
  });

  return (
    <div className="space-y-6">
      <PageHeader
        icon="passport"
        accentClassName="text-dpp"
        breadcrumbs={[{ label: "Passports", href: "/passports" }, { label: "Scan" }]}
        title="Scan a passport"
        subtitle="Look up a digital product passport by its batch id or product reference."
      />

      <Card className="max-w-xl">
        <FormLayout onSubmit={onSubmit}>
          <FormSection
            title="Passport lookup"
            description="Paste a 32-byte batch id, or type the product reference used at registration — we derive its on-chain id automatically."
          >
            <Field label="Batch id or reference" htmlFor="reference" error={errors.reference?.message}>
              <Input
                id="reference"
                placeholder="0x… or e.g. COFFEE-LOT-2026-014"
                autoComplete="off"
                autoFocus
                {...register("reference")}
              />
            </Field>
            <Callout tone="info" title="How ids work">
              A raw <span className="font-mono">0x</span> value is used as-is; any other text is keccak256-hashed to
              its batch id, matching how batches are registered.
            </Callout>
          </FormSection>
          <FormActions>
            <Button type="submit" loading={isSubmitting}>
              Open passport
            </Button>
          </FormActions>
        </FormLayout>
      </Card>
    </div>
  );
}
