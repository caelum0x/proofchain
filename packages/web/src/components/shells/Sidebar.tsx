"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type CSSProperties } from "react";
import { cn } from "@/lib/cn";
import { Icon } from "@/components/ui/Icon";
import {
  SIDEBAR_GROUPS,
  ACCENT_TEXT,
  ACCENT_VAR,
  activeSidebar,
  type SidebarGroup,
} from "@/lib/sidebar-nav";

export interface SidebarProps {
  /** Called when a link is chosen (used to close the mobile drawer). */
  readonly onNavigate?: () => void;
  readonly className?: string;
}

/**
 * The grouped, collapsible product navigation (WD §5). Each section carries its
 * domain accent + icon; the active group auto-expands and the active route is
 * highlighted. Rendered inside the desktop rail and the mobile drawer.
 */
export function Sidebar({ onNavigate, className }: SidebarProps) {
  const pathname = usePathname();
  const { group: activeGroup, item: activeItem } = activeSidebar(pathname);
  const [open, setOpen] = useState<readonly string[]>(activeGroup ? [activeGroup.label] : []);

  // Keep the active group expanded as the route changes.
  useEffect(() => {
    if (activeGroup && !open.includes(activeGroup.label)) {
      setOpen((cur) => [...cur, activeGroup.label]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeGroup?.label]);

  const toggle = (label: string) =>
    setOpen((cur) => (cur.includes(label) ? cur.filter((l) => l !== label) : [...cur, label]));

  return (
    <nav aria-label="Sections" className={cn("flex h-full flex-col", className)}>
      <div className="flex h-14 shrink-0 items-center gap-2 border-b border-border px-4">
        <Link href="/dashboard" onClick={onNavigate} className="flex items-center gap-2 focus-ring rounded-md">
          <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-bold text-brand-fg">
            P
          </span>
          <span className="text-sm font-semibold tracking-tight text-fg">ProofChain</span>
        </Link>
      </div>

      <div className="flex-1 space-y-1 overflow-y-auto px-2 py-3">
        {SIDEBAR_GROUPS.map((group) => (
          <NavGroup
            key={group.label}
            group={group}
            expanded={open.includes(group.label)}
            isActiveGroup={activeGroup?.label === group.label}
            activeHref={activeItem?.href}
            onToggle={() => toggle(group.label)}
            onNavigate={onNavigate}
          />
        ))}
      </div>
    </nav>
  );
}

interface NavGroupProps {
  readonly group: SidebarGroup;
  readonly expanded: boolean;
  readonly isActiveGroup: boolean;
  readonly activeHref?: string;
  readonly onToggle: () => void;
  readonly onNavigate?: () => void;
}

function NavGroup({ group, expanded, isActiveGroup, activeHref, onToggle, onNavigate }: NavGroupProps) {
  return (
    <div style={{ "--accent": ACCENT_VAR[group.accent] } as CSSProperties}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className={cn(
          "flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-left text-sm font-medium transition-colors focus-ring",
          isActiveGroup ? "text-fg" : "text-muted hover:text-fg",
        )}
      >
        <Icon name={group.icon} size={16} className={ACCENT_TEXT[group.accent]} />
        <span className="flex-1">{group.label}</span>
        <Icon name="chevron-down" size={14} className={cn("text-faint transition-transform", expanded && "rotate-180")} />
      </button>
      {expanded ? (
        <ul className="mb-1 ml-3 space-y-0.5 border-l border-border pl-2">
          {group.items.map((item) => {
            const active = activeHref === item.href;
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm transition-colors focus-ring",
                    active
                      ? "bg-accent/15 font-medium text-fg"
                      : "text-muted hover:bg-surface-2 hover:text-fg",
                  )}
                >
                  <Icon
                    name={item.icon}
                    size={15}
                    className={active ? ACCENT_TEXT[group.accent] : "text-faint"}
                  />
                  {item.label}
                </Link>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
