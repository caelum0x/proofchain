"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import type { Address } from "viem";
import { getAddress, isAddress } from "viem";
import { tryContractRef } from "@/lib/contracts";
import { useTx } from "@/hooks/useTx";
import { KYC_LEVEL_LABEL } from "@/hooks/useKyc";
import { getErrorMessage } from "@/lib/errors";
import { Card, CardHeader } from "@/components/ui/Card";
import { Field, Input } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { TxLink } from "@/components/ui/TxLink";

const isAddr = (v: string): boolean => isAddress(v);

const schema = z.object({
  account: z.string().refine(isAddr, "Enter a valid wallet address"),
  level: z.enum(["1", "2", "3"]),
});
type FormValues = z.infer<typeof schema>;

const LEVEL_OPTIONS = [1, 2, 3].map((l) => ({ value: String(l), label: `${l} — ${KYC_LEVEL_LABEL[l]}` }));

/**
 * KYC-provider console: assign a verification level to an account or revoke it.
 * Only rendered for accounts holding the provider/admin role — the contract
 * enforces access, but the UI reflects it too.
 */
export function KycAdminForm({ onDone }: { onDone?: () => void }) {
  const kyc = tryContractRef("KYCRegistry");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { account: "", level: "1" },
  });

  const setTx = useTx({ successLabel: "KYC level set", onConfirmed: () => onDone?.() });
  const revokeTx = useTx({ successLabel: "KYC revoked", onConfirmed: () => onDone?.() });

  if (!kyc) {
    return (
      <Card>
        <CardHeader title="KYC administration" />
        <p className="text-sm text-muted">KYCRegistry is not deployed on this network.</p>
      </Card>
    );
  }

  const onSet = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await setTx.submit({
        address: kyc.address,
        abi: kyc.abi,
        functionName: "setKyc",
        args: [getAddress(values.account) as Address, Number(values.level)],
      });
    } catch (error) {
      setTx.reset();
      setFormError(getErrorMessage(error));
    }
  });

  const onRevoke = handleSubmit(async (values) => {
    setFormError(null);
    try {
      await revokeTx.submit({
        address: kyc.address,
        abi: kyc.abi,
        functionName: "revokeKyc",
        args: [getAddress(values.account) as Address],
      });
    } catch (error) {
      revokeTx.reset();
      setFormError(getErrorMessage(error));
    }
  });

  return (
    <Card>
      <CardHeader
        title="KYC administration"
        description="Assign or revoke verification levels for counterparties."
      />
      <form className="space-y-4" noValidate>
        <Field label="Account" htmlFor="kyc-account" error={errors.account?.message}>
          <Input id="kyc-account" placeholder="0x…" {...register("account")} />
        </Field>
        <Field label="Verification level" htmlFor="kyc-level" error={errors.level?.message}>
          <Select id="kyc-level" options={LEVEL_OPTIONS} {...register("level")} />
        </Field>

        {formError ? <p className="field-error">{formError}</p> : null}

        <div className="flex flex-wrap gap-2 border-t border-border pt-4">
          <Button type="button" onClick={onSet} loading={setTx.isBusy}>
            Set level
          </Button>
          <Button
            type="button"
            variant="danger"
            onClick={onRevoke}
            loading={revokeTx.isBusy}
            disabled={!isAddress(watch("account"))}
          >
            Revoke
          </Button>
        </div>

        {[setTx.hash, revokeTx.hash].filter(Boolean).map((hash) => (
          <p key={hash} className="text-xs text-muted">
            Tx: <TxLink hash={hash as string} />
          </p>
        ))}
      </form>
    </Card>
  );
}
