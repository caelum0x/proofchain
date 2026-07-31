import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Spinner } from "./Spinner";
import { Button } from "./Button";

export function LoadingState({
  label = "Loading…",
  className,
}: {
  label?: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex items-center justify-center gap-3 rounded-xl border border-border bg-surface/50 p-8 text-sm text-muted",
        className,
      )}
    >
      <Spinner className="h-5 w-5 text-brand" />
      <span>{label}</span>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  className,
}: {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface/40 p-10 text-center",
        className,
      )}
    >
      <p className="text-sm font-medium text-fg">{title}</p>
      {description ? <p className="max-w-md text-sm text-muted">{description}</p> : null}
      {action ? <div className="mt-2">{action}</div> : null}
    </div>
  );
}

export function ErrorState({
  title = "Something went wrong",
  message,
  onRetry,
  className,
}: {
  title?: string;
  message: string;
  onRetry?: () => void;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-start gap-3 rounded-xl border border-danger/40 bg-danger/10 p-5",
        className,
      )}
      role="alert"
    >
      <div>
        <p className="text-sm font-semibold text-danger">{title}</p>
        <p className="mt-1 text-sm text-fg/80">{message}</p>
      </div>
      {onRetry ? (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          Try again
        </Button>
      ) : null}
    </div>
  );
}
