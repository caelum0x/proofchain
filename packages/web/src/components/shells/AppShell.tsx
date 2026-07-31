"use client";

import { useState, type ReactNode } from "react";
import { cn } from "@/lib/cn";
import { Drawer } from "@/components/ui/Drawer";
import { NetworkBanner } from "@/components/NetworkBanner";
import { Sidebar } from "./Sidebar";
import { TopBar } from "./TopBar";

export interface AppShellProps {
  readonly children: ReactNode;
  /** Constrain the content column width (default true). */
  readonly contained?: boolean;
  readonly className?: string;
}

/**
 * The authenticated product frame (WD §2): a fixed grouped Sidebar, a sticky
 * TopBar (search / wallet / notifications / theme / breadcrumbs), and a
 * scrollable, max-width content region. The sidebar collapses to a drawer on
 * mobile; content reflows to a single column.
 */
export function AppShell({ children, contained = true, className }: AppShellProps) {
  const [mobileNav, setMobileNav] = useState(false);

  return (
    <div className="flex min-h-screen bg-bg">
      {/* Desktop rail */}
      <aside className="hidden w-64 shrink-0 border-r border-border bg-surface/60 lg:block">
        <div className="sticky top-0 h-screen">
          <Sidebar />
        </div>
      </aside>

      {/* Mobile drawer */}
      <Drawer open={mobileNav} onClose={() => setMobileNav(false)} title="Navigation" side="left" width="17rem">
        <Sidebar onNavigate={() => setMobileNav(false)} />
      </Drawer>

      <div className="flex min-w-0 flex-1 flex-col">
        <TopBar onMenuClick={() => setMobileNav(true)} />
        <NetworkBanner />
        <main className={cn("flex-1", className)}>
          <div className={cn("mx-auto w-full px-4 py-6 sm:px-6", contained && "max-w-7xl")}>{children}</div>
        </main>
      </div>
    </div>
  );
}
