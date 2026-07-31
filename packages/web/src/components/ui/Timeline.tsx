import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { SemanticStatus } from "./StatusBadge";

export interface TimelineEvent {
  readonly id: string;
  readonly title: ReactNode;
  readonly timestamp?: ReactNode;
  readonly description?: ReactNode;
  readonly tone?: SemanticStatus;
  readonly meta?: ReactNode;
}

const DOT: Record<SemanticStatus, string> = {
  neutral: "bg-muted",
  info: "bg-info",
  success: "bg-success",
  warn: "bg-warn",
  danger: "bg-danger",
  brand: "bg-brand",
};

export interface TimelineProps {
  readonly events: readonly TimelineEvent[];
  readonly className?: string;
}

/** Vertical event timeline (checkpoints, provenance trail, tx history). */
export function Timeline({ events, className }: TimelineProps) {
  return (
    <ol className={cn("relative space-y-5 border-l border-border pl-6", className)}>
      {events.map((event) => (
        <li key={event.id} className="relative">
          <span
            className={cn(
              "absolute -left-[27px] top-1 h-3 w-3 rounded-full ring-4 ring-bg",
              DOT[event.tone ?? "neutral"],
            )}
            aria-hidden="true"
          />
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <p className="text-sm font-medium text-fg">{event.title}</p>
            {event.timestamp ? <span className="font-mono text-xs text-faint">{event.timestamp}</span> : null}
          </div>
          {event.description ? <p className="mt-0.5 text-sm text-muted">{event.description}</p> : null}
          {event.meta ? <div className="mt-1.5">{event.meta}</div> : null}
        </li>
      ))}
    </ol>
  );
}
