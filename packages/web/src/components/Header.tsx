"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { cn } from "@/lib/cn";
import { NAV_GROUPS, activeNav, type NavGroup } from "@/lib/nav";

/**
 * Full-platform site header + navigation.
 *
 * Covers every section in SPEC2 "Web" via grouped dropdown menus (desktop) and
 * a slide-down drawer (mobile). This is shared scaffolding — page agents rely on
 * it and should NOT edit it; adjust routes in `@/lib/nav` instead.
 */
export function Header() {
  const pathname = usePathname();
  const { group: activeGroup, item: activeItem } = activeNav(pathname);

  const [openGroup, setOpenGroup] = useState<string | null>(null);
  const [mobileOpen, setMobileOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Close all menus whenever the route changes.
  useEffect(() => {
    setOpenGroup(null);
    setMobileOpen(false);
  }, [pathname]);

  // Close the desktop dropdown on outside click or Escape.
  useEffect(() => {
    function onPointerDown(event: MouseEvent) {
      if (navRef.current && !navRef.current.contains(event.target as Node)) {
        setOpenGroup(null);
      }
    }
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpenGroup(null);
        setMobileOpen(false);
      }
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, []);

  const toggleGroup = useCallback((label: string) => {
    setOpenGroup((current) => (current === label ? null : label));
  }, []);

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-bg/80 backdrop-blur">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-3">
        <div className="flex min-w-0 items-center gap-4">
          <Link href="/" className="flex shrink-0 items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg bg-brand text-sm font-bold text-brand-fg">
              P
            </span>
            <span className="text-sm font-semibold tracking-tight">ProofChain</span>
          </Link>

          {/* Desktop grouped nav */}
          <nav ref={navRef} className="hidden items-center gap-0.5 lg:flex" aria-label="Primary">
            {NAV_GROUPS.map((group) => (
              <GroupMenu
                key={group.label}
                group={group}
                open={openGroup === group.label}
                isActive={activeGroup?.label === group.label}
                activeHref={activeItem?.href}
                onToggle={() => toggleGroup(group.label)}
                onOpen={() => setOpenGroup(group.label)}
                onClose={() => setOpenGroup(null)}
              />
            ))}
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ConnectButton showBalance={false} accountStatus="address" chainStatus="icon" />
          <button
            type="button"
            className="grid h-9 w-9 place-items-center rounded-lg border border-border text-fg lg:hidden"
            aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((v) => !v)}
          >
            <MenuIcon open={mobileOpen} />
          </button>
        </div>
      </div>

      {/* Mobile drawer */}
      {mobileOpen ? (
        <nav
          className="max-h-[70vh] overflow-y-auto border-t border-border bg-bg px-4 py-3 lg:hidden"
          aria-label="Primary mobile"
        >
          {NAV_GROUPS.map((group) => (
            <div key={group.label} className="py-2">
              <p className="px-1 pb-1 text-xs font-semibold uppercase tracking-wide text-muted">
                {group.label}
              </p>
              <div className="grid gap-0.5">
                {group.items.map((item) => {
                  const active = activeItem?.href === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        "rounded-lg px-3 py-2 text-sm transition-colors",
                        active ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
                      )}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
        </nav>
      ) : null}
    </header>
  );
}

interface GroupMenuProps {
  readonly group: NavGroup;
  readonly open: boolean;
  readonly isActive: boolean;
  readonly activeHref?: string;
  readonly onToggle: () => void;
  readonly onOpen: () => void;
  readonly onClose: () => void;
}

function GroupMenu({
  group,
  open,
  isActive,
  activeHref,
  onToggle,
  onOpen,
  onClose,
}: GroupMenuProps) {
  return (
    <div className="relative" onMouseEnter={onOpen} onMouseLeave={onClose}>
      <button
        type="button"
        className={cn(
          "flex items-center gap-1 rounded-lg px-3 py-1.5 text-sm transition-colors",
          isActive || open ? "bg-surface-2 text-fg" : "text-muted hover:text-fg",
        )}
        aria-haspopup="true"
        aria-expanded={open}
        onClick={onToggle}
      >
        {group.label}
        <ChevronIcon open={open} />
      </button>

      {open ? (
        <div className="absolute left-0 top-full z-40 w-72 pt-2">
          <div className="rounded-xl border border-border bg-surface p-2 shadow-lg">
            {group.items.map((item) => {
              const active = activeHref === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "block rounded-lg px-3 py-2 transition-colors",
                    active ? "bg-surface-2" : "hover:bg-surface-2",
                  )}
                >
                  <span className="block text-sm font-medium text-fg">{item.label}</span>
                  {item.description ? (
                    <span className="mt-0.5 block text-xs text-muted">{item.description}</span>
                  ) : null}
                </Link>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function ChevronIcon({ open }: { open: boolean }) {
  return (
    <svg
      className={cn("h-3.5 w-3.5 transition-transform", open ? "rotate-180" : "")}
      viewBox="0 0 12 12"
      fill="none"
      aria-hidden="true"
    >
      <path d="M3 4.5 6 7.5 9 4.5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function MenuIcon({ open }: { open: boolean }) {
  return (
    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      {open ? (
        <path d="M5 5l10 10M15 5 5 15" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      ) : (
        <path d="M3 6h14M3 10h14M3 14h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      )}
    </svg>
  );
}
