"use client";

import { usePathname, useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { IconButton } from "@/components/ui/IconButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { WalletButton } from "@/components/ui/WalletButton";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { activeSidebar } from "@/lib/sidebar-nav";
import { GlobalSearch } from "./GlobalSearch";

export interface TopBarProps {
  /** Opens the mobile navigation drawer. */
  readonly onMenuClick: () => void;
  readonly className?: string;
}

/**
 * The authenticated top bar (WD §2): breadcrumbs, global search, theme toggle,
 * notifications, and the wallet control. Sticky above the scrollable content.
 */
export function TopBar({ onMenuClick, className }: TopBarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { group, item } = activeSidebar(pathname);

  const crumbs: Crumb[] = [{ label: "Home", href: "/dashboard" }];
  if (group) crumbs.push({ label: group.label });
  if (item) crumbs.push({ label: item.label, href: item.href });

  return (
    <header
      className={cn(
        "sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-bg/85 px-4 backdrop-blur",
        className,
      )}
    >
      <IconButton icon="menu" label="Open navigation" variant="ghost" size="sm" className="lg:hidden" onClick={onMenuClick} />

      <div className="hidden min-w-0 md:block">
        <Breadcrumbs items={crumbs} />
      </div>

      <div className="flex flex-1 justify-center px-2 lg:justify-end">
        <GlobalSearch />
      </div>

      <div className="flex items-center gap-1.5">
        <IconButton
          icon="bell"
          label="Notifications"
          variant="ghost"
          size="sm"
          onClick={() => router.push("/notifications")}
        />
        <ThemeToggle />
        <div className="ml-1">
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
