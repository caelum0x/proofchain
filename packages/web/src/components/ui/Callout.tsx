import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon, type IconName } from "./Icon";

export type CalloutTone = "info" | "success" | "warn" | "danger" | "neutral";

const TONES: Record<CalloutTone, { box: string; icon: string; glyph: IconName }> = {
  info: { box: "border-info/30 bg-info/10", icon: "text-info", glyph: "info" },
  success: { box: "border-success/30 bg-success/10", icon: "text-success", glyph: "check" },
  warn: { box: "border-warn/30 bg-warn/10", icon: "text-warn", glyph: "warning" },
  danger: { box: "border-danger/30 bg-danger/10", icon: "text-danger", glyph: "error" },
  neutral: { box: "border-border bg-surface-2", icon: "text-muted", glyph: "info" },
};

export interface CalloutProps {
  readonly tone?: CalloutTone;
  readonly title?: ReactNode;
  readonly children?: ReactNode;
  readonly icon?: IconName;
  readonly action?: ReactNode;
  readonly className?: string;
}

/** A bordered inline notice for tips, warnings, and errors. */
export function Callout({ tone = "info", title, children, icon, action, className }: CalloutProps) {
  const t = TONES[tone];
  return (
    <div
      className={cn("flex items-start gap-3 rounded-lg border p-3.5", t.box, className)}
      role={tone === "danger" || tone === "warn" ? "alert" : "note"}
    >
      <Icon name={icon ?? t.glyph} size={18} className={cn("mt-0.5", t.icon)} />
      <div className="min-w-0 flex-1">
        {title ? <p className="text-sm font-semibold text-fg">{title}</p> : null}
        {children ? <div className="text-sm text-fg/80">{children}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
