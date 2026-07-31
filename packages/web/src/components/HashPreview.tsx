"use client";

import { toast } from "sonner";
import { Button } from "./ui/Button";

/**
 * Shows a derived on-chain value (e.g. a hashed batchId) with a copy button, so
 * users can carry the exact bytes32 forward to later steps.
 */
export function HashPreview({ label, value }: { label: string; value: string }) {
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success(`Copied ${label}`);
    } catch {
      toast.error("Clipboard is unavailable in this browser.");
    }
  };

  return (
    <div className="mb-4 -mt-2 flex items-center justify-between gap-2 rounded-lg border border-border bg-surface-2/50 px-3 py-2">
      <div className="min-w-0">
        <p className="text-[10px] uppercase tracking-wide text-muted">{label}</p>
        <p className="truncate font-mono text-xs text-fg">{value}</p>
      </div>
      <Button type="button" size="sm" variant="ghost" onClick={copy}>
        Copy
      </Button>
    </div>
  );
}
