import Link from "next/link";
import { Fragment } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export interface Crumb {
  readonly label: string;
  readonly href?: string;
}

export interface BreadcrumbsProps {
  readonly items: readonly Crumb[];
  readonly className?: string;
}

/** Hierarchical navigation trail. The last item is rendered as the current page. */
export function Breadcrumbs({ items, className }: BreadcrumbsProps) {
  return (
    <nav aria-label="Breadcrumb" className={cn("flex items-center gap-1.5 text-sm", className)}>
      {items.map((item, index) => {
        const last = index === items.length - 1;
        return (
          <Fragment key={`${item.label}-${index}`}>
            {item.href && !last ? (
              <Link href={item.href} className="text-muted transition-colors hover:text-fg">
                {item.label}
              </Link>
            ) : (
              <span className={last ? "font-medium text-fg" : "text-muted"} aria-current={last ? "page" : undefined}>
                {item.label}
              </span>
            )}
            {!last ? <Icon name="chevron-right" size={14} className="text-faint" /> : null}
          </Fragment>
        );
      })}
    </nav>
  );
}
