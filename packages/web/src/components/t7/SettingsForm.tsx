"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAccount } from "wagmi";
import { env } from "@/lib/env";
import { settingsSchema, useSettings, type Settings } from "@/hooks/systemSettings";
import { useTheme, type Theme } from "@/components/ui/theme";
import { PageHeader } from "@/components/page";
import { FormLayout, FormSection, FormActions } from "@/components/ui/Form";
import { Field } from "@/components/ui/Field";
import { Select } from "@/components/ui/Select";
import { Switch } from "@/components/ui/Switch";
import { RadioGroup } from "@/components/ui/RadioGroup";
import { Card, CardHeader } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { AddressBadge } from "@/components/ui/AddressBadge";
import { StatusBadge } from "@/components/ui/StatusBadge";
import { LoadingState } from "@/components/ui/States";
import { toast } from "@/components/ui/Toast";

const PAGE_SIZE_OPTIONS = [
  { value: "10", label: "10 rows" },
  { value: "25", label: "25 rows" },
  { value: "50", label: "50 rows" },
  { value: "100", label: "100 rows" },
];

const CURRENCY_OPTIONS = [
  { value: "USDC", label: "USDC (token units)" },
  { value: "USD", label: "USD ($)" },
];

const VIEW_OPTIONS = [
  { value: "table", label: "Table", description: "Dense rows, ideal for scanning many records." },
  { value: "grid", label: "Grid", description: "Cards with more visual detail per item." },
];

const THEME_OPTIONS = [
  { value: "dark", label: "Dark", description: "The product default — industrial, low-glare." },
  { value: "light", label: "Light", description: "High-contrast light surfaces." },
];

/**
 * System → Settings (WD §3 FormLayout): user display + notification preferences,
 * validated with zod via react-hook-form and persisted client-side. Theme is
 * applied live through the shared theme context.
 */
export function SettingsForm() {
  const { settings, isLoaded, save, reset } = useSettings();
  const { theme, setTheme } = useTheme();
  const { address, isConnected } = useAccount();

  const {
    handleSubmit,
    reset: resetForm,
    watch,
    setValue,
    formState: { errors, isDirty },
  } = useForm<Settings>({
    resolver: zodResolver(settingsSchema),
    defaultValues: settings,
  });

  useEffect(() => {
    if (isLoaded) resetForm(settings);
  }, [isLoaded, settings, resetForm]);

  const values = watch();

  const onSubmit = handleSubmit((data) => {
    save(data);
    resetForm(data);
    toast.success("Settings saved");
  });

  const onReset = () => {
    reset();
    setTheme("dark");
    toast.success("Settings restored to defaults");
  };

  if (!isLoaded) {
    return (
      <div className="space-y-6">
        <PageHeader
          icon="settings"
          title="Settings"
          subtitle="Personalise how ProofChain looks and what it notifies you about."
          breadcrumbs={[{ label: "System" }, { label: "Settings" }]}
        />
        <LoadingState label="Loading preferences…" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        icon="settings"
        title="Settings"
        subtitle="Personalise how ProofChain looks and what it notifies you about."
        breadcrumbs={[{ label: "System" }, { label: "Settings" }]}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <FormLayout onSubmit={onSubmit} noValidate>
              <FormSection title="Appearance" description="Theme and default layout for list pages.">
                <Field label="Theme" htmlFor="theme">
                  <RadioGroup
                    options={THEME_OPTIONS}
                    value={theme}
                    onValueChange={(v) => setTheme(v as Theme)}
                    name="theme"
                  />
                </Field>
                <Field label="Default list view" htmlFor="defaultView">
                  <RadioGroup
                    options={VIEW_OPTIONS}
                    value={values.defaultView}
                    onValueChange={(v) => setValue("defaultView", v as Settings["defaultView"], { shouldDirty: true })}
                    name="defaultView"
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Rows per page" htmlFor="pageSize" error={errors.pageSize?.message}>
                    <Select
                      id="pageSize"
                      options={PAGE_SIZE_OPTIONS}
                      value={String(values.pageSize)}
                      onChange={(e) => setValue("pageSize", Number(e.target.value), { shouldDirty: true, shouldValidate: true })}
                    />
                  </Field>
                  <Field label="Display currency" htmlFor="currency" error={errors.currency?.message}>
                    <Select
                      id="currency"
                      options={CURRENCY_OPTIONS}
                      value={values.currency}
                      onChange={(e) => setValue("currency", e.target.value as Settings["currency"], { shouldDirty: true })}
                    />
                  </Field>
                </div>
              </FormSection>

              <FormSection title="Behaviour" description="Live updates and accessibility.">
                <Switch
                  id="liveEvents"
                  label="Live event toasts"
                  description="Show a toast when new on-chain events arrive."
                  checked={values.liveEvents}
                  onCheckedChange={(v) => setValue("liveEvents", v, { shouldDirty: true })}
                />
                <Switch
                  id="reduceMotion"
                  label="Reduce motion"
                  description="Minimise non-essential animations."
                  checked={values.reduceMotion}
                  onCheckedChange={(v) => setValue("reduceMotion", v, { shouldDirty: true })}
                />
              </FormSection>

              <FormSection title="Notifications" description="Which categories appear in your feed.">
                <Switch
                  id="notifyProvenance"
                  label="Provenance"
                  description="Batch registrations, checkpoints, attestations."
                  checked={values.notifyProvenance}
                  onCheckedChange={(v) => setValue("notifyProvenance", v, { shouldDirty: true })}
                />
                <Switch
                  id="notifySettlement"
                  label="Settlement"
                  description="Escrow funding, releases, and refunds."
                  checked={values.notifySettlement}
                  onCheckedChange={(v) => setValue("notifySettlement", v, { shouldDirty: true })}
                />
                <Switch
                  id="notifyDisputes"
                  label="Disputes"
                  description="Deals entering dispute and arbitration outcomes."
                  checked={values.notifyDisputes}
                  onCheckedChange={(v) => setValue("notifyDisputes", v, { shouldDirty: true })}
                />
              </FormSection>

              <FormActions align="between">
                <Button type="button" variant="ghost" onClick={onReset}>
                  Restore defaults
                </Button>
                <Button type="submit" disabled={!isDirty}>
                  Save changes
                </Button>
              </FormActions>
            </FormLayout>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Account" description="The wallet this session is using." />
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Wallet</span>
                {isConnected && address ? (
                  <AddressBadge address={address} />
                ) : (
                  <StatusBadge status="warn">Not connected</StatusBadge>
                )}
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-muted">Network</span>
                <StatusBadge status="info">Chain {env.chainId}</StatusBadge>
              </div>
            </div>
          </Card>

          <Card>
            <CardHeader title="Connection" description="Read-only environment configuration." />
            <dl className="space-y-2 text-sm">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">API</dt>
                <dd className="truncate font-mono text-xs text-fg/80">{env.apiUrl}</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-muted">RPC</dt>
                <dd className="truncate font-mono text-xs text-fg/80">{env.rpcUrl ?? "default"}</dd>
              </div>
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
