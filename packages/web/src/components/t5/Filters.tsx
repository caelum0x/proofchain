"use client";

import { useId, type ReactNode } from "react";
import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Field";
import { Select, type SelectOption } from "@/components/ui/Select";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";

/** Search box for a toolbar's left cluster — controlled, debounce-free (URL is truth). */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  className,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly className?: string;
}) {
  const id = useId();
  return (
    <div className={cn("relative", className)}>
      <Icon name="search" size={15} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <Input
        id={id}
        type="search"
        role="searchbox"
        aria-label={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        className="w-56 pl-8"
      />
    </div>
  );
}

/** A compact labelled facet select for the FilterBar. */
export function SelectFilter({
  label,
  value,
  onChange,
  options,
  allLabel = "All",
  className,
}: {
  readonly label: string;
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly options: readonly SelectOption[];
  readonly allLabel?: string;
  readonly className?: string;
}) {
  const id = useId();
  const withAll: readonly SelectOption[] = [{ value: "", label: allLabel }, ...options];
  return (
    <label htmlFor={id} className={cn("inline-flex items-center gap-2 text-xs text-muted", className)}>
      <span className="whitespace-nowrap">{label}</span>
      <Select
        id={id}
        aria-label={label}
        options={withAll}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-40 py-1.5 text-sm"
      />
    </label>
  );
}

/** Client-side CSV export button. */
export function ExportButton({
  filename,
  getCsv,
  disabled,
  children = "Export",
}: {
  readonly filename: string;
  readonly getCsv: () => string;
  readonly disabled?: boolean;
  readonly children?: ReactNode;
}) {
  const onExport = () => {
    const csv = getCsv();
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };
  return (
    <Button variant="secondary" size="sm" onClick={onExport} disabled={disabled}>
      <Icon name="download" size={15} />
      {children}
    </Button>
  );
}
