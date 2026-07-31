import { forwardRef, type InputHTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  readonly label?: ReactNode;
  readonly description?: ReactNode;
}

/** Accessible checkbox with an optional inline label + description. */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(function Checkbox(
  { label, description, className, id, ...rest },
  ref,
) {
  const input = (
    <input
      ref={ref}
      id={id}
      type="checkbox"
      className={cn(
        "h-4 w-4 shrink-0 rounded border-border bg-surface-2 text-brand accent-brand",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50",
        className,
      )}
      {...rest}
    />
  );
  if (!label) return input;
  return (
    <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5">
      <span className="mt-0.5">{input}</span>
      <span className="min-w-0">
        <span className="block text-sm text-fg">{label}</span>
        {description ? <span className="block text-xs text-muted">{description}</span> : null}
      </span>
    </label>
  );
});
