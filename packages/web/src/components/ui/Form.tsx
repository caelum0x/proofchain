import type { FormHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/cn";

/**
 * Presentational form scaffolding (WD §4). These compose with react-hook-form
 * + zod at the page level — pass RHF's `handleSubmit(onSubmit)` to `onSubmit`
 * and render `Field` children with `register`/`formState.errors`.
 */

export interface FormLayoutProps extends FormHTMLAttributes<HTMLFormElement> {
  readonly children: ReactNode;
}

/** A vertically spaced `<form>` container. */
export function FormLayout({ children, className, ...rest }: FormLayoutProps) {
  return (
    <form className={cn("space-y-6", className)} {...rest}>
      {children}
    </form>
  );
}

export interface FormSectionProps {
  readonly title?: ReactNode;
  readonly description?: ReactNode;
  readonly children: ReactNode;
  readonly className?: string;
}

/** A titled group of related fields. */
export function FormSection({ title, description, children, className }: FormSectionProps) {
  return (
    <section className={cn("space-y-4", className)}>
      {(title || description) && (
        <div>
          {title ? <h3 className="text-sm font-semibold text-fg">{title}</h3> : null}
          {description ? <p className="mt-0.5 text-sm text-muted">{description}</p> : null}
        </div>
      )}
      <div className="space-y-4">{children}</div>
    </section>
  );
}

export interface FormActionsProps {
  readonly children: ReactNode;
  readonly align?: "start" | "end" | "between";
  readonly className?: string;
}

/** A footer row for form submit/cancel actions. */
export function FormActions({ children, align = "end", className }: FormActionsProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 border-t border-border pt-4",
        align === "end" && "justify-end",
        align === "between" && "justify-between",
        align === "start" && "justify-start",
        className,
      )}
    >
      {children}
    </div>
  );
}
