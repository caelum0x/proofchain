import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { DomainAccent } from "@/design/tokens";

export type SemanticStatus = "neutral" | "info" | "success" | "warn" | "danger" | "brand";

const SEMANTIC: Record<SemanticStatus, string> = {
  neutral: "bg-surface-2 text-muted border-border",
  info: "bg-info/15 text-info border-info/30",
  success: "bg-success/15 text-success border-success/30",
  warn: "bg-warn/15 text-warn border-warn/30",
  danger: "bg-danger/15 text-danger border-danger/30",
  brand: "bg-brand/15 text-brand border-brand/30",
};

const DOMAIN: Record<DomainAccent, string> = {
  finance: "bg-finance/15 text-finance border-finance/30",
  compliance: "bg-compliance/15 text-compliance border-compliance/30",
  dpp: "bg-dpp/15 text-dpp border-dpp/30",
  logistics: "bg-logistics/15 text-logistics border-logistics/30",
  sustainability: "bg-sustainability/15 text-sustainability border-sustainability/30",
  workforce: "bg-workforce/15 text-workforce border-workforce/30",
  governance: "bg-governance/15 text-governance border-governance/30",
  markets: "bg-markets/15 text-markets border-markets/30",
};

export interface StatusBadgeProps {
  /** Semantic status or a domain accent. */
  readonly status?: SemanticStatus;
  readonly domain?: DomainAccent;
  /** Show a leading status dot. */
  readonly dot?: boolean;
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Pill badge for status semantics (success/warn/danger/…) or domain accents
 * (finance/compliance/…). Pass either `status` or `domain`.
 */
export function StatusBadge({
  status = "neutral",
  domain,
  dot = true,
  children,
  className,
}: StatusBadgeProps) {
  const tone = domain ? DOMAIN[domain] : SEMANTIC[status];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-pill border px-2.5 py-0.5 text-xs font-medium",
        tone,
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}
