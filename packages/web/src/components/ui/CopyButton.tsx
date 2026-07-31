"use client";

import { useCallback, useState } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export interface CopyButtonProps {
  /** Text placed on the clipboard. */
  readonly value: string;
  /** Optional visible label next to the icon. */
  readonly label?: string;
  readonly className?: string;
  readonly size?: number;
}

/** Copies `value` to the clipboard and shows a transient confirmation. */
export function CopyButton({ value, label, className, size = 14 }: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const onCopy = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch {
      // Clipboard unavailable — silently no-op.
    }
  }, [value]);

  return (
    <button
      type="button"
      onClick={onCopy}
      aria-label={copied ? "Copied" : `Copy${label ? ` ${label}` : ""}`}
      title={copied ? "Copied" : "Copy"}
      className={cn(
        "inline-flex items-center gap-1 rounded text-muted transition-colors hover:text-fg focus-ring",
        className,
      )}
    >
      <Icon name={copied ? "check" : "copy"} size={size} className={copied ? "text-success" : undefined} />
      {label ? <span className="text-xs">{label}</span> : null}
    </button>
  );
}
