"use client";

import { Icon } from "@/components/ui/Icon";
import { Input } from "@/components/ui/Field";
import { cn } from "@/lib/cn";

interface SearchInputProps {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly placeholder?: string;
  readonly ariaLabel: string;
  readonly className?: string;
}

/** Search box with a leading icon, wired for controlled URL-synced filters. */
export function SearchInput({ value, onChange, placeholder, ariaLabel, className }: SearchInputProps) {
  return (
    <div className={cn("relative w-full max-w-sm", className)}>
      <Icon
        name="search"
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
      />
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={ariaLabel}
        className="pl-9"
      />
    </div>
  );
}
