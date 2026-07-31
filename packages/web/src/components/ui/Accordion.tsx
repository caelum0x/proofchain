"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "./Icon";

export interface AccordionItem {
  readonly id: string;
  readonly title: ReactNode;
  readonly content: ReactNode;
}

export interface AccordionProps {
  readonly items: readonly AccordionItem[];
  /** Allow multiple panels open at once. */
  readonly multiple?: boolean;
  readonly defaultOpen?: readonly string[];
  readonly className?: string;
}

/** A vertically stacked set of collapsible disclosure panels. */
export function Accordion({ items, multiple = false, defaultOpen = [], className }: AccordionProps) {
  const [open, setOpen] = useState<readonly string[]>(defaultOpen);

  const toggle = (id: string) => {
    setOpen((current) => {
      if (current.includes(id)) return current.filter((x) => x !== id);
      return multiple ? [...current, id] : [id];
    });
  };

  return (
    <div className={cn("divide-y divide-border rounded-lg border border-border", className)}>
      {items.map((item) => {
        const isOpen = open.includes(item.id);
        return (
          <div key={item.id}>
            <button
              type="button"
              onClick={() => toggle(item.id)}
              aria-expanded={isOpen}
              className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left text-sm font-medium text-fg transition-colors hover:bg-surface-2/50 focus-ring"
            >
              {item.title}
              <Icon
                name="chevron-down"
                size={16}
                className={cn("text-muted transition-transform", isOpen && "rotate-180")}
              />
            </button>
            {isOpen ? <div className="px-4 pb-4 text-sm text-fg/80">{item.content}</div> : null}
          </div>
        );
      })}
    </div>
  );
}
