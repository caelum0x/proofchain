"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import { WalletButton } from "@/components/ui/WalletButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { Button } from "@/components/ui/Button";

const MARKETING_LINKS = [
  { href: "/dashboard", label: "App" },
  { href: "/explorer", label: "Explorer" },
  { href: "/docs", label: "Docs" },
  { href: "/onboarding", label: "Get started" },
] as const;

export interface MarketingShellProps {
  readonly children: ReactNode;
  /** Wrap content in a centered max-width container (default true). */
  readonly contained?: boolean;
  readonly className?: string;
}

/** Full-bleed marketing frame (WD §2) for `/`, `/docs`, `/onboarding`. */
export function MarketingShell({ children, contained = true, className }: MarketingShellProps) {
  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <header className="sticky top-0 z-30 border-b border-border bg-bg/85 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4">
          <Link href="/" className="flex items-center gap-2 focus-ring rounded-md">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-brand text-sm font-bold text-brand-fg">P</span>
            <span className="text-base font-semibold tracking-tight text-fg">ProofChain</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex" aria-label="Marketing">
            {MARKETING_LINKS.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="rounded-lg px-3 py-1.5 text-sm text-muted transition-colors hover:text-fg"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/dashboard" className="hidden sm:block">
              <Button size="sm" variant="secondary">
                Launch app
              </Button>
            </Link>
            <WalletButton compact />
          </div>
        </div>
      </header>

      <main className={cn("flex-1", className)}>
        {contained ? <div className="mx-auto w-full max-w-6xl px-4 py-10">{children}</div> : children}
      </main>

      <footer className="border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-2 px-4 py-8 text-xs text-muted sm:flex-row sm:items-center">
          <p>ProofChain · Ethereum Sepolia · Never share private keys. This dApp signs only in your wallet.</p>
          <div className="flex gap-4">
            <Link href="/docs" className="hover:text-fg">Docs</Link>
            <Link href="/explorer" className="hover:text-fg">Explorer</Link>
            <Link href="/dashboard" className="hover:text-fg">Dashboard</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
