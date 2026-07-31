"use client";

import { cn } from "@/lib/cn";
import { Icon } from "./Icon";
import { useTheme } from "./theme";

/** Button that switches between dark and light themes (WD §1). */
export function ThemeToggle({ className }: { className?: string }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light theme" : "Switch to dark theme"}
      title={isDark ? "Light theme" : "Dark theme"}
      className={cn(
        "grid h-9 w-9 place-items-center rounded-lg border border-border text-muted transition-colors hover:text-fg focus-ring",
        className,
      )}
    >
      <Icon name={isDark ? "sun" : "moon"} size={18} />
    </button>
  );
}
