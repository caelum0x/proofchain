import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Card, CardHeader } from "@/components/ui/Card";

export interface DefinitionItem {
  readonly label: ReactNode;
  readonly value: ReactNode;
  /** Full-width row (spans both columns). */
  readonly wide?: boolean;
}

/**
 * A compact key/value metadata block for detail rails and cards. Values that
 * are addresses/hashes/amounts should be passed already wrapped in the mono
 * primitives (AddressBadge, etc.).
 */
export function DefinitionList({
  items,
  columns = 2,
  className,
}: {
  readonly items: readonly DefinitionItem[];
  readonly columns?: 1 | 2;
  readonly className?: string;
}) {
  return (
    <dl className={cn("grid gap-x-4 gap-y-3", columns === 2 ? "grid-cols-2" : "grid-cols-1", className)}>
      {items.map((item, index) => (
        <div key={index} className={cn("min-w-0", item.wide && "col-span-full")}>
          <dt className="text-xs uppercase tracking-wide text-muted">{item.label}</dt>
          <dd className="mt-0.5 break-words text-sm text-fg">{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

/** A titled Card wrapping a {@link DefinitionList} — the standard rail block. */
export function InfoCard({
  title,
  action,
  items,
  columns,
  children,
}: {
  readonly title: ReactNode;
  readonly action?: ReactNode;
  readonly items?: readonly DefinitionItem[];
  readonly columns?: 1 | 2;
  readonly children?: ReactNode;
}) {
  return (
    <Card>
      <CardHeader title={title} action={action} />
      {items ? <DefinitionList items={items} columns={columns} /> : null}
      {children}
    </Card>
  );
}
