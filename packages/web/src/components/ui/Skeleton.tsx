import { cn } from "@/lib/cn";

export interface SkeletonProps {
  readonly className?: string;
  /** Convenience presets. */
  readonly variant?: "text" | "rect" | "circle";
}

/** A shimmering placeholder block used while data streams in. */
export function Skeleton({ className, variant = "rect" }: SkeletonProps) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "block animate-pulse bg-surface-2",
        variant === "text" && "h-3.5 w-full rounded",
        variant === "rect" && "h-16 w-full rounded-lg",
        variant === "circle" && "h-10 w-10 rounded-full",
        className,
      )}
    />
  );
}

/** Convenience: a stack of text skeleton lines. */
export function SkeletonText({ lines = 3, className }: { lines?: number; className?: string }) {
  return (
    <div className={cn("space-y-2", className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <Skeleton key={i} variant="text" className={i === lines - 1 ? "w-2/3" : "w-full"} />
      ))}
    </div>
  );
}
