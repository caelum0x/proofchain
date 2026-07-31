import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { ToneName } from "@/lib/format";

const TONES: Record<ToneName, string> = {
  neutral: "bg-surface-2 text-muted border-border",
  brand: "bg-brand/15 text-brand border-brand/30",
  success: "bg-success/15 text-success border-success/30",
  warn: "bg-warn/15 text-warn border-warn/30",
  danger: "bg-danger/15 text-danger border-danger/30",
};

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: ToneName;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}
