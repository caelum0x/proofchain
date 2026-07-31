"use client";

import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { isMarketingRoute } from "@/lib/sidebar-nav";
import { AppShell } from "./AppShell";
import { MarketingShell } from "./MarketingShell";

/**
 * Chooses the correct frame for the current route: MarketingShell for the
 * landing page, docs, and onboarding (WD §2); AppShell for every authenticated
 * product route. Applied once in app/layout.tsx so pages never wire a shell.
 */
export function AppFrame({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  if (isMarketingRoute(pathname)) {
    return <MarketingShell>{children}</MarketingShell>;
  }
  return <AppShell>{children}</AppShell>;
}
