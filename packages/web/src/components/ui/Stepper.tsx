import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export interface Step {
  readonly label: string;
  readonly description?: string;
}

export interface StepperProps {
  readonly steps: readonly Step[];
  /** Zero-based index of the current step. */
  readonly current: number;
  readonly className?: string;
}

/** Horizontal progress stepper for multi-stage flows (approve → write → done). */
export function Stepper({ steps, current, className }: StepperProps) {
  return (
    <ol className={cn("flex items-center", className)}>
      {steps.map((step, index) => {
        const done = index < current;
        const active = index === current;
        return (
          <li key={step.label} className={cn("flex items-center", index < steps.length - 1 && "flex-1")}>
            <div className="flex items-center gap-2.5">
              <span
                className={cn(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-full border text-xs font-semibold",
                  done && "border-brand bg-brand text-brand-fg",
                  active && "border-brand bg-brand/15 text-brand",
                  !done && !active && "border-border bg-surface-2 text-faint",
                )}
                aria-current={active ? "step" : undefined}
              >
                {done ? <Icon name="check" size={14} /> : index + 1}
              </span>
              <div className="min-w-0">
                <p className={cn("text-sm font-medium", active || done ? "text-fg" : "text-muted")}>{step.label}</p>
                {step.description ? <p className="truncate text-xs text-faint">{step.description}</p> : null}
              </div>
            </div>
            {index < steps.length - 1 ? (
              <span className={cn("mx-3 h-px flex-1", done ? "bg-brand" : "bg-border")} />
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
