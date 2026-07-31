"use client";

import { useCallback, useState } from "react";
import type { Address } from "viem";
import { cn } from "@/lib/cn";
import { shortenHex, explorerAddressUrl } from "@/lib/format";

interface AddressBadgeProps {
  readonly address: Address | string;
  /** Optional human label shown instead of the shortened hex. */
  readonly label?: string;
  /** Leading/trailing hex chars to keep when shortening (default 4/4). */
  readonly lead?: number;
  readonly tail?: number;
  /** Show a copy-to-clipboard button (default true). */
  readonly copyable?: boolean;
  /** Link out to the block explorer (default true). */
  readonly explorer?: boolean;
  readonly className?: string;
}

/**
 * Compact, copyable address chip with an optional block-explorer link. Safe to
 * render for any address-like string; falls back gracefully when the clipboard
 * API is unavailable (e.g. non-secure contexts) instead of throwing.
 */
export function AddressBadge({
  address,
  label,
  lead = 4,
  tail = 4,
  copyable = true,
  explorer = true,
  className,
}: AddressBadgeProps) {
  const [copied, setCopied] = useState(false);
  const text = String(address);
  const display = label ?? shortenHex(text, lead, tail);

  const onCopy = useCallback(async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 1200);
      }
    } catch {
      // Clipboard unavailable/denied — silently no-op, the address is still visible.
    }
  }, [text]);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs text-fg",
        className,
      )}
    >
      {explorer ? (
        <a
          href={explorerAddressUrl(text)}
          target="_blank"
          rel="noreferrer noopener"
          className="hover:text-brand"
          title={text}
        >
          {display}
        </a>
      ) : (
        <span title={text}>{display}</span>
      )}
      {copyable ? (
        <button
          type="button"
          onClick={onCopy}
          className="text-muted transition-colors hover:text-fg"
          aria-label={copied ? "Copied" : "Copy address"}
          title={copied ? "Copied" : "Copy address"}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
        </button>
      ) : null}
    </span>
  );
}

function CopyIcon() {
  return (
    <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <rect x="5.5" y="5.5" width="8" height="8" rx="1.5" stroke="currentColor" strokeWidth="1.2" />
      <path d="M10.5 5.5V4A1.5 1.5 0 0 0 9 2.5H4A1.5 1.5 0 0 0 2.5 4v5A1.5 1.5 0 0 0 4 10.5h1.5" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg className="h-3.5 w-3.5 text-success" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path d="m3.5 8.5 3 3 6-7" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
