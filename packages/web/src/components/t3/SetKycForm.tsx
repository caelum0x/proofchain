"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { isAddress } from "viem";
import type { Address } from "viem";
import { Card, CardHeader, Field, Input, Select, TxButton } from "@/components/ui";
import { FormLayout, FormActions } from "@/components/ui/Form";
import { contractRef } from "@/lib/contracts";
import { KYC_LEVEL_LABELS } from "./compliance-schemas";

const schema = z.object({
  account: z.string().trim().refine((v): boolean => isAddress(v), "Enter a valid EVM address"),
  level: z.enum(["0", "1", "2", "3"]),
});
type FormValues = z.infer<typeof schema>;

const LEVEL_OPTIONS = Object.entries(KYC_LEVEL_LABELS).map(([value, label]) => ({
  value,
  label: `${value} — ${label}`,
}));

export interface SetKycFormProps {
  readonly onChanged?: () => void;
}

/**
 * KYC administration (KYC_ADMIN only): set an account's KYC tier or revoke it.
 * Validated with zod + react-hook-form; the on-chain write runs through
 * `TxButton` for the full approve→sign→confirm lifecycle (WD §7).
 */
export function SetKycForm({ onChanged }: SetKycFormProps) {
  const {
    register,
    getValues,
    trigger,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { account: "", level: "1" },
  });

  const buildSet = async () => {
    if (!(await trigger())) return null;
    const { account, level } = getValues();
    return {
      ...contractRef("KYCRegistry"),
      functionName: "setKyc",
      args: [account as Address, Number(level)],
    } as const;
  };

  const buildRevoke = async () => {
    if (!(await trigger("account"))) return null;
    const { account } = getValues();
    return {
      ...contractRef("KYCRegistry"),
      functionName: "revokeKyc",
      args: [account as Address],
    } as const;
  };

  return (
    <Card>
      <CardHeader title="Set KYC status" description="Grant or revoke an account's verification tier." />
      <FormLayout onSubmit={(e) => e.preventDefault()}>
        <Field label="Account address" htmlFor="kyc-account" error={errors.account?.message}>
          <Input id="kyc-account" placeholder="0x…" spellCheck={false} {...register("account")} />
        </Field>
        <Field label="KYC level" htmlFor="kyc-level" error={errors.level?.message}>
          <Select id="kyc-level" options={LEVEL_OPTIONS} {...register("level")} />
        </Field>
        <FormActions align="between">
          <TxButton
            variant="danger"
            write={buildRevoke}
            successLabel="KYC revoked"
            pendingLabel="Revoking KYC…"
            onConfirmed={onChanged}
          >
            Revoke
          </TxButton>
          <TxButton write={buildSet} successLabel="KYC updated" pendingLabel="Updating KYC…" onConfirmed={onChanged}>
            Set KYC
          </TxButton>
        </FormActions>
      </FormLayout>
    </Card>
  );
}
