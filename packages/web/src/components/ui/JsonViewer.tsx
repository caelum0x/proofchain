"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";
import { CopyButton } from "./CopyButton";

export interface JsonViewerProps {
  /** Any JSON-serialisable value (bigint is stringified). */
  readonly data: unknown;
  readonly title?: string;
  /** Collapse nested objects deeper than this depth initially. */
  readonly collapsed?: boolean;
  readonly className?: string;
}

/** Serialise a value, rendering bigint safely. */
function stringify(data: unknown): string {
  return JSON.stringify(
    data,
    (_key, value) => (typeof value === "bigint" ? `${value.toString()}n` : value),
    2,
  );
}

/**
 * Read-only JSON inspector. Pretty-prints any serialisable value with a copy
 * button; collapsible when large. Dependency-free.
 */
export function JsonViewer({ data, title, collapsed = false, className }: JsonViewerProps) {
  const [open, setOpen] = useState(!collapsed);
  const text = stringify(data);

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border bg-surface-2", className)}>
      <div className="flex items-center justify-between border-b border-border px-3 py-1.5">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="font-mono text-xs text-faint transition-colors hover:text-fg"
          aria-expanded={open}
        >
          {open ? "▾" : "▸"} {title ?? "JSON"}
        </button>
        <CopyButton value={text} />
      </div>
      {open ? (
        <pre className="max-h-96 overflow-auto p-3 text-xs leading-relaxed">
          <code className="font-mono text-fg/90">{text}</code>
        </pre>
      ) : null}
    </div>
  );
}
